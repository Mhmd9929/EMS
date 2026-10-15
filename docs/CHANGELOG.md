# Changelog

## Unreleased — HSA rebrand (UI only)

### Changed
- **Brand theme**: `src/theme/brand.ts` is the single source of the HSA palette:
  - gold `#D9B300`, bright `#FCC917`, dark `#8A6F00`, black `#0A0A0A`, charcoal `#1C1C1C` and neutral greys;
  - semantic light and dark tokens, injected as CSS variables and mapped to Tailwind/shadcn utilities.
  - No hard-coded colours remain in components (leave-type colours are user data).
- **Contrast**: a unit test checks 83 text/background pairs for WCAG AA.
  - Adjustments made to pass: light-grey surfaces `#FAFAFA` and gold tint `#FDFAEE`, so `#8A6F00` stays at
    4.5:1 or more on them; success text `#166534`; warning text `#B13A0B`, which is orange and distinct from
    the gold.
  - Gold text on white now uses `text-link` (`#8A6F00`).
  - The two-tone focus ring (bright gold plus a dark inner ring) is visible on white.
- **Layout**:
  - Black sidebar with a gold active state and charcoal hover. It collapses to an icon rail, and the choice
    is remembered.
  - Black header (or white with a gold border, set by `HEADER_STYLE`).
  - Split login and auth pages: a black panel with the logo and gold waves next to the white form.
  - Gold accent on page headings, tabs, checkboxes, badges and the payroll stepper.
- **Documents**:
  - The payslip PDF has a black band with the full logo, a gold accent line and gold table headers.
  - Emails have a black header with the inline logo, a gold accent line and gold buttons.
- **Fonts**: self-hosted Inter and IBM Plex Sans Arabic.
- **Title and favicon**: "HSA Employee Portal" and `/brand/favicon.ico`. Brand assets are exempt from the
  auth middleware, so they load on the login page.
- Left/right CSS classes were converted to logical start/end equivalents (groundwork for Arabic RTL). There
  is no visual change in English.

## Unreleased — development setup

### Changed
- **Development runs natively.** `docker-compose.yml` now starts only Postgres and Mailpit. The app runs with
  `npm run dev`, which now uses Turbopack: a page's first visit takes about 1–2 s instead of 10 s or more
  with webpack. `npm run dev:webpack` keeps the old bundler.
- `.env.example` defaults match the Docker services (Mailpit SMTP by default). There is a new
  `npm run db:setup` (migrate, sync permissions, seed only if empty).
- Mailpit is pinned to `v1.29` instead of `latest`.

### Added
- **`docker-compose.prod.yml`**: the full stack in production mode (`next build` image, migrate job, worker,
  Postgres, Mailpit on :8026) as a separate Compose project with its own database. Start it with
  `docker compose -f docker-compose.prod.yml up --build -d` or `npm run docker:prod`.

### Upgrade notes
- If you used the old all-in-Docker setup, run `docker compose down --remove-orphans` once. Your database
  volume is kept and is reused by the new dev setup.

## Checkpoint 3 — Payroll (Phase 3)

### Added
- **Data model** (migrations `payroll`, `payslip_password`): PayComponent, SalaryStructure (+ lines),
  PayrollAdjustment, PayrollRun, PayrollRunEmployee (snapshot), PayrollRunLine, Payslip, FinalSettlement.
  Company gains payroll, WPS and gratuity settings; Employee gains `bankRoutingCode`; LeaveType gains `isEncashable`.
- **Pay components** (Payroll → Settings): earnings and deductions, fixed or formula (`BASIC * 0.5`,
  `min(...)`), monthly or one-time, taxable and WPS fixed/variable flags. UAE-style defaults are pre-loaded.
- **Salaries**: effective-dated structures with full history on the employee's Payroll tab, scheduled
  changes, and a company-wide salary list (search, department filter, "no salary yet" filter, sorting).
- **One-time adjustments** per month (bonus, overtime, reimbursement, loan recovery, other deductions).
  They lock once the month is released.
- **Payroll runs**:
  - Lifecycle: Draft → Calculated → Under review → Approved → Released, plus Cancelled.
  - Scope: all employees, one department or one location.
  - Pro-rating: calendar-day or 30-day basis; joiners, leavers and mid-month raises.
  - Automatic unpaid-leave deduction from approved leave.
  - Review screen with issues, a ≥ 20% variance view vs last month, hold/exclude with a reason, and a
    per-employee breakdown.
  - Maker-checker approval, with send-back.
  - Release creates payslips and notifies employees.
  - Super-Admin reopen voids payslips and requires a reason.
