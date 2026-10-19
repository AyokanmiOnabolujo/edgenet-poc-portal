# EdgeNet PoC Request Portal

Next.js 14 + Tailwind CSS 3 (frontend) · NestJS 10 (API) · PostgreSQL 16 (database, via TypeORM)

## Run it

1. Start PostgreSQL: `docker compose up -d` (or point `DATABASE_URL` at your own instance).
2. API:
   ```
   cd backend && cp .env.example .env && npm install && npm run start:dev
   ```
   Runs on http://localhost:4000/api. Pending database migrations run automatically on start (see Database migrations).
3. Web:
   ```
   cd frontend && cp .env.local.example .env.local && npm install && npm run dev
   ```
   Opens on http://localhost:3000.

`JWT_SECRET` is required: the API will not start without it, and in production (`NODE_ENV=production`) it refuses the placeholder values. Use a long random value anywhere other than your own machine. Interactive API docs are at http://localhost:4000/api/docs (not served in production unless `API_DOCS=true`).

## First use

Register an Account Manager (one allowed per organisation name). Engineers then register with the same organisation name; they cannot sign in until the Account Manager approves them on the Engineers page. Sign in as the Account Manager to raise requests, add inventory and assign engineers.

## Roles and permissions

Every rule here is enforced by the API (guards and service checks), not only by which buttons the pages show. All data is scoped to the caller's organisation: records from another organisation answer `404`.

| Action | Account Manager | Engineer |
|---|---|---|
| View requests, board, request details, history, checklist, allocations, inventory list | yes | yes |
| Raise a request; assign, reassign or unassign the engineer | yes | no |
| Change a request's stage | any request | only requests assigned to them |
| Cancel an unfinished PoC | yes | no |
| Allocate or release resources on a request | any request | only requests assigned to them |
| Tick decommissioning tasks | any request | only requests assigned to them |
| Add or change inventory | yes | no |
| Engineers page, approve or reject engineers | yes | no |
| Reports (analytics) | yes | no |
| Deadline alerts | all requests | only requests assigned to them |
| Edit or delete audit history | no one | no one |
| Edit own name, email, password | yes | yes |

## Security

- **Joining an organisation:** an engineer registering for an existing organisation is created unapproved, gets no token, and cannot sign in until that organisation's Account Manager approves them (`GET /users/pending`, `PATCH /users/:id/approve`, `DELETE /users/pending/:id`). Accounts created before this existed are approved. A rejected registration is deleted, so the person can try again.
- **Tokens:** signed with `JWT_SECRET`, which has no fallback. Each request re-loads the user, so a token for a deleted or unapproved account stops working.
- **Input:** every body and query is validated by its DTO; unknown fields are stripped, so a request cannot set `role`, `organisation`, `approved`, actor or timestamps. Ids in paths are checked as UUIDs and looked up within the caller's organisation.
- **Errors:** unexpected failures answer `{ statusCode: 500, message: "Internal server error" }` and are logged on the server only; no stack traces or SQL reach the client. Unique-constraint races (two registrations at once) answer `409`.
- **Not covered:** there is no rate limiting on sign-in, and tokens cannot be revoked before they expire (7 days).

## Request workflow

Stage changes are checked on the server (`backend/src/requests/workflow.ts`), so a direct API call cannot skip a step.

| From | Can move to | Needs |
|---|---|---|
| New Request | Infrastructure Provisioning | an assigned engineer |
| Infrastructure Provisioning | In Testing | |
| In Testing | Completed, or back to Infrastructure Provisioning | a reason, when going back |
| New, Provisioning or In Testing | Decommissioned (cancelling the PoC) | Account Manager only, a reason, and the closure checks below |
| Completed | Decommissioned | the closure checks below |
| Decommissioned | nothing (final) | |

Invalid moves return `409`, missing information `400`, and moves by someone other than the Account Manager or assigned engineer `403`. Each request in the API response includes `nextStatuses`, the moves the current user can make, which the board and request page use. A move and its activity entry are saved in one transaction, and a move only applies if the request is still in the stage it was read in, so two people moving the same request at once cannot both succeed.

