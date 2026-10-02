/** Never authorize from editable metadata or the profile's role label. */
export function isSuperAdminIdentity(user: { email?: string; email_confirmed_at?: string; is_anonymous?: boolean }, active: boolean): boolean {
  return active && !user.is_anonymous && Boolean(user.email_confirmed_at) && user.email?.trim().toLowerCase() === "sulthon02032019@gmail.com";
}
