// Smart-guess helpers for selecting a default file_type from a filename.

export function smartGuessDealFileType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("mockup")) return "mockup";
  if (lower.includes("artwork") || lower.includes("design") || lower.includes("hönnun") || lower.includes("honnun"))
    return "artwork";
  if (lower.includes("logo") || lower.includes("myndmerki") || lower.includes("merki")) return "logo";
  if (
    lower.includes("presentation") ||
    lower.includes("kynning") ||
    /\.(pptx?|key)$/i.test(filename)
  )
    return "presentation";
  if (lower.includes("tilboð") || lower.includes("tilbod") || lower.includes("quote")) return "quote";
  if (lower.includes("reikningur") || lower.includes("invoice")) return "invoice";
  return "other";
}

export function smartGuessBrandFileType(filename: string): string {
  const lower = filename.toLowerCase();
  if (
    /\.(svg|ai|eps)$/i.test(filename) ||
    lower.includes("logo") ||
    lower.includes("myndmerki") ||
    lower.includes("merki")
  )
    return "logo";
  if (lower.includes("guidelines") || lower.includes("brand book") || lower.includes("vörumerki"))
    return "brand_guidelines";
  if (/\.(ttf|otf|woff2?)$/i.test(filename) || lower.includes("font") || lower.includes("letur"))
    return "font";
  if (lower.includes("color") || lower.includes("litir") || lower.includes("palette"))
    return "color_scheme";
  if (lower.includes("master") || lower.includes("artwork") || lower.includes("vector"))
    return "master_artwork";
  return "other";
}

export function smartGuessPoFileType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("proof")) return "proof";
  if (
    lower.includes("confirmation") ||
    lower.includes("staðfesting") ||
    lower.includes("stadfesting")
  )
    return "order_confirmation";
  if (lower.includes("invoice") || lower.includes("reikningur")) return "invoice";
  if (
    lower.includes("artwork") ||
    lower.includes("design") ||
    lower.includes("hönnun") ||
    lower.includes("honnun")
  )
    return "artwork";
  return "other";
}

// Icelandic pluralization for file count (dative case for "Hlaða upp X skjölum")
export function fileCountDative(n: number): string {
  if (n === 1) return "1 skjali";
  return `${n} skjölum`;
}
