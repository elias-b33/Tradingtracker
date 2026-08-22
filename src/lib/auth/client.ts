import { createAuthClient } from "better-auth/react";
import type { SocialProviderId } from "./server";

export const authClient = createAuthClient();
export const authEnabled = true;

/** Start an ordinary same-origin OAuth flow with a configured provider. */
export async function signIn(
  provider: SocialProviderId,
  options: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const { data, error } = await authClient.signIn.social({
    provider,
    callbackURL: options.callbackURL ?? "/",
    errorCallbackURL: options.errorCallbackURL ?? "/login",
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.assign(data.url);
}

/** End the local session and return to the requested page. */
export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Sign-out failed");
  window.location.assign(redirectTo);
}
