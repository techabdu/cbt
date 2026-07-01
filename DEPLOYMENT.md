# CBT Deployment & Scaling Guide

How to run the CBT backend so it holds up with **~5,000 students writing exams at
once**. It covers the production runtime (nginx + PHP-FPM + Redis + queue
workers), MySQL tuning, capacity sizing, and both Docker and bare-metal paths.

> **Why this exists.** The original image ran `php artisan serve` (≈4 concurrent
> requests) with MySQL also serving cache, sessions and queue, and graded every
> submission inline. That collapses well under 100 concurrent students. The
> changes below remove those bottlenecks.

---

## 1. Architecture at a glance

```
        Browsers (students / staff)
                  │  HTTP
                  ▼
        ┌───────────────────┐
        │  nginx (port 80)  │   static + reverse proxy to FPM
        └─────────┬─────────┘
                  │ FastCGI
        ┌─────────▼─────────┐      ┌──────────────┐
        │   PHP-FPM pool    │◄────►│   Redis 7    │  cache · sessions · queue · locks
        │ (pm.max_children) │      └──────────────┘
        └─────────┬─────────┘             ▲
                  │                        │ dispatch grading jobs
                  ▼                        │
        ┌───────────────────┐      ┌───────┴────────┐
        │     MySQL 8       │◄────►│ queue workers  │  GradeExamSession (off-thread)
        └───────────────────┘      └────────────────┘
```

Key behaviours:

- **Grading is queued** (`App\Jobs\GradeExamSession`). Submitting marks the
  session and returns immediately; workers grade with a small random delay so the
  synchronized end-of-exam auto-submit spike is spread out.
- **The question payload is cached** per exam (Redis), so 5,000 logins don't each
  re-read the whole question bank. Cache is dropped automatically when an exam
  package is (re)imported.
- **Autosave is delta + batched** — the client sends only changed answers; the
  server does a single `upsert`.
- **The offline exam server runs the same image**; only `.env` differs
  (`IS_OFFLINE_SERVER=true`, see `backend/.env.offline`).

---

## 2. Required components

| Component   | Role                                              | Min version |
| ----------- | ------------------------------------------------- | ----------- |
| nginx       | HTTP front + FastCGI to PHP-FPM                   | 1.22+       |
| PHP-FPM     | App workers (OPcache + phpredis + pcntl)          | 8.3 (8.4)   |
| Redis       | cache, sessions, queue, atomic locks              | 7+          |
| MySQL       | system of record                                  | 8.0         |
| supervisor  | keeps the queue workers (and, in Docker, FPM+nginx) alive | 4+  |

---

## 3. Docker (single command)

`compose.yaml` brings up `db` (MySQL, tuned via `deploy/mysql/my.cnf`), `redis`,
`backend` (nginx + PHP-FPM + queue workers in one image via supervisor) and
`frontend`.

```bash
docker compose up --build
# open http://localhost:3000
```

The `backend` image (`backend/Dockerfile`) already:

- installs `redis`, `opcache`, `pcntl` (plus the existing extensions),
- ships tuned configs (`backend/docker/{php.ini,opcache.ini,php-fpm.pool.conf,nginx.conf,supervisord.conf}`),
- runs `php artisan optimize` on boot (config/route/event cache),
- starts **nginx + PHP-FPM + 4 grading workers** under supervisor.

To run a box as the **offline exam server**, set `IS_OFFLINE_SERVER=true` (and the
other `.env.offline` values) in that deployment's environment.

### Scaling the Docker workers / pool

- Grading throughput: raise `numprocs` for `[program:queue-worker]` in
  `backend/docker/supervisord.conf`.
- Request concurrency: raise `pm.max_children` in
  `backend/docker/php-fpm.pool.conf` (and give the container more RAM).

---

## 4. Bare-metal / VM (the offline exam-hall box, or an online node)

Reference configs live in `deploy/`. Paths below assume the app at
`/var/www/cbt/backend`.

1. **System packages:** nginx, php8.4-fpm + extensions (`php8.4-{mysql,redis,opcache,mbstring,gd,zip,intl,bcmath,pcntl}`), redis-server, mysql-server, supervisor.

2. **App:** clone the repo, `composer install --no-dev --optimize-autoloader`,
   copy `backend/.env.offline` → `.env` (offline) or configure an online `.env`,
   `php artisan key:generate`, `php artisan migrate --force`, then:
   ```bash
   php artisan optimize          # config + route + event cache
   chown -R www-data:www-data storage bootstrap/cache
   ```

3. **PHP-FPM:** install `deploy/php-fpm/cbt-pool.conf` →
   `/etc/php/8.4/fpm/pool.d/cbt.conf`, `systemctl reload php8.4-fpm`.

4. **nginx:** install `deploy/nginx/cbt.conf` → `/etc/nginx/sites-available/`,
   symlink into `sites-enabled/`, set `server_name`/`root`, `nginx -t`,
   `systemctl reload nginx`.

5. **Redis:** apply `deploy/redis/redis.conf` settings, `systemctl enable --now redis`.

6. **MySQL:** copy `deploy/mysql/my.cnf` → `/etc/mysql/conf.d/cbt.cnf`,
   `systemctl restart mysql`. Size `innodb_buffer_pool_size` to the box.

7. **Queue workers:** install `deploy/supervisor/cbt-worker.conf` →
   `/etc/supervisor/conf.d/`, then
   `supervisorctl reread && supervisorctl update && supervisorctl start cbt-worker:*`.
   `mkdir -p /var/log/cbt` first.

8. **Re-run `php artisan optimize` on every deploy** (config/routes change).

---

## 5. Capacity sizing for ~5,000 concurrent students

