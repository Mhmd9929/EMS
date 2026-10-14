# Changelog

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
