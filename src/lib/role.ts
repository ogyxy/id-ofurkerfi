// Role / permission helpers used across the app.
// Roles are stored in `profiles.role` (admin | sales | designer | viewer).

export type AppRole = "admin" | "sales" | "designer" | "viewer";

export function canSeeFinancials(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "sales";
}

// designer + viewer can't write; viewer can't even upload.
export function canEdit(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "sales" || role === "designer";
}

export function canMutateBusinessData(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "sales";
}

export function canUpload(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "sales" || role === "designer";
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function canSeePurchaseOrders(role: AppRole | null | undefined): boolean {
  return canSeeFinancials(role);
}

export function canSeeActivities(role: AppRole | null | undefined): boolean {
  // Designer should not see activities/notes section.
  return role !== "designer";
}
