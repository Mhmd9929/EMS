# HRMS — Employee Management Portal

A multi-tenant-ready HR portal for UAE companies: employees, org structure, role-based access, audit
trail, leave management and payroll with WPS.

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

## Features (Phase 2 — Leave)

- **Leave types & policies** with every rule editable (UAE defaults pre-loaded), public holiday calendar per
  year and location, policies by department / position / employment type.
- **Apply for leave** with a live working-day count (weekends and holidays excluded), balance-after preview,
  half days, attachments, overlap blocking and a "colleagues also off" warning.
- **Approvals**: manager by default, Manager → HR chains per type, bulk approve, delegation while away,
  reminders and escalation to HR, cancellation requests, email + in-app notifications at every step.
- **Balances** per year (accrued, carried forward, adjustments, expired, taken, pending, available) driven by
  an idempotent ledger and background jobs (monthly accrual, year-end carry-forward, expiry).
- **Calendars & reports**: team / company month calendar, leave taken by department × type, Excel/CSV exports.

### Try the leave flow
1. `employee@` → **Leave → Apply for leave**, pick dates next month, watch the summary, submit.
2. `manager@` → **Approvals** (badge in the sidebar) → open the request → Approve. Or select several and approve in bulk.
3. `employee@` → the bell shows the decision; **My leave** shows the balance moved from pending to taken.
4. `hr@` → **Approvals → All pending** (a Study Leave waits for the HR step), **Leave calendar → Company**,
   **Balances** (adjust with a reason), **Reports**, **Leave settings**.
5. Run `npm run worker` (or the `worker` container) for accruals, reminders and email retries.

## Features (Phase 3 — Payroll)

- **Pay components** (fixed or formula such as `BASIC * 0.5`) and **effective-dated salary structures**
  with full history; one-time monthly **adjustments**.
- **Payroll runs**: Draft → Calculated → Under review → Approved → Released (+ Cancelled), for all employees,
  a department or a location.
  - Pro-rating on a calendar-day or 30-day basis, and automatic unpaid-leave deduction.
  - A review screen with issues and variance vs last month, and hold/exclude with a reason.
  - **Maker-checker** approval; release locks the run, issues payslips and notifies employees.
  - Reopen is Super Admin only.
- **Payslips**: *My payslips*, in-browser view, PDF (net in words, YTD, masked IBAN, optional password).
  Employees only ever see their own released payslips.
- **Exports**: payroll register (Excel), bank transfer CSV, **WPS SIF**.
- **End of service**: gratuity calculator on the employee page and final settlement (unpaid salary + leave
  encashment + gratuity + other − deductions) with maker-checker approval.

### Try the payroll flow
1. `payroll@` → **Payroll runs → New payroll run** (current month) → **Calculate**.
   - Two new joiners have no IBAN: use the status menu to **Hold** them, then **Submit for approval**.
   - As the maker you can't approve the run.
2. `admin@` → open the run → **Approve**. Download the register, WPS SIF or bank CSV.
3. `payroll@` → **Release payroll**.
4. `employee@` → bell notification → **My payslips** → open the month → **Download PDF**.
5. `payroll@` → **Employees → Bilal Chaudhry → Payroll** shows the leaver's final settlement draft.
   - `admin@` approves it from **Final settlements**.
   - **Salaries**, **Adjustments** and **Payroll settings** (components, WPS IDs, gratuity rules, PDF
     password) are in the sidebar.

## Quick start

There are two ways to run the portal:

| Mode | What runs where | Use it for |
|---|---|---|
| **Development** | Postgres + Mailpit in Docker; the Next.js app (and worker) **natively** with `npm run dev` | day-to-day work: instant reloads, fast navigation |
| **Production test** | everything in Docker: `next build` → production server, worker, Postgres, Mailpit | checking real production speed / behaviour with one command |

### Development (app runs natively)

Requirements: **Node.js 22 LTS** (20.9+ works) and Docker Desktop.

One-time setup (PowerShell; macOS/Linux use `cp` instead of `Copy-Item`):

```powershell
git pull
docker compose down --remove-orphans   # only if you ran the old all-in-Docker setup: removes its app/worker containers, keeps your data
docker compose up -d                    # Postgres on localhost:5432, Mailpit on http://localhost:8025
Copy-Item .env.example .env             # defaults already point at the Docker Postgres/Mailpit
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # paste the output into AUTH_SECRET in .env
npm install
npm run db:setup                        # migrations + permissions + demo data (demo data only if the database is empty)
```

Every day:

