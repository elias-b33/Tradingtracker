#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const value = (source, key) => source[key]?.trim() || undefined;

function parseURL(raw, name) {
  try {
    return new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
}

/** Validate the environment that Vercel will use for the hosted application. */
export function validateDeployEnvironment(source = process.env) {
  if (source.VERCEL !== "1") return { validated: false, googleEnabled: false };

  const missing = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"].filter(
    (key) => !value(source, key),
  );
  if (missing.length > 0) {
    throw new Error(`Missing required Vercel environment variables: ${missing.join(", ")}.`);
  }

  const databaseURL = parseURL(value(source, "DATABASE_URL"), "DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(databaseURL.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const authURL = parseURL(value(source, "BETTER_AUTH_URL"), "BETTER_AUTH_URL");
  if (
    authURL.protocol !== "https:" ||
    authURL.username ||
    authURL.password ||
    authURL.pathname !== "/" ||
    authURL.search ||
    authURL.hash
  ) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin without a path, query, or hash.");
  }

  if (value(source, "BETTER_AUTH_SECRET").length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  const googleClientId = value(source, "GOOGLE_CLIENT_ID");
  const googleClientSecret = value(source, "GOOGLE_CLIENT_SECRET");
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    throw new Error("Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  if (googleClientId && !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
    throw new Error(
      "GOOGLE_CLIENT_ID must be a Google OAuth web client ID ending in .apps.googleusercontent.com.",
    );
  }
  if (googleClientSecret && googleClientSecret.length < 16) {
    throw new Error("GOOGLE_CLIENT_SECRET appears incomplete.");
  }

  return { validated: true, googleEnabled: Boolean(googleClientId) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const result = validateDeployEnvironment();
  if (result.validated) {
    console.log(
      `[config] Vercel environment is valid; Google sign-in is ${result.googleEnabled ? "enabled" : "disabled"}.`,
    );
  }
}
