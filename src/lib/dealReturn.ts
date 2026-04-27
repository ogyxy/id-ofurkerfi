// Persist where the user came from before opening a deal detail,
// so the "Til baka" button can return to that exact screen.

const KEY = "dealReturnPath";

export function rememberDealReturnPath(path?: string) {
  if (typeof window === "undefined") return;
  const p =
    path ??
    (typeof window.location !== "undefined" ? window.location.pathname : "");
  if (!p) return;
  // Don't store the deal detail page itself as a return path.
  if (p.startsWith("/deals/")) return;
  try {
    window.sessionStorage.setItem(KEY, p);
  } catch {
    // ignore
  }
}

export function consumeDealReturnPath(): string {
  if (typeof window === "undefined") return "/deals";
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (v) {
      window.sessionStorage.removeItem(KEY);
      return v;
    }
  } catch {
    // ignore
  }
  return "/deals";
}
