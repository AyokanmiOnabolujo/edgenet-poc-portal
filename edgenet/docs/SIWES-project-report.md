# EdgeNet PoC Request and Resource Lifecycle Management System

SIWES industrial training project report: technical summary, test results and demonstration guide.

> **Status of claims in this document.** Everything described under "What was built" is implemented in this repository and covered by the automated tests listed in section 6. The inventory is entered by hand and is **not** connected to real infrastructure. The business rules marked *assumed* were chosen for this project and confirmed by the student; they are not a description of how EdgeNet actually runs PoCs. Nothing here claims that EdgeNet has adopted the system or that it has changed any operational result.

## 1. The business problem

An infrastructure and integration company runs **proof-of-concept (PoC) engagements** for prospective clients: an Account Manager agrees a trial with a client, engineers provision servers, storage, networking and licences for it, the client tests, and the kit is then taken back.

The original portal recorded requests and let anyone move them between stages. It could not answer the questions that matter when several PoCs compete for the same equipment:

- Is this request allowed to move to the next stage yet, and who moved it?
- Which equipment is actually reserved for it, and is that equipment already promised to someone else on those dates?
- Has everything been handed back and cleaned up before the PoC is closed?
- Which PoCs are late or about to be, and how is the pipeline performing?
- Can someone outside the team see client data?

*Assumed:* the stages (New Request → Infrastructure Provisioning → In Testing → Completed → Decommissioned), that an unfinished PoC can be cancelled by the Account Manager, and the content of the closure checklist.

## 2. Architecture

| Layer | Technology | Notes |
|---|---|---|
| Web app | Next.js 14 (App Router), React 18, Tailwind CSS 3 | Client components calling the API with `fetch`; no extra state library |
| API | NestJS 10 (TypeScript) | Modules: `auth`, `users`, `requests`, `resources` |
| Database | PostgreSQL 16 via TypeORM 0.3 | Schema managed by versioned migrations |
| Auth | JWT (passport-jwt), bcrypt password hashes | Two roles: Account Manager, Engineer |
| Docs | OpenAPI (Swagger) at `/api/docs` | Generated from the real controllers and DTOs |
| Tests | Jest, `@nestjs/testing`, supertest | End-to-end tests against a disposable PostgreSQL in Docker |

The project was previously deployed as Vercel (web), Render (API) and Neon (PostgreSQL). The repository contains no deployment configuration, so that setup was not inspected or changed; see section 7 for what a deployment needs.

### What was there before, and what changed

| Area | Before | After |
|---|---|---|
| Stage changes | Any stage to any stage | Fixed workflow enforced by the API, with required information per move |
| History | Free-text log lines | Typed audit trail (actor, action, old/new value, reason, server time), paged |
| Resources | A list of what was requested | Inventory, allocations with clash detection, release |
| Closing a PoC | Just a status change | Checklist that must be completed, cancellation path |
| Deadlines | Dates stored, never checked | Overdue / due soon / not started, in the company time zone |
| Reports | Counts computed in application memory | SQL aggregation with filters, new metrics |
| Joining | Anyone who typed an organisation's name was in | Engineers need the Account Manager's approval |
| Schema | `synchronize: true` (automatic, unreviewed) | Migrations, run on start-up in a transaction |
| Tests / API docs | None | 67 automated tests; OpenAPI docs |

## 3. Database

```
users ──< poc_requests (createdBy, assignedEngineer)
users ──< activity (actor)            poc_requests ──< activity
poc_requests ──< allocations >── inventory_resources
poc_requests ──< decommission_checks >── users (completedBy)
```

| Table | Purpose | New? |
|---|---|---|
| `users` | Accounts; `role`, `organisation`, `approved` | existing; `approved` added |
| `poc_requests` | Client, project, dates, priority, status, requested resources (JSON) | existing, unchanged |
| `activity` | Audit trail | existing; `action`, `fromValue`, `toValue`, `remarks` added |
| `inventory_resources` | Lendable items with a unit and a capacity | new |
| `allocations` | A quantity of an item reserved for a request over inclusive dates | new |
| `decommission_checks` | Ticked closure tasks | new |

