const PARIS_TIME_ZONE = "Europe/Paris";

function offsetMinutesAt(timestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TIME_ZONE,
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(new Date(timestamp));

  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = zone.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function parisLocalInputToIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = offsetMinutesAt(localAsUtc);
  let utcTimestamp = localAsUtc - offset * 60_000;

  // Recalcule l'offset au timestamp final pour les passages heure d'été/hiver.
  const finalOffset = offsetMinutesAt(utcTimestamp);
  if (finalOffset !== offset) {
    offset = finalOffset;
    utcTimestamp = localAsUtc - offset * 60_000;
  }

  return new Date(utcTimestamp).toISOString();
}

export function isoToParisLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
