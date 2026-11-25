export function sydneyDateTime(value: string): Date {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "shortOffset",
    year: "numeric",
  }).formatToParts(guess);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+11";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMinutes = match
    ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "-" ? -1 : 1)
    : 660;
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}
