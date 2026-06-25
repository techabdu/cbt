# Exam load test (k6)

Exercises the student exam flow — **login → answer → autosave → submit** — at
high concurrency to validate that the stack holds up with ~5,000 students writing
at once (nginx + PHP-FPM + Redis + queued grading). Use it to find the real
ceiling of a given box and to watch the end-of-exam submit spike drain.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) on the **load
  generator** machine (separate from the server under test).
- The target must be an **offline server** (`IS_OFFLINE_SERVER=true`) — the
  student exam routes only exist there. The script verifies this via
  `/api/health` and aborts otherwise.

## 1. Seed data + credentials

On a box that can reach the target's database (the offline server itself is
simplest), create a throwaway exam, students and codes, and export the login
pairs the script consumes:

```bash
cd backend
php artisan loadtest:seed-exam --students=5000 --questions=40 --force
# → writes scripts/loadtest/credentials.json  (matric_number + exam_code pairs)
```

Each run uses a fresh prefix, so it's safe to re-run. Options:
`--students`, `--questions`, `--duration` (minutes; default 600 so the timer
never expires mid-test), `--output` (credentials path).

Copy `credentials.json` to the load generator if k6 runs elsewhere.

## 2. Run

```bash
# True 5,000-concurrent spike (5000 VUs each run one full journey):
k6 run -e BASE_URL=http://<offline-host>:8000 -e VUS=5000 scripts/loadtest/exam-spike.js

# Gentler steady-throughput run (200 workers drain all journeys):
k6 run -e BASE_URL=http://<offline-host>:8000 -e VUS=200 scripts/loadtest/exam-spike.js
```

Knobs (`-e KEY=value`):

| Var           | Default               | Meaning                                              |
| ------------- | --------------------- | ---------------------------------------------------- |
| `BASE_URL`    | `http://localhost:8000` | Target origin (no `/api`).                          |
| `VUS`         | `200`                 | Concurrent virtual users. Set to `5000` for the spike. |
| `ITERATIONS`  | all credentials       | Total journeys (capped at the credential count).     |
| `ANSWERS`     | `10`                  | Questions answered per student.                      |
| `THINK`       | `0.3`                 | Seconds between answers (`0` = pure burst).          |
| `CREDENTIALS` | `./credentials.json`  | Path to the seeded credentials file.                 |
| `MAX_DURATION`| `15m`                 | Hard cap on the run.                                 |

> One journey consumes one credential (a code can't be submitted twice), so the
> run never exceeds the number of seeded credentials. Seed at least as many
> students as the concurrency you want to test.

## 3. Reading the results

The run **fails its thresholds** (non-zero exit) if any of these break — that's
your pass/fail signal:

- `http_req_failed rate < 1%` and `checks rate > 99%`
- p95 latency: login < 1.5s, answer < 0.8s, autosave < 1s, submit < 1.5s

Also watch on the server during the run:

- `redis-cli -n 0 llen queues:grading` — grading backlog draining after the
  submit spike (the whole point of queued grading).
- `php artisan queue:monitor redis:grading,default` and the `failed_jobs` table.
- PHP-FPM busy children, MySQL `Threads_connected`/`Threads_running`.

Tune up from there: raise PHP-FPM `pm.max_children`, grading-worker `numprocs`,
and MySQL `max_connections` per the budget in [`DEPLOYMENT.md`](../../DEPLOYMENT.md).

## Pushing past one load generator

A single k6 process and NIC can become the bottleneck before the server does.
For a genuine 5k spike:

- Raise file-descriptor limits on the generator: `ulimit -n 1048576`.
- Split the credential file and run k6 on several machines in parallel (or use
  [k6 distributed / Grafana Cloud k6](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/)),
  each with `-e VUS=… -e CREDENTIALS=part-N.json`.

## Cleanup

The seeded exam/students/codes are throwaway. On a disposable DB,
`docker compose down -v` wipes everything. Otherwise delete the load-test exam
(and its students by matric prefix) directly, or restore from your pre-test
snapshot.
