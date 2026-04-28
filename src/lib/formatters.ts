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

// ===== Phone number helpers =====

/** Format a stored E.164 phone number for display */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const cleaned = value.replace(/^\+/, "").replace(/\D/g, "");

  if (cleaned.startsWith("354") && cleaned.length === 10) {
    const local = cleaned.slice(3);
    return `+354 ${local.slice(0, 3)}-${local.slice(3)}`;
  }
  if (cleaned.startsWith("47") && cleaned.length === 10) {
    const local = cleaned.slice(2);
    return `+47 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5)}`;
  }
  if (cleaned.startsWith("46") && cleaned.length === 11) {
    const local = cleaned.slice(2);
    return `+46 ${local.slice(0, 2)}-${local.slice(2)}`;
  }
  if (cleaned.startsWith("45") && cleaned.length === 10) {
    const local = cleaned.slice(2);
    return `+45 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6)}`;
  }
  if (cleaned.startsWith("358") && cleaned.length === 12) {
    const local = cleaned.slice(3);
    return `+358 ${local.slice(0, 2)}-${local.slice(2)}`;
  }
  if (cleaned.startsWith("372") && (cleaned.length === 10 || cleaned.length === 11)) {
    const local = cleaned.slice(3);
    return `+372 ${local.slice(0, 3)}-${local.slice(3)}`;
  }
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  if (!cleaned) return value;
  return `+${cleaned}`;
}

/** Strip a display-format phone number to E.164 for storage. Returns "" if no local digits. */
export function stripPhone(countryCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, "");
  if (!digits) return "";
  const code = countryCode.replace(/^\+/, "").replace(/\D/g, "");
  return `+${code}${digits}`;
}

/** Mask local Icelandic input as 'XXX-XXXX' */
export function maskIcelandicLocal(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}