Constraints in the database itself: one Account Manager per organisation (partial unique index), unique email, capacity ≥ 1, quantity ≥ 1, allocation end ≥ start, one tick per task per request. All migrations only **add** tables, columns or indexes; existing rows are untouched and older activity rows remain readable.

## 4. Features and their business logic

### 4.1 Controlled workflow and audit trail
- One table in `requests/workflow.ts` defines every allowed move. The API rejects anything else with `409`, missing information with `400` (no engineer assigned before provisioning; no reason when sending work back from testing or cancelling), and moves by the wrong person with `403`.
- The API tells the pages which moves the current user may make (`nextStatuses`), so the Board and the request page only offer valid choices; the rule is never duplicated in the browser.
- A move and its audit row are written in **one transaction**. The request row is **locked** during the move, so two people moving the same request at the same moment cannot both succeed, and a failed move leaves no audit row.
- Actor and time come from the server; values sent by the browser are ignored.

### 4.2 Resources, clash detection and release
- The Account Manager keeps an inventory. Capacity counts units usable on the same day: 1 for an exclusive item such as a server, more for pools such as licence seats.
- When allocating, the API finds the **busiest day** in the requested window across existing bookings, not the sum of all overlapping bookings (two bookings that each overlap the window but not each other never use capacity together). Dates are inclusive.
- The item's row is locked for the check and the insert, so simultaneous bookings of the last unit cannot both succeed.
- Free capacity is always calculated from active allocations rather than stored as a counter, so it cannot drift out of step. Releasing only applies to active allocations, so it cannot happen twice.

### 4.3 Decommissioning
- Every request has a checklist: client informed, access removed, data handled (required, ticked by hand), all resources released (required, derived automatically), equipment checked and closure report (optional).
- Decommissioned is refused until every required task is done, whether the PoC completed or was cancelled. Cancellation is recorded as such, with the reason and the stage it was cancelled from.

### 4.4 Deadlines and analytics
- Overdue: past the end date and not Completed/Decommissioned. Due soon: within 7 days (configurable). Not started: still new after its start date. "Today" is the date in Africa/Lagos, because the server runs in UTC.
- Reports are aggregated by PostgreSQL and can be filtered by creation date, engineer and priority. Definitions: see the README "Analytics" table. The completion rate is completed ÷ (completed + cancelled).

### 4.5 Security
- Engineer approval, required `JWT_SECRET`, input validation with unknown fields stripped, organisation scoping on every query, generic error messages, and `409` instead of a server error when a duplicate slips past the checks. The full permission matrix is in the README.

## 5. Key technical decisions (for questions from assessors)

| Decision | Why | Alternative considered |
|---|---|---|
| Workflow as a single transition table on the server | One place to read and change the rules; the UI cannot bypass it | Checks spread across UI components |
| Row locks (`SELECT … FOR UPDATE`) for moves, allocations and ticks | Simple, correct under concurrency, supported by PostgreSQL | Optimistic retries; serializable isolation |
| Free capacity derived, not stored | A stored counter can drift if any write path forgets to update it | `available` column decremented on allocate |
| "Busiest day" capacity check | Summing overlaps wrongly rejects valid bookings | Sum of overlapping quantities |
| Migrations instead of `synchronize` | Reviewed, versioned, reversible; synchronize can drop columns in production | Keep synchronize |
| Baseline migration that skips existing tables | Production already had the schema; the baseline records itself there without touching data | Hand-editing the production migrations table |
| Dates as calendar dates, "today" in a configured time zone | Start/end have no time of day; the server's clock is UTC | Server-local dates |
| Engineer approval | Closes the hole where knowing an organisation's name gave access to client data | Invite codes |
| End-to-end tests on a disposable database | Exercises guards, validation, SQL and transactions together; cannot touch production | Mocked unit tests only |

