# CBT System

Computer-Based Testing system for a Nigerian College of Education.

A monorepo with a Laravel 11 REST API (`/backend`) and a Next.js 16 App Router
frontend (`/frontend`). The system runs in two modes from the **same codebase**:

- **Online server** — staff portal (Super Admin, CBT Admin, School Exam Officer,
  Lecturer). Manages schools, courses, students, question banks, exam
  configuration and results.
- **Offline server** — runs in the CBT center on the LAN. Hosts the student exam
  interface. The online server pushes exam data to it and pulls results back
  afterwards. It has no outbound internet access during exams.

The two are distinguished only by their `.env` (`IS_OFFLINE_SERVER`).

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Backend      | PHP 8.4, Laravel 11, Sanctum (token auth)             |
| Frontend     | Next.js 16 (App Router), TypeScript, Tailwind CSS v4  |
| UI           | shadcn/ui-style components, TanStack Query + Table    |
| Database     | MySQL 8                                               |
| Exports      | dompdf (PDF), maatwebsite/excel (Excel)               |

## Roles

- **Lecturer** — sets exam questions (MCQ, True/False, Fill-in-the-blank) for
  assigned courses; submits question banks for moderation; views/downloads
  results.
- **School Exam Officer** — a lecturer with school-scoped admin: manages
  lecturers, students, courses, departments; assigns courses/students; moderates
  submitted question banks (approve → forwards to CBT Admin; reject → returns to
  lecturer with a reason).
- **CBT Admin** — configures exams, generates per-student exam codes, syncs exam
  data to the offline server and pulls results back, and upgrades/downgrades
  exam officers.
- **Super Admin** — college settings, schools CRUD, CBT Admin accounts, audit
  logs, system health.

## Repository Layout

```
.
├── backend/      # Laravel API (Dockerfile + docker/start.sh for Compose)
├── frontend/     # Next.js app (staff dashboards + student exam UI; Dockerfile)
└── compose.yaml  # one-command local stack (frontend + backend + MySQL)
```

## Getting Started

Two ways to run the whole stack locally. **Docker is the easy path** — one
command, nothing to install but Docker. Use the manual path if you'd rather run
live-reloading dev servers while you work on the code. Either way, open
**http://localhost:3000** and sign in as the seeded Super Admin (file number
`ADMIN/0001`, password `password` — you'll be forced to change it on first login).

### Option A — Docker (recommended)

Needs only [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(Docker Engine + Compose). From the repo root:

```bash
docker compose up --build
```

This builds the frontend, backend, and a MySQL 8 database, applies the
migrations, and seeds the bootstrap data (system settings, college, and the
Super Admin account) on the first run. Once the Laravel and Next.js servers
report ready, open http://localhost:3000.

```bash
docker compose down       # stop (your data is kept)
docker compose down -v    # stop and wipe the DB + uploads (re-seeds next time)
```

The stack runs as the **online** server (`IS_OFFLINE_SERVER=false`). All
settings live in `compose.yaml`; it ships a demo `APP_KEY` and a development
`SYNC_SECRET_KEY` — change both before deploying anywhere real.

### Option B — Manual (PHP + Node + MySQL)

**Prerequisites**

- PHP 8.3+ (8.4 recommended) and Composer
- Node.js 20+ and npm
- MySQL 8 (SQLite also works for local development)

**Backend** (Laravel API → http://localhost:8000):

```bash
cd backend
composer install
cp .env.example .env          # configure DB + sync keys
php artisan key:generate
php artisan migrate --seed     # creates the bootstrap Super Admin
php artisan serve              # http://localhost:8000
```

The seeded Super Admin credentials default to file number `ADMIN/0001` /
password `password` (override via `SUPER_ADMIN_*` env vars). The account is
forced to change its password on first login.

**Frontend** (Next.js → http://localhost:3000) — in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local     # sets NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                    # http://localhost:3000
```

## Online vs Offline Deployment

Both servers run the same code; only the environment differs.

- **Online**: `IS_OFFLINE_SERVER=false`, set `OFFLINE_SERVER_URL` to the offline
  server's LAN address, and share a `SYNC_SECRET_KEY`.
- **Offline**: copy `backend/.env.offline` to `.env`, set
  `IS_OFFLINE_SERVER=true`, leave `OFFLINE_SERVER_URL` blank, and use the **same**
  `SYNC_SECRET_KEY` as the online server.

Server-to-server sync endpoints (`/api/sync/*`) are authenticated by the shared
`X-Sync-Secret` header, not by user tokens.

### Moving exams when the offline server has no path to the online server

Same-LAN sync above assumes the online server can reach the offline server. When
the online server is cloud-hosted and the offline server sits on an isolated
exam-hall LAN, that's not possible — so the CBT Admin gets two extra transports
on the exam page (and the exams list), reusing the same payload format:

- **File (USB / air-gapped):** on the **online** server, *Export exam package* → a
  `.json` file. Carry it to the exam hall and *Import exam package* on the
  **offline** server. After the exam, *Export results* on the offline server,
  carry it back, and *Import results* on the online server. No network needed.
- **Network (offline briefly online):** set `ONLINE_SERVER_URL` on the offline
  server. When it has brief internet, *Pull from online* downloads the exam, and
  *Push results to online* uploads results — then it goes offline for the exam.
  Uses the same `X-Sync-Secret`.

The exam page auto-detects which server it is (via `/api/health`) and shows the
relevant actions.

## Security Highlights

- Sanctum tokens with an 8-hour expiry; forced password change on first login.
- Role hierarchy enforced server-side via middleware on every route group.
- Exam Officers are scoped to their own school.
- Rate limiting: 5 login attempts/min, 60 API requests/min.
- CORS locked to the configured frontend origin.
- Audit logging of privileged actions.

## Build Phases

The system is built in sequential phases: foundation/scaffolding → auth → super
admin → exam officer → lecturer → moderation → CBT admin → offline/student exam
→ results sync → notifications & polish.
