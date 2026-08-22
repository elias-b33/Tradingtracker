import { authClient } from "./client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

/** Read the current account from the same-origin Better Auth session. */
export function useCurrentUserState(): CurrentUserState {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  return {
    user: user
      ? {
          id: user.id,
          displayName: user.name ?? null,
          primaryEmail: user.email ?? null,
          profileImageUrl: user.image ?? null,
          isDevFallback: false,
        }
      : null,
    isPending,
  };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