- **Payslips**:
  - *My payslips* page and an in-browser view.
  - PDF with logo, company and employee details, period, earnings and deductions, net in figures and
    words, YTD and a masked IBAN.
  - Optional AES-256 password, the date of birth as DDMMYYYY.
  - Visible only to the employee, and only once released.
- **Exports**: payroll register (Excel), bank transfer CSV, and WPS SIF (`UAE_SIF_V1`, configurable format
  registry; problems are listed instead of producing a bad file).
- **End of service**:
  - Configurable gratuity (21/30 days, 5-year threshold, 24-month cap, 1-year minimum, unpaid leave
    excluded) and leave encashment of encashable types.
  - Final settlement = unpaid salary + encashment + gratuity + other − deductions, with a maker-checker
    approval. There is an estimate for current employees and a Final settlements page listing leavers
    who still need one.
- **Dashboard**: latest payslip card for everyone; current-month run status for payroll users.
- **Demo data**: salaries by grade with history (raises on 1 Apr and some mid-month on 16 Jul), adjustments,
  released runs for every completed month of the year (prepared by payroll@, approved by admin@), unpaid leave
  in August for one employee, and a draft settlement for the scheduled leaver.

### Security
- Every payroll service checks permissions. HR, managers and employees get Forbidden on salaries, runs,
  exports and settlements; another person's payslip is a 404, also for their manager.
- Salary figures are rendered only in server components behind `payroll.salary.read`, so they are not in
  the page payload for other roles.
- Payslip and export downloads by payroll staff are audited. Run actions, salary changes, adjustments,
  settings and settlements write before/after audit entries.

### Tests
- Unit: money (minor units, 3-decimal currencies), safe formula parser, pay calculation (full month, joiner,
  leaver, 30-day basis, segments, unpaid leave and its cap, adjustments, negative net), gratuity, amount in
  words, SIF, permissions.
- Integration (14): payslip isolation, salary authorisation, unpaid-leave deduction, lifecycle guards,
  maker-checker, release issues payslips, adjustments locked after release, reopen voids and re-release
  restores, settlement maker-checker and figures.
- E2E (4):
  - payroll@ creates, calculates and holds blocked employees, submits, and cannot approve.
  - admin@ approves; payroll@ downloads the register and SIF, then releases.
  - The employee views the payslip and downloads the PDF.
  - The employee gets a 404 on someone else's payslip and PDF, a 403 on payroll pages and exports.

### Upgrade notes
- `docker compose up --build` applies the migrations; `db:sync-permissions` grants the payroll permissions
  to the existing system roles and creates the default pay components. Existing employees have no salary
  until one is added (the run flags them). To get the full payroll demo data, reset the database:
  `docker compose down -v && docker compose up --build`.

## Checkpoint 2 — Leave management (Phase 2)

### Added
- **Data model**: LeaveType, LeavePolicy, LeaveLedgerEntry, LeaveRequest, LeaveRequestDay, LeaveApproval,
  ApprovalDelegation, Notification (migration `leave_management`).
- **Configuration (HR)** — Leave → Settings: leave types with every rule editable (entitlement, upfront vs
  monthly accrual, eligibility after N months, pro-rating, carry-forward cap and expiry, max days per request,
  document threshold, notice, half days, negative balance, gender, weekends/holidays counted, paid/unpaid,
  approval chain); policies by department/position/employment type; public holidays per year and location
  (multi-day entry, copy from previous year); escalation threshold.
- **UAE defaults** (editable, flagged "UAE default"): Annual (30 days, 2.5/month after 6 months, carry 10 days
  expiring after 3 months), Sick, Maternity, Paternity, Bereavement, Hajj (unpaid), Study, Unpaid.
- **Self-service**: apply with live working-day calculation, per-year split and balance-after preview,
  half days, reason, attachment (PDF/PNG/JPG/WebP ≤ 5 MB); overlap blocking; colleagues-off warning;
  My leave page (balances per year with entitled/accrued/carried/adjusted/expired/taken/pending/available,
  request history with filters); withdraw pending requests; request cancellation of approved leave.
- **Approvals**: line manager by default, configurable Manager → HR chains per type, approver inbox with bulk
  approve/reject (comment required to reject), HR "all pending" view, delegation while away, HR direct cancel,
  maker-checker (nobody approves their own leave), optimistic locking against double decisions.
- **Notifications**: in-app bell + notifications page; emails for every step via an outbox retried by the worker.
- **Views**: month leave calendar (my team / my reports / company with department filter; pending striped;
  weekends and holidays shaded); all/team requests list; HR balances table with audited manual adjustments;
  reports by department × type for any period; balance and report exports to Excel and CSV.
