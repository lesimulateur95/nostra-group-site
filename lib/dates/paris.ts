const PARIS_TIME_ZONE = "Europe/Paris";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function validDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parisParts(date: Date): DateParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function formatParisDateTime(
  value: string | Date | null | undefined,
): string {
  const date = validDate(value);
  if (!date) return "Non définie";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function toParisDateTimeLocal(
  value: string | Date | null | undefined,
): string {
  const date = validDate(value);
  if (!date) return "";
  const parts = parisParts(date);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function parisLocalDateTimeToIso(value: string): string | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/,
  );
  if (!match) return null;

  const target: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  if (
    target.month < 1 ||
    target.month > 12 ||
    target.day < 1 ||
    target.day > 31 ||
    target.hour > 23 ||
    target.minute > 59
  ) {
    return null;
  }

  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  let instant = targetAsUtc;

  // Ajuste l’instant jusqu’à ce que son affichage Europe/Paris corresponde
  // exactement à la valeur saisie dans le champ datetime-local.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = parisParts(new Date(instant));
    const currentAsUtc = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
    );
    const difference = targetAsUtc - currentAsUtc;
    if (difference === 0) break;
    instant += difference;
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}
