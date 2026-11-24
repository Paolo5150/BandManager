const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Sydney" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Australia/Sydney" });

export function formatDate(value: string | Date) { return dateFormatter.format(new Date(value)); }
export function formatDateTime(value: string | Date) { return dateTimeFormatter.format(new Date(value)); }