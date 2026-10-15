# Changelog

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
