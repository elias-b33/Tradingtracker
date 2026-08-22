const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled. You can try again or use email instead.",
  account_not_linked:
    "That email is already linked to another sign-in method. Sign in with email first.",
  unable_to_create_user: "We could not create your account from Google. Please try again.",
  unable_to_get_user_info: "Google did not return the account details needed to sign in.",
  callback_error: "Google could not complete sign-in. Please try again.",
  state_mismatch: "The Google sign-in request expired or was invalid. Please try again.",
};

/** Convert OAuth callback codes into safe, actionable UI text. */
export function oauthErrorMessage(code?: string): string | null {
  if (!code) return null;
  return (
    OAUTH_ERROR_MESSAGES[code.toLowerCase()] ??
    "Google sign-in could not be completed. Please try again or use email instead."
  );
}
