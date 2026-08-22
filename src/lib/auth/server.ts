import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

/** Environment variables used by the standalone authentication service. */
export const AUTH_ENV = {
  databaseUrl: "DATABASE_URL",
  baseUrl: "BETTER_AUTH_URL",
  secret: "BETTER_AUTH_SECRET",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
  twitterClientId: "TWITTER_CLIENT_ID",
  twitterClientSecret: "TWITTER_CLIENT_SECRET",
} as const;

export type SocialProviderId = "google" | "twitter";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = env(AUTH_ENV.databaseUrl);
const baseURL = env(AUTH_ENV.baseUrl);
const secret = env(AUTH_ENV.secret);
const googleClientId = env(AUTH_ENV.googleClientId);
const googleClientSecret = env(AUTH_ENV.googleClientSecret);
const twitterClientId = env(AUTH_ENV.twitterClientId);
const twitterClientSecret = env(AUTH_ENV.twitterClientSecret);

function requireCompletePair(label: string, id?: string, clientSecret?: string): void {
  if (Boolean(id) === Boolean(clientSecret)) return;
  throw new Error(
    `[auth] ${label} OAuth requires both its client ID and client secret environment variables.`,
  );
}

/** Validate deployment configuration before constructing the auth service. */
export function validateAuthEnvironment(): void {
  requireCompletePair("Google", googleClientId, googleClientSecret);
  requireCompletePair("X", twitterClientId, twitterClientSecret);

  if (!isProduction) return;
  const missing = [
    [AUTH_ENV.databaseUrl, databaseUrl],
    [AUTH_ENV.baseUrl, baseURL],
    [AUTH_ENV.secret, secret],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `[auth] Missing required production environment variables: ${missing.join(", ")}.`,
    );
  }
  if ((secret?.length ?? 0) < 32) {
    throw new Error("[auth] BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  let parsedDatabaseURL: URL;
  try {
    parsedDatabaseURL = new URL(databaseUrl as string);
  } catch {
    throw new Error("[auth] DATABASE_URL must be an absolute PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsedDatabaseURL.protocol)) {
    throw new Error("[auth] DATABASE_URL must use the postgres or postgresql protocol.");
  }
  let parsedBaseURL: URL;
  try {
    parsedBaseURL = new URL(baseURL as string);
  } catch {
    throw new Error("[auth] BETTER_AUTH_URL must be an absolute URL.");
  }
  if (parsedBaseURL.protocol !== "https:") {
    throw new Error("[auth] BETTER_AUTH_URL must use HTTPS in production.");
  }
}

validateAuthEnvironment();
void ensureDbReady();

const globalAuthState = globalThis as typeof globalThis & {
  __aetherLocalAuthSecret__?: string;
};

function localSecret(): string {
  globalAuthState.__aetherLocalAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthState.__aetherLocalAuthSecret__;
}

const localOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];
const configuredOrigins = (env(AUTH_ENV.trustedOrigins) ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const trustedOrigins = Array.from(
  new Set([...(baseURL ? [baseURL] : []), ...configuredOrigins, ...localOrigins]),
);

const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

const socialProviders = {
  ...(googleClientId && googleClientSecret
    ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
    : {}),
  ...(twitterClientId && twitterClientSecret
    ? { twitter: { clientId: twitterClientId, clientSecret: twitterClientSecret } }
    : {}),
};

export const enabledSocialProviders = Object.keys(socialProviders) as SocialProviderId[];
export const authConfigured = true;

export const auth = betterAuth({
  baseURL: baseURL ?? localOrigins[0],
  secret: secret ?? localSecret(),
  database,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  socialProviders,
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: enabledSocialProviders,
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      httpOnly: true,
    },
  },
  plugins: [tanstackStartCookies()],
});
