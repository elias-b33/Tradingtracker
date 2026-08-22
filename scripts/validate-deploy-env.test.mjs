import { describe, expect, it } from "vitest";
import { validateDeployEnvironment } from "./validate-deploy-env.mjs";

const core = {
  VERCEL: "1",
  DATABASE_URL: "postgresql://user:password@db.example.com/aether",
  BETTER_AUTH_URL: "https://tradingtracker.vercel.app",
  BETTER_AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters",
};

describe("Vercel auth environment validation", () => {
  it("keeps deployment healthy before optional Google credentials are supplied", () => {
    expect(validateDeployEnvironment(core)).toEqual({
      validated: true,
      googleEnabled: false,
    });
  });

  it("accepts a complete Google web client", () => {
    expect(
      validateDeployEnvironment({
        ...core,
        GOOGLE_CLIENT_ID: "123456789-abc.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "GOCSPX-valid-secret-value",
      }),
    ).toEqual({ validated: true, googleEnabled: true });
  });

  it("rejects partial Google credentials", () => {
    expect(() =>
      validateDeployEnvironment({
        ...core,
        GOOGLE_CLIENT_ID: "123456789-abc.apps.googleusercontent.com",
      }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
  });
});
