// Back-navigation helpers.
//
// Original design used sessionStorage to remember an explicit return path.
// New behavior: just use the browser's history (history.back()) so "Til baka"
// always returns to the exact previous screen the user was on.
//
// We keep the remember*/consume* exports so existing callsites continue to
// compile — they're now no-ops with safe fallback values.

export function goBack(fallback: string = "/") {
  if (typeof window === "undefined") return;
  // history.length > 1 means we have somewhere to go back to within this tab.
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  // No history available (e.g. opened in a new tab) — fall back to a sane default.
  window.location.assign(fallback);
}

// ---------------------------------------------------------------------------
// Legacy no-op helpers — kept so existing imports don't break.
// ---------------------------------------------------------------------------
export function rememberDealReturnPath(_path?: string) {
  // no-op
  void _path;
}

export function consumeDealReturnPath(): string {
  return "/deals";
}

export function rememberCompanyReturnPath(_path?: string) {
  // no-op
  void _path;
}

export function consumeCompanyReturnPath(): string {
  return "/companies";
}