## Decommissioning checklist

Every request has a checklist, defined in `backend/src/requests/closure.ts`. A request cannot move to Decommissioned, whether it completed or is being cancelled, until every required task is done:

| Task | Required |
|---|---|
| Client told the PoC is ending, and results or handover sent | yes |
| Every allocated resource released | yes, ticks itself when no allocation is active |
| Temporary client access, accounts and credentials removed | yes |
| Client data wiped or returned as agreed | yes |
| Returned equipment checked and back in service | optional |
| Closure notes or report filed | optional |

The Account Manager or the assigned engineer ticks tasks with `PATCH /requests/:id/checklist/:key` (`{ done, notes? }`). Each tick records who and when, repeating a tick or untick changes nothing, and every change goes in the audit trail. The checklist closes once the request is decommissioned. Cancelling is recorded in the audit trail as `cancelled` with the stage it was cancelled from and the reason.

Stage moves, new allocations and checklist ticks all lock the request row for the length of their transaction (`lockRequest` in `closure.ts`), so a request cannot be closed while something is being allocated to it.

## Deadlines and alerts

Start and end dates are calendar dates. The API works out "today" in `APP_TIMEZONE` (default `Africa/Lagos`), so a server running in UTC agrees with the office calendar, and attaches a `deadline` to every request it returns: `{ daysLeft, overdue, dueSoon, lateStart }`.

- **Overdue**: the end date has passed and the request is not Completed or Decommissioned.
- **Due soon**: not overdue, and the end date is today or within `DEADLINE_WARNING_DAYS` days (default 7).
- **Late start**: still a New Request after its start date.
- Completed and Decommissioned requests never alert.

`GET /requests/alerts` lists the alerting requests, most urgent first, with counts: all of them for the Account Manager, only their own assignments for an engineer. The dashboard shows them under "Needs attention", and the dashboard table, board cards and request page show badges. Alerts are in-app only; nothing is emailed. Both settings are checked when the API starts, which refuses to start if either is invalid.

## Analytics (Reports page)

`GET /requests/report` (Account Manager only) aggregates everything in PostgreSQL; nothing is counted in the browser. Definitions, also in `backend/src/requests/report.ts`:

| Metric | Meaning |
|---|---|
| Active | New Request, Infrastructure Provisioning or In Testing |
| Completed | reached Completed: status Completed, or Decommissioned without having been cancelled |
| Cancelled | decommissioned through the Account Manager's cancel path |
| Completion rate | completed ÷ (completed + cancelled); shown as "–" until something has closed |
| Avg. time to complete | days from being raised to the first move to Completed, from the audit trail. Completions recorded before the audit trail had action types are left out rather than guessed |
| Overdue / due soon / not started | the deadline rules above, over active requests |
| Engineer workload | per engineer: requests assigned, active, completed |
| Resource utilisation | units allocated today ÷ capacity, per resource type and unit, over items that are available |

Filters: `from` and `to` (creation date in `APP_TIMEZONE`, inclusive), `engineerId` and `priority`. They apply to every request metric; utilisation is a snapshot of today's inventory and ignores them. `completionRate` used to mean completed ÷ all requests; it now excludes open requests, and is `null` with nothing closed.

## Tests

From `backend/`:

```
npm test               # workflow rules, no database needed
npm run test:db        # start a throwaway PostgreSQL in Docker on port 55433
npm run test:e2e       # full API tests against that database (each test file in its own process)
docker stop edgenet-test-db
```

The end-to-end tests refuse to run unless the database host is `localhost` or `127.0.0.1` (`backend/test/env.ts`), so they cannot touch a deployed database. Override the URL with `TEST_DATABASE_URL`.

## Inventory and resource allocation

The resource requirements on a request record what was **asked for**. Allocations record what has actually been **reserved** from the organisation's inventory.