## 6. Automated tests and results

Run on 19 October 2026 on the student's machine (Windows, Node 24, PostgreSQL 16 in Docker):

| Suite | Tests | Result |
|---|---|---|
| Unit: workflow rules, capacity calculation, deadline rules, secret checks | 20 | all passed |
| End-to-end: existing behaviour and workflow (`requests`) | 14 | all passed |
| End-to-end: inventory, allocation, conflicts, release (`resources`) | 10 | all passed |
| End-to-end: checklist, cancellation, close-vs-allocate race (`closure`) | 7 | all passed |
| End-to-end: deadline alerts (`deadlines`) | 3 | all passed |
| End-to-end: analytics and filters (`report`) | 5 | all passed |
| End-to-end: approval, tokens, protected fields, duplicate races (`security`) | 8 | all passed |
| **Total** | **67** | **all passed** |

The concurrency protections were checked by temporarily removing each lock and widening the timing window: without the lock, double bookings (10 of 40 attempts) and a decommissioned request still holding a resource (3 of 3 runs) occurred; with the lock, neither did. The committed tests run at normal speed and would not on their own detect a removed lock.

Both production builds (`nest build`, `next build`) succeed. The pages were also checked by hand in a browser against a local test database.

## 7. Known limitations and future work

- **Inventory is manual and simulated.** It is not linked to any virtualisation, storage or licensing platform.
- **No email or scheduled notifications.** Alerts are in-app only.
- **No rate limiting on sign-in; tokens cannot be revoked** before their 7-day expiry.
- **Average processing time** ignores completions recorded before the audit trail had typed actions.
- **The board's request list and the dashboard summary cards** load all requests of the organisation; fine at PoC scale, would need paging for thousands.
- **Deployment not verified.** Before deploying this branch: set `JWT_SECRET` on Render (the API will not start without it), and expect the migrations to run once against Neon on the first start. A `pg_dump --schema-only` comparison with the baseline migration is recommended first.
- Future: per-organisation working calendars, partial releases, approval audit log, request editing after creation, search by text.

## 8. Demonstration script (fictional data)

Use a local database (`npm run test:db`, then run the API with `DATABASE_URL` pointing at it) and fictional names only.

1. Register **Amaka Obi**, Account Manager, organisation *Demo Networks*. Register **Emeka Eze** as an Engineer for *Demo Networks*: show that he cannot sign in. As Amaka, approve him on the Engineers page.
2. Inventory: add *Dell R750 #1* (Physical server, unit server, capacity 1) and *Splunk evaluation* (Software licence, unit seat, capacity 3).
3. Raise *Edge cache PoC* for *Client Ltd*, 1–30 November, high priority. Try to move it to Provisioning: blocked until an engineer is assigned. Assign Emeka, move it.
4. Allocate the server for 1–30 November. Raise *Rival PoC* for 10–20 November and try to allocate the same server: show the clash message naming Edge cache PoC. Allocate 2 licence seats instead.
5. As Emeka, move Edge cache PoC to Testing, then back to Provisioning: a reason is required and appears in the history.
6. Complete it. Try Decommissioned: refused, with the open tasks listed. Tick the tasks, release the server (the resources task ticks itself), then decommission.
7. Cancel *Rival PoC* as Amaka with a reason; show the cancellation in its history.
8. Raise a PoC whose end date has passed: show the "Needs attention" panel and badges. Open Reports and use the filters.
9. Open http://localhost:4000/api/docs and show the documented endpoints.

## 9. Suggested screenshots

1. Board with only valid moves offered and a blocked move explained.
2. Request page: history timeline with a rework reason.
3. Inventory page.
4. Allocation clash message listing the conflicting booking.
5. Decommissioning checklist, before and after completion.
6. Dashboard "Needs attention" panel with overdue and due-soon badges.
7. Reports page with filters applied.
8. Engineers page with a pending approval.
9. Swagger UI at `/api/docs`.
10. Terminal showing the test run summary.
