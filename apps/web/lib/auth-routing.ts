export const AUTH_REDIRECTS = {
  login: "/login",
  register: "/register",
  authedHome: "/authed/dashboard"
} as const;

export function getSignedInRedirectTarget(isAuthenticated: boolean): string | null {
  return isAuthenticated ? AUTH_REDIRECTS.authedHome : null;
}

export function getProtectedRouteRedirectTarget(isAuthenticated: boolean): string | null {
  return isAuthenticated ? null : AUTH_REDIRECTS.login;
}
