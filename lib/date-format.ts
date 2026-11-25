const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Sydney" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Australia/Sydney" });
const shortDateTimeFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Australia/Sydney" });
const eventDateTimeFormatter = new Intl.DateTimeFormat("en-AU", { dateStyle: "short", timeStyle: "short", timeZone: "Australia/Sydney" });
const eventTimeFormatter = new Intl.DateTimeFormat("en-AU", { timeStyle: "short", timeZone: "Australia/Sydney" });

export function formatDate(value: string | Date) { return dateFormatter.format(new Date(value)); }
export function formatDateTime(value: string | Date) { return dateTimeFormatter.format(new Date(value)); }
export function formatShortDateTime(value: string | Date) { return shortDateTimeFormatter.format(new Date(value)); }
export function formatEventDateTime(value: string | Date) { return eventDateTimeFormatter.format(new Date(value)); }
export function formatEventTime(value: string | Date) { return eventTimeFormatter.format(new Date(value)); }