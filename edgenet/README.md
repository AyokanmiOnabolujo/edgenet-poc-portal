# EdgeNet PoC Request Portal

Next.js 14 + Tailwind CSS 3 (frontend) · NestJS 10 (API) · PostgreSQL 16 (database, via TypeORM)

## Run it

1. Start PostgreSQL: `docker compose up -d` (or point `DATABASE_URL` at your own instance).
2. API:
   ```
   cd backend && cp .env.example .env && npm install && npm run start:dev
   ```
   Runs on http://localhost:4000/api. Tables are created automatically on first start.
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

## API

`POST /auth/register` `POST /auth/login` `GET /auth/me` ·
`GET /requests?status=` `GET /requests/report` `GET /requests/:id` `POST /requests` `PATCH /requests/:id/status` (`{ status, remarks? }`) `PATCH /requests/:id/assign` ·
`GET /users/engineers` `PATCH /users/me` `PATCH /users/me/password`

## Notes

- `synchronize: true` in `backend/src/app.module.ts` auto-syncs the schema. Switch to TypeORM migrations before production.
- The one-Account-Manager rule is enforced in the service and by a partial unique index in PostgreSQL.
- Everything is scoped by organisation, so separate organisations never see each other's data.
