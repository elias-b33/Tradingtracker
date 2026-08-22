import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { readAuthConfiguration } from "./config";
import { pgliteDialect } from "./pglite-dialect";

const isProduction = process.env.NODE_ENV === "production";
const authConfig = readAuthConfiguration(process.env, { production: isProduction });
void ensureDbReady();

const globalAuthState = globalThis as typeof globalThis & {
  __aetherLocalAuthSecret__?: string;
};

function localSecret(): string {
  globalAuthState.__aetherLocalAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthState.__aetherLocalAuthSecret__;
}

const localOrigins = ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"];
const trustedOrigins = Array.from(
  new Set([
    ...(authConfig.baseURL ? [authConfig.baseURL] : []),
    ...authConfig.trustedOrigins,
    ...localOrigins,
  ]),
);

const database = authConfig.databaseUrl
  ? new Pool({ connectionString: authConfig.databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

const socialProviders = {
  ...(authConfig.google
    ? {
        google: {
          clientId: authConfig.google.clientId,
          clientSecret: authConfig.google.clientSecret,
        },
      }
    : {}),
};

export const googleAuthEnabled = Boolean(authConfig.google);
export const authConfigured = true;

export const auth = betterAuth({
  baseURL: authConfig.baseURL ?? localOrigins[0],
  secret: authConfig.secret ?? localSecret(),
  database,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  socialProviders,
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: googleAuthEnabled ? ["google"] : [],
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
