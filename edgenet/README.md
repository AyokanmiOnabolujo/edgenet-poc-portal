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

Set a long random `JWT_SECRET` in `backend/.env` before deploying anywhere.

## First use

Register an Account Manager (one allowed per organisation name), then register Engineers using the same organisation name. Sign in as the Account Manager to raise requests and assign engineers.

## Roles

| | Account Manager | Engineer |
|---|---|---|
| Requests, board, details, settings | yes | yes |
| Raise a request, assign/reassign engineer | yes | no |
| Engineers page, Reports | yes | no |
| Change a request's stage | any request | only requests assigned to them |

## Request workflow

Stage changes are checked on the server (`backend/src/requests/workflow.ts`), so a direct API call cannot skip a step.

| From | Can move to | Needs |
|---|---|---|
| New Request | Infrastructure Provisioning | an assigned engineer |
| Infrastructure Provisioning | In Testing | |
| In Testing | Completed, or back to Infrastructure Provisioning | a reason, when going back |
| Completed | Decommissioned | |
| Decommissioned | nothing (final) | |

Invalid moves return `409`, missing information `400`, and moves by someone other than the Account Manager or assigned engineer `403`. Each request in the API response includes `nextStatuses`, the moves the current user can make, which the board and request page use. A move and its activity entry are saved in one transaction, and a move only applies if the request is still in the stage it was read in, so two people moving the same request at once cannot both succeed.

## Tests

From `backend/`:

```
npm test               # workflow rules, no database needed
npm run test:db        # start a throwaway PostgreSQL in Docker on port 55433
npm run test:e2e       # full API tests against that database
docker stop edgenet-test-db
```

The end-to-end tests refuse to run unless the database host is `localhost` or `127.0.0.1` (`backend/test/env.ts`), so they cannot touch a deployed database. Override the URL with `TEST_DATABASE_URL`.

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

`POST /auth/register` `POST /auth/login` `GET /auth/me` ·
`GET /requests?status=` `GET /requests/report` `GET /requests/:id` `GET /requests/:id/activity?page=&limit=` `POST /requests` `PATCH /requests/:id/status` (`{ status, remarks? }`) `PATCH /requests/:id/assign` ·
`GET /users/engineers` `PATCH /users/me` `PATCH /users/me/password`

## Notes

- The one-Account-Manager rule is enforced in the service and by a partial unique index in PostgreSQL.
- Everything is scoped by organisation, so separate organisations never see each other's data.
