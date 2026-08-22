export const AUTH_ENV = {
  databaseUrl: "DATABASE_URL",
  baseUrl: "BETTER_AUTH_URL",
  secret: "BETTER_AUTH_SECRET",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
} as const;

export type AuthEnvironment = Record<string, string | undefined>;

export type AuthConfiguration = {
  databaseUrl?: string;
  baseURL?: string;
  secret?: string;
  trustedOrigins: string[];
  google?: {
    clientId: string;
    clientSecret: string;
  };
};

function value(source: AuthEnvironment, key: string): string | undefined {
  return source[key]?.trim() || undefined;
}

function parseURL(raw: string, name: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new Error(`[auth] ${name} must be an absolute URL.`);
  }
}

function parseOrigin(raw: string, name: string): string {
  const parsed = parseURL(raw, name);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error(
      `[auth] ${name} must contain an origin only, without credentials, path, query, or hash.`,
    );
  }
  return parsed.origin;
}

/** Derive the Better Auth Google callback from the configured public origin. */
export function googleCallbackURL(baseURL: string): string {
  return new URL("/api/auth/callback/google", `${parseOrigin(baseURL, AUTH_ENV.baseUrl)}/`).href;
}

/** Parse and validate standalone auth configuration. */
export function readAuthConfiguration(
  source: AuthEnvironment,
  options: { production: boolean },
): AuthConfiguration {
  const databaseUrl = value(source, AUTH_ENV.databaseUrl);
  const baseURLRaw = value(source, AUTH_ENV.baseUrl);
  const secret = value(source, AUTH_ENV.secret);
  const googleClientId = value(source, AUTH_ENV.googleClientId);
  const googleClientSecret = value(source, AUTH_ENV.googleClientSecret);

  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    throw new Error(
      `[auth] Google OAuth requires both ${AUTH_ENV.googleClientId} and ${AUTH_ENV.googleClientSecret}.`,
    );
  }

  const missing = options.production
    ? [
        [AUTH_ENV.databaseUrl, databaseUrl],
        [AUTH_ENV.baseUrl, baseURLRaw],
        [AUTH_ENV.secret, secret],
      ]
        .filter(([, configured]) => !configured)
        .map(([name]) => name)
    : [];
  if (missing.length > 0) {
    throw new Error(
      `[auth] Missing required production environment variables: ${missing.join(", ")}.`,
    );
  }

  if (secret && secret.length < 32) {
    throw new Error(`[auth] ${AUTH_ENV.secret} must contain at least 32 characters.`);
  }

  if (databaseUrl) {
    const parsed = parseURL(databaseUrl, AUTH_ENV.databaseUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error(
        `[auth] ${AUTH_ENV.databaseUrl} must use the postgres or postgresql protocol.`,
      );
    }
  }

  let baseURL: string | undefined;
  if (baseURLRaw) {
    baseURL = parseOrigin(baseURLRaw, AUTH_ENV.baseUrl);
    if (options.production && !baseURL.startsWith("https://")) {
      throw new Error(`[auth] ${AUTH_ENV.baseUrl} must use HTTPS in production.`);
    }
  }

  if (googleClientId && !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
    throw new Error(
      `[auth] ${AUTH_ENV.googleClientId} must be a Google OAuth web client ID ending in .apps.googleusercontent.com.`,
    );
  }
  if (googleClientSecret && googleClientSecret.length < 16) {
    throw new Error(`[auth] ${AUTH_ENV.googleClientSecret} appears incomplete.`);
  }

  const trustedOriginsRaw = value(source, AUTH_ENV.trustedOrigins);
  const trustedOrigins = trustedOriginsRaw
    ? trustedOriginsRaw
        .split(",")
        .map((origin, index) =>
          parseOrigin(origin.trim(), `${AUTH_ENV.trustedOrigins} entry ${index + 1}`),
        )
    : [];

  return {
    databaseUrl,
    baseURL,
    secret,
    trustedOrigins: Array.from(new Set(trustedOrigins)),
    ...(googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {}),
  };
}
