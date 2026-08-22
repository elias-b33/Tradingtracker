import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { authClient, signIn } from "@/lib/auth/client";
import { oauthErrorMessage } from "@/lib/auth/errors";
import { Logo } from "@/components/terminal/logo";
import { Input } from "@/components/ui/input";

const fetchSocialProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { googleAuthEnabled } = await import("@/lib/auth/server");
  return { google: googleAuthEnabled };
});

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  loader: () => fetchSocialProviders(),
  component: Login,
});

function Login() {
  const socialProviders = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => oauthErrorMessage(search.error));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");

  async function startGoogle() {
    setError(null);
    setPending("google");
    try {
      await signIn({ callbackURL: "/", errorCallbackURL: "/login" });
    } catch {
      setError("Google sign-in could not be started. Please try again or use email instead.");
      setPending(null);
    }
  }

  async function startEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending("email");
    try {
      const payload = { email: email.trim(), password };
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              ...payload,
              name: email.trim().split("@")[0] ?? "Trader",
            })
          : await authClient.signIn.email(payload);
      if (result.error) throw new Error(result.error.message || "Sign-in failed");
      await authClient.getSession().catch(() => undefined);
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-10 text-fg">
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-block">
          <Logo className="mb-8 flex items-center gap-2 text-lg" />
        </Link>
        <h1 className="font-sans text-2xl font-semibold tracking-tight">Sign in to your desk</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Watchlists, drawings, alerts, and notes follow you to every phone and laptop.
        </p>

        {socialProviders.google && (
          <>
            <div className="mt-8">
              <button
                type="button"
                disabled={pending !== null}
                aria-busy={pending === "google"}
                onClick={() => void startGoogle()}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-elevated text-sm font-medium text-fg shadow-border transition-[box-shadow,background-color] duration-150 hover:bg-elevated/80 disabled:cursor-wait disabled:opacity-60"
              >
                <GoogleMark />
                {pending === "google" ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" />
              or email
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form
          className={`${socialProviders.google ? "mt-4" : "mt-8"} space-y-2`}
          onSubmit={(event) => void startEmail(event)}
        >
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            name="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={pending !== null}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-fg disabled:cursor-wait disabled:opacity-60"
          >
            {pending === "email"
              ? "Working…"
              : mode === "up"
                ? "Create account"
                : "Sign in with email"}
          </button>
        </form>
        <button
          type="button"
          className="mt-2 w-full text-center text-xs text-muted hover:text-fg"
          onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
        >
          {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-down/10 px-3 py-2 text-sm leading-relaxed text-down"
          >
            {error}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted">
          <Link to="/" className="text-accent underline-offset-4 hover:underline">
            Continue as guest
          </Link>
          <span className="mx-2 text-subtle">·</span>
          this device only
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.2 2.8-2.5 3.6v3h4c2.4-2.2 3.5-5.4 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4-3c-1.1.7-2.5 1.2-3.9 1.2-3 0-5.5-2-6.4-4.7H1.5v3.1C3.5 21.4 7.5 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.6c-.2-.7-.4-1.4-.4-2.1s.1-1.5.4-2.1V7.3H1.5C.7 8.9.3 10.4.3 12.5s.4 3.6 1.2 5.2l4.1-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.5 0 3.5 2.6 1.5 6.5l4.1 3.1C6.5 6.8 9 4.8 12 4.8z"
      />
    </svg>
  );
}
