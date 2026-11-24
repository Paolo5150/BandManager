/** Convert the local Australian mobile format (04xx xxx xxx) to E.164. */
export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (/^04\d{8}$/.test(digits)) {
    return `+61${digits.slice(1)}`;
  }

  if (/^614\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^00614\d{8}$/.test(digits)) {
    return `+${digits.slice(2)}`;
  }

  if (/^\+614\d{8}$/.test(trimmed.replace(/[\s()-]/g, ""))) {
    return trimmed.replace(/[\s()-]/g, "");
  }

  return null;
}