The exam endpoints are light (token decrypt, one cached read, one indexed
write). Throughput is gated by PHP-FPM workers and MySQL connections, not CPU.

**Connection budget — size this first:**

```
MySQL max_connections  ≥  (pm.max_children × number of app nodes)
                          + queue workers
                          + admin/headroom
```

Worked example (single offline box):

| Setting                       | Value | Notes                                  |
| ----------------------------- | ----- | -------------------------------------- |
| `pm.max_children`             | 48    | ~40–60 MB each → ~3 GB PHP RSS         |
| grading workers (`numprocs`)  | 4     | drain `grading` then `default`         |
| MySQL `max_connections`       | 200   | comfortably covers 48 + 4 + headroom   |
| `innodb_buffer_pool_size`     | ≥4 GB | hot tables must fit in RAM             |

5,000 students rarely click at the same instant; with a single answer save every
few seconds the steady-state request rate is a few hundred req/s, well within one
well-provisioned node. The two **spikes** are what to plan for:

- **Login (exam start):** the cached question payload means each login is one
  cache hit + a couple of indexed writes. Warm the cache by having the CBT admin
  open the exam once before students arrive.
- **Auto-submit (exam end):** every timer hits zero together. Submit is now O(1)
  (mark + enqueue); grading drains over the following minute via the worker pool.
  Add workers (`numprocs`) if you want results graded faster.

If one box isn't enough, scale horizontally (§6).

---

## 6. Horizontal scale (multiple app nodes)

The app tier is **stateless** (encrypted exam token + Sanctum bearer; sessions in
Redis), so you can run N PHP-FPM/nginx nodes behind a load balancer, all sharing
**one Redis** and **one MySQL**.

- Put question-bank attachment uploads on shared storage: set `FILESYSTEM_DISK`
  to an S3-compatible disk (set the `AWS_*` vars) so every node serves the same
  files. A single offline box can stay on `local`.
- Recompute the connection budget (§5) with the new node count.
- Consider a MySQL read replica for the staff reporting/results screens.

> The offline exam server is normally a single LAN box. If a hall really seats
> 5,000, either provision that box generously (§5) or split students across
> multiple offline servers and merge results at sync time.

---

## 7. Operational notes

- **Let the grading queue drain before exporting/pulling results.** Grading is
  async, so a CBT admin who exports the instant the exam ends might race the
  workers. As a safety net, `SyncService::buildResultsPackage()` synchronously
  grades any submitted-but-ungraded session before building the package, so
  exports are never partial — but draining first keeps it fast.
- **Watch the queue:** `php artisan queue:monitor redis:grading,default` and the
  `failed_jobs` table. Retry with `php artisan queue:retry all`.
- **OPcache** has `validate_timestamps=0` — code changes need a deploy/restart
  (`php artisan optimize` + reload php-fpm), not just a file edit.
- **OS limits for many connections:** raise file descriptors and the TCP backlog
  on the app + DB boxes:
  ```
  # /etc/security/limits.d/cbt.conf
  www-data soft nofile 65535
  www-data hard nofile 65535
  # /etc/sysctl.d/cbt.conf
  net.core.somaxconn = 1024
  ```
- **APP_DEBUG=false** in production (already set in `.env.offline`).

---

## 8. Smoke test after deploy

```bash
curl -s http://<host>/api/health        # {"status":"ok", ...}
php artisan about | grep -iE 'cache|queue|session'   # all → redis
php artisan queue:work --once            # a worker can pick up a job
```

Then run the student flow end-to-end: login → answer → wait for an autosave →
submit (returns instantly) → confirm a row lands in `exam_results` shortly after
(grading worker) → sync/export results.

---

## 9. Production security checklist

`compose.yaml` is the **local** one-command stack (demo key, `APP_ENV=local`).
Before exposing a node to real users — especially the cloud-online server — confirm:

- [ ] `APP_DEBUG=false` and `APP_ENV=production` (already set in `.env.offline`).
- [ ] `SESSION_ENCRYPT=true`.
- [ ] `SESSION_SECURE_COOKIE=true` (serve over TLS).
- [ ] `APP_KEY` generated per node (`php artisan key:generate`) — never the demo key.
- [ ] Strong, unique `DB_PASSWORD` / `MYSQL_PASSWORD` (kept in sync), ideally a
      non-root app DB user.
- [ ] `SYNC_SECRET_KEY` is a 32+ char random value, **identical on both sync peers**,
      never committed. (The sync middleware fails closed — a blank key rejects all
      sync requests with 401.)
- [ ] Redis: set `requirepass` in `deploy/redis/redis.conf` and a matching
      `REDIS_PASSWORD` if Redis is reachable off-box; otherwise keep `bind 127.0.0.1`.
- [ ] MySQL/Redis ports are **not** published on a public interface. `compose.yaml`
      binds them to `127.0.0.1` only; the bare-metal path keeps them on loopback.
- [ ] TLS terminated in front of nginx; enable the HSTS header (commented in
      `deploy/nginx/cbt.conf` and `backend/docker/nginx.conf`).

### Overriding compose secrets without editing the file

`compose.yaml` ships dev fallbacks but reads real values from the environment, so it
can run on a shared host unmodified:

```bash
export MYSQL_ROOT_PASSWORD=... MYSQL_PASSWORD=... DB_PASSWORD="$MYSQL_PASSWORD"
export APP_KEY="base64:$(openssl rand -base64 32)"
export SYNC_SECRET_KEY="$(openssl rand -hex 32)"
docker compose up --build
```

Keep `MYSQL_PASSWORD` and `DB_PASSWORD` identical — the app authenticates to MySQL
with the latter.
