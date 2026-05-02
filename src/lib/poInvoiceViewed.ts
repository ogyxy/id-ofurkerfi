// Tracks which PO invoices the current user has viewed during this session.
// In-memory only — resets on page reload. Used to nudge the user to actually
// look at the invoice PDF before approving it.

const viewedPoInvoices = new Set<string>();
const listeners = new Set<() => void>();

export function markPoInvoiceViewed(poId: string) {
  if (viewedPoInvoices.has(poId)) return;
  viewedPoInvoices.add(poId);
  listeners.forEach((fn) => fn());
}

export function hasViewedPoInvoice(poId: string): boolean {
  return viewedPoInvoices.has(poId);
}

export function subscribePoInvoiceViewed(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
