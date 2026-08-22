import { describe, expect, it } from "vitest";
import { googleCallbackURL, readAuthConfiguration, type AuthEnvironment } from "./config";
import { oauthErrorMessage } from "./errors";

const productionEnvironment: AuthEnvironment = {
  DATABASE_URL: "postgresql://user:password@db.example.com/aether",
  BETTER_AUTH_URL: "https://tradingtracker.vercel.app",
  BETTER_AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters",
};

describe("standalone auth configuration", () => {
  it("allows production email/password auth before Google credentials are added", () => {
    const config = readAuthConfiguration(productionEnvironment, { production: true });
    expect(config.google).toBeUndefined();
    expect(config.baseURL).toBe("https://tradingtracker.vercel.app");
  });

  it("enables Google only with a complete valid credential pair", () => {
    const config = readAuthConfiguration(
      {
        ...productionEnvironment,
        GOOGLE_CLIENT_ID: "123456789-abc_DEF.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "GOCSPX-valid-secret-value",
      },
      { production: true },
    );
    expect(config.google?.clientId).toContain(".apps.googleusercontent.com");
  });

  it("rejects partial or malformed Google configuration", () => {
    expect(() =>
      readAuthConfiguration(
        { ...productionEnvironment, GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com" },
        { production: true },
      ),
    ).toThrow(/requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);

    expect(() =>
      readAuthConfiguration(
        {
          ...productionEnvironment,
          GOOGLE_CLIENT_ID: "not-a-google-client",
          GOOGLE_CLIENT_SECRET: "GOCSPX-valid-secret-value",
        },
        { production: true },
      ),
    ).toThrow(/Google OAuth web client ID/);
  });

  it("derives the documented production callback from BETTER_AUTH_URL", () => {
    expect(googleCallbackURL("https://tradingtracker.vercel.app")).toBe(
      "https://tradingtracker.vercel.app/api/auth/callback/google",
    );
  });
});

describe("OAuth callback errors", () => {
  it("turns cancellation and unknown provider errors into actionable safe copy", () => {
    expect(oauthErrorMessage("access_denied")).toMatch(/cancelled/i);
    expect(oauthErrorMessage("internal_details_that_should_not_be_rendered")).toBe(
      "Google sign-in could not be completed. Please try again or use email instead.",
    );
    expect(oauthErrorMessage()).toBeNull();
  });
});