- **Inventory** (`Inventory` page, Account Manager only): each item has a type, a unit (server, seat, TB…) and a capacity, meaning how many units can be in use on the same day: 1 for an exclusive item such as a physical server, more for a pool such as licence seats. Items can be set to *in maintenance* or *retired* instead of being deleted, so past allocations keep their history. The inventory is maintained by hand; it is not connected to any real infrastructure platform.
- **Allocating** (request page, Account Manager or the assigned engineer, while the request is New, Provisioning or Testing): pick an item, a quantity and dates, which default to the request's start and end dates. Both dates are inclusive, so a booking ending on the 10th clashes with one starting on the 10th but not one starting on the 11th.
- **Conflict check** (server side): the API finds the busiest day in the requested window across the item's active allocations and refuses the booking if the quantity would exceed capacity on any day. It returns `409` with the free amount and the clashing bookings. The item's row is locked (`SELECT … FOR UPDATE`) for the check and insert, so simultaneous requests for the last unit cannot both succeed.
- **Releasing** marks an allocation released, with who and when. Only an active allocation can be released, so repeating the call does nothing but return `409`. Free capacity is always worked out from active allocations, never stored as a counter, so it cannot drift.
- Allocations and releases are written to the audit trail in the same transaction.

## Audit trail

Every significant change to a request writes one row to `activity`: who did it (`actor`, taken from the login token), what happened (`action`: `created`, `status_changed`, `assigned`, `reassigned` or `unassigned`), the previous and new value (`fromValue`/`toValue`: a status, or an engineer's user id), an optional `remarks` (the reason for sending work back) and a server timestamp. The change and its row are saved in the same transaction, so a failed change leaves no row. There is no API to edit or delete these rows. `GET /requests/:id` includes the latest 20 entries and `activityTotal`; `GET /requests/:id/activity` pages through the rest, newest first. Rows written before this existed have `action: null` and keep their original message.

## Database migrations

Schema changes live in `backend/src/migrations` and run in a transaction each time the API starts, so a Render deploy applies them with no extra step. `synchronize` is off: it changed the live schema without review and could drop columns.

- The first migration, `Baseline`, is the schema the app had while it used `synchronize`. On a database that already has the tables (production) it does nothing except record itself; on an empty database it creates them. It refuses to be reverted.
- After changing an entity, generate a migration against a local database that is up to date, then read the SQL before committing it:
  ```
  DATABASE_URL=postgres://...local... npm run migration:generate -- src/migrations/DescribeTheChange
  ```
- Roll back the latest migration with `npm run migration:revert` (with `DATABASE_URL` set). Do this against production only deliberately: a migration's `down` can drop the columns it added.

Timestamps are stored as UTC in `timestamp without time zone` columns; `backend/src/db.ts` makes the pg driver read and write them as UTC so they are right on machines in other time zones.

## API

Full reference with request bodies, roles, error codes and examples: **http://localhost:4000/api/docs** (OpenAPI JSON at `/api/docs-json`). Summary:

`POST /auth/register` `POST /auth/login` `GET /auth/me` ·
`GET /requests/alerts` ·
`GET /requests?status=` `GET /requests/report?from=&to=&engineerId=&priority=` `GET /requests/:id` `GET /requests/:id/activity?page=&limit=` `POST /requests` `PATCH /requests/:id/status` (`{ status, remarks? }`) `PATCH /requests/:id/checklist/:key` `PATCH /requests/:id/assign` ·
`GET /users/engineers` `GET /users/pending` `PATCH /users/:id/approve` `DELETE /users/pending/:id` `PATCH /users/me` `PATCH /users/me/password` ·
`GET /resources?start=&end=` `POST /resources` `PATCH /resources/:id` ·
`GET /requests/:id/allocations` `POST /requests/:id/allocations` `PATCH /requests/:id/allocations/:allocationId/release`

## Notes

- The one-Account-Manager rule is enforced in the service and by a partial unique index in PostgreSQL.
- Everything is scoped by organisation, so separate organisations never see each other's data.
