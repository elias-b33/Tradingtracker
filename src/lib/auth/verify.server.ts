import { getRequest } from "@tanstack/react-start/server";
import { auth, authConfigured } from "./server";

export { authConfigured };

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/** Resolve the caller exclusively from the verified Better Auth session. */
export async function getSessionUser(): Promise<VerifiedUser | null> {
  const request = getRequest();
  if (!request) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/** Return the verified account id or reject an unauthenticated request. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user.id;
}
