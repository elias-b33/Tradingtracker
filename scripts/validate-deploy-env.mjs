#!/usr/bin/env node

// Local builds can use PGlite. Hosted builds fail early with an actionable
// configuration error instead of producing a function that crashes at runtime.
if (process.env.VERCEL !== "1") process.exit(0);

const env = (key) => process.env[key]?.trim();
const missing = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"].filter(
  (key) => !env(key),
);

if (missing.length > 0) {
  throw new Error(`Missing required Vercel environment variables: ${missing.join(", ")}.`);
}

const databaseURL = new URL(env("DATABASE_URL"));
if (!["postgres:", "postgresql:"].includes(databaseURL.protocol)) {
  throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
}

const authURL = new URL(env("BETTER_AUTH_URL"));
if (authURL.protocol !== "https:") {
  throw new Error("BETTER_AUTH_URL must be an absolute HTTPS URL.");
}

if (env("BETTER_AUTH_SECRET").length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

for (const [label, idKey, secretKey] of [
  ["Google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["X", "TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
]) {
  if (Boolean(env(idKey)) !== Boolean(env(secretKey))) {
    throw new Error(`${label} OAuth requires both ${idKey} and ${secretKey}.`);
  }
}

console.log("[config] Vercel environment is valid.");
