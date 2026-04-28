export function formatKennitala(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export function stripKennitala(value: string): string {
  return value.replace(/\D/g, "");
}

/** For input mask: format keystroke value to 'XXXXXX-XXXX' as user types */
export function maskKennitalaInput(value: string): string {
  const digits = stripKennitala(value).slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export function isValidKennitala(value: string): boolean {
  return stripKennitala(value).length === 10;
}
