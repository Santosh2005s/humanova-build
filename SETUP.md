# Humanova PostgreSQL Setup (Windows)

## Prerequisites

Install Node.js 20 or newer and PostgreSQL 15 or newer. During the PostgreSQL Windows installer setup, include pgAdmin or SQL Shell (`psql`). Start the PostgreSQL service from Windows Services if it is not already running.

Create a local database and role from SQL Shell or pgAdmin:

```sql
CREATE ROLE humanova WITH LOGIN PASSWORD 'REPLACE_WITH_A_LOCAL_PASSWORD';
CREATE DATABASE humanova OWNER humanova;
```

## Configure environment

Copy `.env.example` to `.env` in the project root. Set `DATABASE_URL` to the local PostgreSQL connection, for example:

```env
DATABASE_URL="postgresql://humanova:REPLACE_WITH_A_LOCAL_PASSWORD@localhost:5432/humanova?schema=public"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

Use a URL-encoded password if it contains reserved URL characters. `.env` is ignored by Git. `DATABASE_URL` and `GEMINI_API_KEY` are read by the Express server only; neither is sent to browser code.

## Install, migrate, seed, and run

From PowerShell in `humanova-build-main`:

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` applies the checked-in Prisma migration and may prompt for a development migration name if the schema has changed. For a deployed environment, use `npm run db:deploy` instead. The seed is idempotent and inserts sample resources and volunteer profiles only; it does not create requests, assignments, or completed outcomes.

Open the URL printed by the server. The app loads requests, resources, volunteers, and metrics from `/api/state`. If PostgreSQL is unavailable, the UI reports the backend error and does not fall back to localStorage.

## Checks

```powershell
npm test
npm run lint
npm run build
```

Database integration tests run when `DATABASE_URL` points to a reachable database. Without PostgreSQL, they report a skip and the API's database-failure behavior is tested separately.

## Security scope

The API has basic rate limiting and input validation, but it currently has no authentication or authorization. Do not expose it publicly or use it for real recipient/volunteer data until an identity, role, and access-control system is implemented and reviewed.
