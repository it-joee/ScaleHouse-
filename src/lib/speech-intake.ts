export type SpokenFields = {
  truckNumber?: string;
  declaredMt?: string;
  supplierName?: string;
  origin?: string;
  waybill?: string;
  driverName?: string;
  driverContact?: string;
  commodityId?: string;
};

const ONES: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
};

const TENS: Record<string, number> = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
};

function wordsOf(value: string) {
  return value
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z0-9àâçéèêëîïôùûüœ.\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function frenchAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(",", "."));
  const words = wordsOf(raw).filter((word) => word !== "et");
  if (words.length === 0) return null;
  let index = 0;
  let total = 0;
  if (words[0] === "quatre" && words[1] === "vingt") {
    total = 80;
    index = 2;
    if (words[index] === "dix") {
      total = 90;
      index += 1;
    }
  } else if (words[0] === "soixante") {
    total = 60;
    index = 1;
    if (words[index] === "dix") {
      total = 70;
      index += 1;
    }
  } else if (TENS[words[0] ?? ""]) {
    total = TENS[words[0] ?? ""] ?? 0;
    index = 1;
  } else if (words[0] === "cent") {
    total = 100;
    index = 1;
  }
  if (index < words.length) {
    const rest = ONES[words[index] ?? ""];
    if (rest === undefined) return total > 0 && index > 0 ? total : null;
    total += rest;
  }
  return total > 0 || words[0] === "zero" ? total : null;
}

const ENGLISH: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function englishAmount(raw: string): number | null {
  const words = wordsOf(raw);
  const head = words[0] ?? "";
  const next = ENGLISH[words[1] ?? ""];
  if (head === "hundred") return 100 + (next !== undefined && next < 10 ? next : 0);
  if ((ENGLISH[head] ?? 0) >= 20 && next !== undefined && next < 10) return (ENGLISH[head] ?? 0) + next;
  if (words.length === 1 && ENGLISH[head] !== undefined) return ENGLISH[head];
  return null;
}

function phraseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  const split = trimmed.match(/^(.*?)\s+(?:virgule|point)\s+(.+)$/i);
  if (split) {
    const whole = frenchAmount(split[1] ?? "") ?? englishAmount(split[1] ?? "");
    const fraction = split[2]?.trim() ?? "";
    const frac = /^\d+$/.test(fraction) ? Number(fraction) : (frenchAmount(fraction) ?? englishAmount(fraction));
    if (whole !== null && frac !== null && frac >= 0) {
      return whole + Number(`0.${String(Math.trunc(frac))}`);
    }
  }
  return frenchAmount(trimmed) ?? englishAmount(trimmed);
}
function amountBefore(chunk: string): number | null {
  const words = chunk.trim().split(/[\s,]+/).filter(Boolean).slice(-4);
  for (let size = words.length; size >= 1; size -= 1) {
    const phrase = words.slice(-size).join(" ");
    const value = phraseAmount(phrase);
    if (value !== null) return value;
  }
  return null;
}

function afterLabel(text: string, labels: string[]) {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s+(.+?)(?=\\s+(?:camion|truck|plaque|plate|fournisseur|supplier|origine|origin|chauffeur|driver|bordereau|waybill|tonnes?|tons?|telephone|téléphone|phone)|$)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.replace(/[.,]+$/g, "").trim() || "";
}

function findPlate(text: string) {
  const upper = text.toUpperCase();
  const match = upper.match(/\b([A-Z]{2})\s*[-]?\s*(\d{3,6})\s*[-]?\s*([A-Z0-9]{1,4})?\b/);
  if (!match) return "";
  return [match[1], match[2], match[3]].filter(Boolean).join(" ");
}

function commodityId(text: string) {
  const lower = text.toLowerCase();
  if (/karit[ée]|shea/.test(lower)) return "shea";
  if (/ma[iï]s|maize/.test(lower)) return "maize";
  if (/soja|soy/.test(lower)) return "soybeans";
  if (/sorgho|sorghum/.test(lower)) return "sorghum";
  if (/\bmil\b|millet/.test(lower)) return "millet";
  return "";
}

export function parseSpokenTicket(transcript: string): SpokenFields {
  const text = transcript.replace(/\s+/g, " ").trim();
  const fields: SpokenFields = {};
  const plate = findPlate(text);
  if (plate) fields.truckNumber = plate;
  const tonne = text.match(/(?:^|[\s,])([a-zA-Zàâçéèêëîïôùûüœ0-9.,-]+(?:\s+[a-zA-Zàâçéèêëîïôùûüœ0-9.,-]+){0,3})\s*(?:tonnes?|tons?|mt)\b/);
  if (tonne?.[1]) {
    const amount = amountBefore(tonne[1]);
    if (amount !== null) fields.declaredMt = String(amount);
  }
  const supplier = afterLabel(text, ["fournisseur", "supplier"]);
  if (supplier) fields.supplierName = supplier;
  const origin = afterLabel(text, ["origine", "origin"]);
  if (origin) fields.origin = origin;
  const driver = afterLabel(text, ["chauffeur", "driver"]);
  if (driver) fields.driverName = driver;
  const waybill = text.match(/(?:bordereau|waybill)\s+([A-Za-z0-9][A-Za-z0-9/-]{2,})/i);
  if (waybill?.[1]) fields.waybill = waybill[1].toUpperCase();
  const phone = text.match(/(?:t[ée]l[ée]phone|phone|contact)\s+(\+?\d[\d\s]{6,}\d)/i);
  if (phone?.[1]) fields.driverContact = phone[1].replace(/\s+/g, "");
  const commodity = commodityId(text);
  if (commodity) fields.commodityId = commodity;
  return fields;
}

export function spokenSummary(fields: SpokenFields) {
  const parts = [
    fields.truckNumber ? `plate ${fields.truckNumber}` : "",
    fields.declaredMt ? `${fields.declaredMt} MT` : "",
    fields.supplierName ? fields.supplierName : "",
    fields.origin ? fields.origin : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
