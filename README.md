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
├── backend/    # Laravel 11 API
└── frontend/   # Next.js 16 app (staff dashboards + student exam UI)
```

## Getting Started

### Prerequisites

- PHP 8.2+ and Composer
- Node.js 20+ and npm
- MySQL 8 (SQLite also works for local development)

### Backend

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

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL
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
