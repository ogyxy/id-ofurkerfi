// Persist where the user came from before opening a detail screen,
// so the "Til baka" button can return to that exact screen.

const DEAL_KEY = "dealReturnPath";
const COMPANY_KEY = "companyReturnPath";

function readPath(path?: string): string {
  return (
    path ??
    (typeof window !== "undefined" && typeof window.location !== "undefined"
      ? window.location.pathname
      : "")
  );
}

export function rememberDealReturnPath(path?: string) {
  if (typeof window === "undefined") return;
  const p = readPath(path);
  if (!p) return;
  try {
    window.sessionStorage.setItem(DEAL_KEY, p);
  } catch {
    // ignore
  }
}

export function consumeDealReturnPath(): string {
  if (typeof window === "undefined") return "/deals";
  try {
    const v = window.sessionStorage.getItem(DEAL_KEY);
    if (v) {
      window.sessionStorage.removeItem(DEAL_KEY);
      return v;
    }
  } catch {
    // ignore
  }
  return "/deals";
}

export function rememberCompanyReturnPath(path?: string) {
  if (typeof window === "undefined") return;
  const p = readPath(path);
  if (!p) return;
  // Don't store the company detail page itself as a return path.
  if (p.startsWith("/companies/")) return;
  try {
    window.sessionStorage.setItem(COMPANY_KEY, p);
  } catch {
    // ignore
  }
}

export function consumeCompanyReturnPath(): string {
  if (typeof window === "undefined") return "/companies";
  try {
    const v = window.sessionStorage.getItem(COMPANY_KEY);
    if (v) {
      window.sessionStorage.removeItem(COMPANY_KEY);
      return v;
    }
  } catch {
    // ignore
  }
  return "/companies";
}
