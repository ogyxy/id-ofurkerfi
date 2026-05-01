export const CLOTHING_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'] as const;

export type SizeBreakdownType = 'clothing' | 'shoes';
export type SizeBreakdown = {
  type: SizeBreakdownType;
  sizes: Record<string, number>;
};

export function sumSizeBreakdown(b: SizeBreakdown | null | undefined): number {
  if (!b) return 0;
  return Object.values(b.sizes).reduce((a, n) => a + (n || 0), 0);
}

export function sizesForType(type: SizeBreakdownType): readonly string[] {
  return type === 'clothing' ? CLOTHING_SIZES : SHOE_SIZES;
}

/** Validate & normalize an unknown JSON value into a SizeBreakdown or null. */
export function parseSizeBreakdown(raw: unknown): SizeBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { type?: unknown; sizes?: unknown };
  if (o.type !== 'clothing' && o.type !== 'shoes') return null;
  if (!o.sizes || typeof o.sizes !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.sizes as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  if (Object.keys(out).length === 0) return null;
  return { type: o.type, sizes: out };
}

/** Format a breakdown for the quote PDF: "XS: 5  ·  S: 10  ·  M: 15" in canonical order. */
export function formatSizeBreakdown(b: SizeBreakdown): string {
  const order = sizesForType(b.type);
  const parts: string[] = [];
  for (const size of order) {
    const q = b.sizes[size];
    if (q && q > 0) parts.push(`${size}: ${q}`);
  }
  return parts.join('  ·  ');
}
