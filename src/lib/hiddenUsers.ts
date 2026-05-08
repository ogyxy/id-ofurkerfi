// Profiles that exist for data-ownership reasons but should not appear in
// any user-facing list, selector, or target table. Names still resolve when
// referenced by id on existing records.
export const HIDDEN_USER_EMAILS = new Set<string>(["jhb@jhb.is"]);

export function isHiddenProfile(p: { email?: string | null }): boolean {
  return !!p.email && HIDDEN_USER_EMAILS.has(p.email);
}

export function filterVisibleProfiles<T extends { email?: string | null }>(profiles: T[]): T[] {
  return profiles.filter((p) => !isHiddenProfile(p));
}
