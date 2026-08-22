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
5. Optionally configure Google sign-in using the instructions below. Google is
   enabled only when both credentials are present; incomplete or malformed
   credentials are rejected. Email/password remains available without Google.
6. Add the two Alpaca keys for batch U.S. IEX snapshots, or `FINNHUB_API_KEY`
   as a per-symbol fallback with cached company profiles/logos. Worldwide symbols continue to use Yahoo exchange
   data, with provider timestamps and any declared exchange delay shown in-app.
   The app still launches without an optional quote-provider key.
7. Deploy. Vercel runs `npm run build`, validates the hosted configuration, and
   applies pending database migrations.

### Enable Google sign-in

1. In Google Cloud Console, configure the OAuth consent screen. While it is in
   testing mode, add every account that should be able to sign in as a test user.
2. Create an OAuth 2.0 Client ID with application type **Web application**.
3. Add this authorized JavaScript origin exactly:
   `https://tradingtracker.vercel.app`
4. Add this authorized redirect URI exactly:
   `https://tradingtracker.vercel.app/api/auth/callback/google`
5. In the Vercel project's Production environment variables, add the client ID
   as `GOOGLE_CLIENT_ID` and the client secret as `GOOGLE_CLIENT_SECRET`.
6. Redeploy after saving the variables. The login page exposes the Google button
   only when both variables pass validation.

The callback is derived by Better Auth from `BETTER_AUTH_URL`; it is documented
above for the Google Cloud allowlist and is not hardcoded in application logic.
Apple sign-in is intentionally inactive, so no Apple Developer configuration is
needed. Email/password sign-in remains enabled independently.

## Quality checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The generated `.vercel` directory is intentionally ignored. Vercel should build
it from the current source on every deployment.
