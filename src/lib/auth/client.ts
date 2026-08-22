import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
export const authEnabled = true;

/** Start an ordinary same-origin OAuth flow with a configured provider. */
export async function signIn(
  options: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: options.callbackURL ?? "/",
    errorCallbackURL: options.errorCallbackURL ?? "/login",
    disableRedirect: true,
  });
  if (error) throw new Error(error.message ?? "Google sign-in could not be started.");
  if (!data?.url) throw new Error("Google sign-in did not return a redirect. Please try again.");
  window.location.assign(data.url);
}

/** End the local session and return to the requested page. */
export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Sign-out failed");
  window.location.assign(redirectTo);
}