```powershell
docker compose up -d       # start Postgres + Mailpit (no-op if already running)
npm run dev                # http://localhost:3000  (Turbopack; first visit of each page compiles it, ~1–2 s)
npm run worker             # optional, second terminal: background jobs (accruals, reminders, email retries)
```

Useful extras:

```powershell
npm run db:seed            # ⚠ wipe everything and reload the demo company
docker compose stop        # stop Postgres + Mailpit (data kept)
docker compose down -v     # ⚠ delete the dev database volume
```

The dev server compiles pages on demand, so the very first visit to a page is slower than later ones. That
is normal for `next dev`; use the production mode below to judge real speed. If Turbopack ever misbehaves,
`npm run dev:webpack` runs the classic bundler.

### Production test (everything in Docker, one command)

```powershell
docker compose -f docker-compose.prod.yml up --build -d     # or: npm run docker:prod
```

- App: http://localhost:3000 (stop `npm run dev` first — same port). Mail UI: http://localhost:8026
- The image is built with `next build` and served by Next's production server (multi-stage `Dockerfile`).
  A one-off `migrate` container applies migrations, syncs permissions and seeds demo data **only if the
  database is empty**; the `worker` container runs the background jobs.
- It is a separate Compose project (`hrms-prod`) with **its own database**, so it never touches your dev
  data. Its Postgres is not published on the host, so it can run alongside the dev database.

```powershell
docker compose -f docker-compose.prod.yml logs -f app        # follow the app log
docker compose -f docker-compose.prod.yml up --build -d      # rebuild after pulling new code
docker compose -f docker-compose.prod.yml down               # stop (or: npm run docker:prod:down)
docker compose -f docker-compose.prod.yml down -v            # ⚠ stop and delete the prod-test database
```

Set `SEED=false` before `up` to start with an empty company, and `AUTH_SECRET` to override the built-in
local secret. For a real deployment put the app behind HTTPS and set `APP_URL` to the public URL.

### Email

In development, emails (invites, password resets, leave and payroll notifications) go to Mailpit at
http://localhost:8025. Set `EMAIL_TRANSPORT=console` in `.env` to print them in the terminal instead.
Outside production the "Send invitation" / "Send password reset" buttons also show the link in a toast.

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
Leave data is generated relative to today: last year's leave and carry-forward, this year's accruals and
taken leave, someone on leave today, upcoming leave, 3 requests in the Engineering manager's inbox,
a Study Leave waiting for HR, a cancellation request, and rejected/cancelled history for `employee@`.
Payroll data: salaries by grade with history, one-time adjustments, and **released payroll for every
completed month of the year**. The current month is left for you to run. There is also a draft final
settlement for the scheduled leaver.
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
| `npm run dev` | Next.js dev server with Turbopack (`dev:webpack` for the classic bundler) |
| `npm run build` / `start` | Production build / production server (natively) |
| `npm run docker:dev` | `docker compose up -d`: Postgres + Mailpit for development |
| `npm run docker:prod` / `docker:prod:down` | Build and start / stop the production stack (`docker-compose.prod.yml`) |
| `npm run db:setup` | Apply migrations, sync permissions, seed demo data if the database is empty (safe to re-run) |
| `npm run worker` | Background job runner (pg-boss): accruals, year end, reminders, terminations, email retries. `-- --run-now` runs every job once |
| `npm run lint` / `typecheck` / `format` | ESLint / `tsc --noEmit` / Prettier |
| `npm test` | Unit tests (Vitest) — no database needed |
| `npm run test:integration` | Service-level authorisation tests against the seeded DB |
| `npm run test:e2e` | Playwright end-to-end tests (**reseeds the database** first; set `E2E_SKIP_SEED=1` to skip) |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations + sync the permission catalogue (production) |
| `npm run db:seed` / `db:reset` | Reset & load demo data / drop, migrate and seed |
| `npm run db:sync-permissions` | Upsert the permission catalogue (new permissions go to the matching system roles), create default leave types and current-year accruals for companies missing them. Safe on every deploy |

## Testing

```bash
npm test                    # 107 unit tests: payroll engine (pro-rata, unpaid leave, adjustments, formulas), gratuity, SIF, leave rules, IBAN, masking, permissions, validation, CSV import
npm run db:seed && npm run test:integration   # 50 tests: server-side authorisation, payslip isolation, maker-checker, run lifecycle, leave rules, approval chains, jobs
npm run test:e2e            # 33 browser tests: login, RBAC by URL, CRUD, import, org chart, leave apply → approve → balance, payroll run → approve → release → payslip PDF, payslip isolation
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