- **Jobs**: monthly accrual, year-end close (carry forward/lapse), daily carry-forward expiry and ON_LEAVE
  status sync, weekday escalation reminders (escalating manager steps to HR), email outbox.
- **Integration**: employee page Leave tab, dashboard leave balances, approvals waiting and "off today";
  `unpaidLeaveDays()` ready for payroll.
- **Upgrade path**: `db:sync-permissions` grants new permissions to system roles on existing databases and
  bootstraps leave types and current-year accruals (verified against a Phase 1 database).
- **Tests**: +26 unit tests (day counting incl. weekends/holidays/half days/year boundaries/leap years,
  accrual, carry-forward, policies), +13 integration tests (authorisation, rules, chains, delegation,
  cancellation, idempotent jobs, escalation, unpaid days), +8 e2e tests (apply → approve → balance updated,
  bulk approve, delegation, HR adjustments, access control).

### Changed
- Permission helpers moved to framework-free `src/server/auth/permissions.ts` so services run in the worker and scripts.
- Seed, worker and permission sync run with `tsx --conditions=react-server`.
- Request visibility for managers is limited to their own (direct + indirect) team.

## Checkpoint 1 — Foundation (Phase 1)

### Added
- **Project scaffold**: Next.js 15 App Router (TypeScript strict), Tailwind v4 + vendored shadcn/ui
  components, light/dark mode, next-intl (English; RTL-ready `dir` handling), Prisma 6 + PostgreSQL,
  Docker Compose (app, worker, Postgres, Mailpit), GitHub Actions CI.
- **Data model** (`prisma/schema.prisma`): Company, User, Role/Permission/RolePermission/UserRole,
  AuthToken, LoginAttempt, Department (self-referencing), Position, Location, Employee
  (self-referencing manager), EmergencyContact, PublicHoliday, AuditLog.
- **Authentication**: credentials login, logout, forgot/reset password, invite → set password,
  forced first-login password change, idle (rolling) + absolute session timeouts, server-side session
  revocation via `sessionVersion`, DB-backed login throttling (per email and per IP), optional
  Google / Microsoft Entra ID SSO for existing users, termination blocks login after the last working day.
- **RBAC**: permission catalogue stored in DB, five seeded system roles, multi-role users, custom
  roles editor with permission matrix, team scope (direct + indirect reports via recursive CTE),
  per-audience DTOs with masking of IBAN / Emirates ID / passport / visa / labour card numbers.
- **Company & organisation**: company settings (logo upload, address, currency, timezone, work week,
  fiscal year start, employee-number prefix/padding); departments (unlimited depth, head, cost centre,
  cycle prevention, table + tree views); positions with grade/level; locations.
- **Employees**: list with search/sort/filter/pagination and CSV export; create/edit form (personal,
  job, UAE identity documents, WPS bank details with IBAN validation); auto-generated employee numbers;
  reporting-line cycle prevention; tabbed detail page (Overview, Job, Documents, Leave, Payroll) gated
  server-side; termination (scheduled or immediate) and cancellation; CSV bulk import with dry-run
  validation report (codes, duplicates, in-file managers, loop detection), all-or-nothing commit.
- **Self-service**: profile page, contact details, emergency contacts (max 5), profile photo
  (magic-byte sniffed PNG/JPG/WebP, 2 MB), change password (signs out other sessions).
- **Directory & org chart**: card/table directory (non-sensitive fields only); interactive org chart
  (zoom/pan/fit, expand/collapse, search & focus, person cards, reporting-line vs department view).
- **Admin**: users & access (role assignment, invite/reset, sign out everywhere, enable/disable),
  roles & permissions, audit log viewer (filters by user, entity, date range; before/after diffs),
  dashboards for HR (headcount, joiners/leavers, pending invites, probation ending, expiring documents),
  managers (team) and employees (holidays; leave/payslip placeholders).
- **Background jobs**: pg-boss worker with a daily job applying due terminations.
- **Seed**: Falcon Gulf Trading LLC — 14 departments, 27 positions, 3 locations, 43 employees on 4
  levels, demo users per role, UAE public holidays 2026–27.
- **Tests**: 60 unit tests, 23 DB-backed authorisation tests, 21 Playwright e2e tests.
- **Security**: CSP and secure headers, Server Action origin checks, open-redirect-safe callbacks,
  CSV formula-injection escaping on export, uploads stored outside `public/` and streamed with
  authorisation, privilege-escalation guards on role assignment.
