# Aether Trading Terminal

Aether is a standalone market terminal with crypto and stock charts, watchlists,
alerts, news, technical indicators, portfolio tracking, and optional account sync.

## Local development

Requirements: Node.js 22 and npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

For local-only use, `DATABASE_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`
may be left unset. Aether uses a local PGlite database and runs at
`http://localhost:8080`. Never commit `.env`.

## Deploy to Vercel

The Vercel project is connected directly to GitHub. Every push to `main`
creates a versioned Production deployment; application secrets remain in
Vercel's encrypted environment settings and are never committed.

1. Create a PostgreSQL database, such as Neon, and copy its connection URL.
2. Import this directory into Vercel.
3. Add these Production environment variables:
   - `DATABASE_URL`
   - `BETTER_AUTH_URL` set to the final HTTPS origin, with no path
   - `BETTER_AUTH_SECRET` set to a unique random value of at least 32 characters
4. Optionally add `BETTER_AUTH_TRUSTED_ORIGINS` as a comma-separated list.
5. Optionally configure Google or X sign-in. Each provider requires both values
   from its pair in `.env.example`; incomplete pairs are rejected.
6. Add either `FINNHUB_API_KEY` or the two Alpaca keys for a supported stock
   quote feed. Without one, stock quotes fall back to Yahoo's public endpoint.
7. Deploy. Vercel runs `npm run build`, validates the hosted configuration, and
   applies pending database migrations.

The OAuth callback paths are `/api/auth/callback/google` and
`/api/auth/callback/twitter`, appended to `BETTER_AUTH_URL`.

## Quality checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The generated `.vercel` directory is intentionally ignored. Vercel should build
it from the current source on every deployment.
