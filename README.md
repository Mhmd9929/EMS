# HRMS — Employee Management Portal

A multi-tenant-ready HR portal for UAE companies: employees, org structure, role-based access, audit
trail — with Leave (Phase 2) and Payroll/WPS (Phase 3) to follow.

Built with Next.js 15 (App Router, TypeScript strict), PostgreSQL + Prisma, Auth.js, Tailwind CSS +
shadcn/ui, Zod, pg-boss, Nodemailer, Vitest and Playwright. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the design and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for what's in each checkpoint.

## Features (Phase 1)

- **Auth**: email + password login, logout, forgot/reset password, invite-by-email activation, forced
  password change on first login, idle + absolute session timeouts, login rate limiting, optional Google /
  Microsoft Entra ID SSO (existing users only).
- **Organisation**: company settings (logo, address, currency, timezone, work week, fiscal year, employee
  number format), hierarchical departments (heads, cost centres), positions with grade/level, locations.
- **Employees**: full HR record incl. Emirates ID / passport / visa / labour card with expiries and
  WPS bank details (IBAN validated), auto-numbering, reporting lines with cycle prevention, tabbed detail
  page gated by role, CSV bulk import with dry-run validation report, CSV export, termination flow
  (scheduled or immediate; blocks login after the last working day).
- **Self-service**: profile, contact details, emergency contacts, profile photo, password change.
- **Directory & org chart**: searchable directory (non-sensitive fields only); interactive org chart with
  zoom/pan, expand/collapse, search and employee cards, switchable between reporting line and departments.
- **Admin**: roles & permissions editor (permissions in the DB), user/role assignment, audit-log viewer
  with before/after diffs, per-role dashboards (HR, manager, employee).

## Quick start

### Option A — Docker Compose (everything in containers)

```bash
cp .env.example .env            # optional: compose has working defaults
docker compose up --build
```

- App: http://localhost:3000
- Mailpit (catches all outgoing email): http://localhost:8025
- The `migrate` service applies migrations, syncs the permission catalogue and seeds the demo company
  **only if the database is empty**. Use `SEED=false docker compose up` to skip seeding.

### Option B — Local Node + your own Postgres

Requirements: Node 20.9+ (22 recommended), PostgreSQL 14+.

```bash
npm install
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 48)
npx prisma migrate deploy       # or: npm run db:migrate (dev)
npm run db:seed                 # ⚠ resets all data and loads the demo company
npm run dev                     # http://localhost:3000
npm run worker                  # optional: background jobs (separate terminal)
```

With `EMAIL_TRANSPORT=console` emails (invites, resets) are printed to the server log. Outside production
the "Send invitation" / "Send password reset" buttons also show the link in a toast so you can demo the
flow without an inbox. To use Mailpit locally: `docker compose up mailpit` and set `EMAIL_TRANSPORT=smtp`.

## Demo credentials

All demo users belong to **Falcon Gulf Trading LLC** (Dubai). Password for the five role users: **`Demo@12345`**

| Role | Email | Person | Notes |
|---|---|---|---|
| Super Admin | `admin@falcongulf.ae` | Hamdan Al Falasi, Systems Administrator | everything incl. roles & company settings |
| HR Admin | `hr@falcongulf.ae` | Mariam Al Zaabi, HR Manager | also Manager of 3 |
| Payroll Admin | `payroll@falcongulf.ae` | Ahmed Siddiqui, Payroll Manager | also Manager of 1 |
| Manager | `manager@falcongulf.ae` | Yousef Qasim, Engineering Manager | 4 direct + 2 indirect reports |
| Employee | `employee@falcongulf.ae` | Sara Al Hammadi, Software Engineer | self-service only |
| First login | `new.joiner@falcongulf.ae` / `Welcome@2026` | Omar Bin Rashid | forced password change |
| Terminated | `george.abraham@falcongulf.ae` / `Demo@12345` | George Abraham | login is refused |

The seed creates 14 departments (6 top-level with sub-departments), 27 positions, 3 locations,
43 employees across 4 reporting levels (incl. two joiners this month, one scheduled leaver and one
terminated), UAE public holidays for 2026–27 and a few identity documents expiring soon.
All other employees have accounts that are **not yet activated** (use "Send invitation").

## Environment variables

See [`.env.example`](.env.example) for the full list with comments.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | — | ≥ 32 chars; encrypts session cookies |
| `APP_URL` | | `http://localhost:3000` | Base URL used in email links |
| `SESSION_IDLE_MINUTES` / `SESSION_ABSOLUTE_HOURS` | | 60 / 12 | Session timeouts |
| `LOGIN_MAX_FAILURES_PER_EMAIL` / `_PER_IP` / `LOGIN_WINDOW_MINUTES` | | 5 / 20 / 15 | Login throttling |
| `BCRYPT_COST` | | 12 | Password hashing cost |
| `EMAIL_TRANSPORT` | | `console` | `console` or `smtp` |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | | | SMTP settings |
| `STORAGE_DIR`, `MAX_UPLOAD_MB` | | `./storage`, 5 | Uploaded files (photos, logo) |
| `JOBS_TIMEZONE` | | `Asia/Dubai` | Cron timezone for the worker |
| `AUTH_GOOGLE_ID/SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER` | | | Optional SSO |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run worker` | Background job runner (pg-boss) |
| `npm run lint` / `typecheck` / `format` | ESLint / `tsc --noEmit` / Prettier |
| `npm test` | Unit tests (Vitest) — no database needed |
| `npm run test:integration` | Service-level authorisation tests against the seeded DB |
| `npm run test:e2e` | Playwright end-to-end tests (**reseeds the database** first; set `E2E_SKIP_SEED=1` to skip) |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations + sync the permission catalogue (production) |
| `npm run db:seed` / `db:reset` | Reset & load demo data / drop, migrate and seed |
| `npm run db:sync-permissions` | Upsert the permission catalogue; Super Admin always gets all permissions |

## Testing

```bash
npm test                    # 60 unit tests: IBAN, masking, dates/timezones, tree cycles, permissions, validation, CSV import
npm run db:seed && npm run test:integration   # 23 tests: server-side authorisation & data shaping in services
npm run test:e2e            # 21 browser tests: login, throttling, forced password change, RBAC by URL, CRUD, import, org chart
```

E2E uses the dev server on port 3000 (or starts one); in CI it runs against `npm run start`. The GitHub
Actions workflow in `.github/workflows/ci.yml` runs all of the above against a Postgres service.

## Architecture overview

```
src/app/(auth)        login, forgot/reset password, invite, forced password change
src/app/(app)         authenticated pages (dashboard, directory, org chart, employees, organisation, admin)
src/app/api           Auth.js, file streaming, CSV export/template, health check
src/server/auth       Auth.js config, session → AuthContext, password, tokens, throttling
src/server/rbac       permission catalogue + default roles, team scope (recursive CTE)
src/server/services   business logic — every function takes AuthContext and enforces permissions
src/server/actions    thin Server Actions: parse with Zod → service → revalidate
src/lib               isomorphic helpers & Zod schemas (shared by forms, services and tests)
prisma/               schema, migrations, seed
```

Key rules: authorisation happens in services (not just the UI); every business table carries
`companyId`; sensitive changes are written to `AuditLog` with before/after JSON; calendar dates are
`date` columns, instants are UTC and displayed in the company timezone. Details in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
