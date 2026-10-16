export const STATUSES = [
  ["pending", "In queue"],
  ["weighing", "On the bridge"],
  ["inspection", "Inspection"],
  ["hold", "Held"],
  ["cleared", "Cleared to tip"],
  ["offloading", "Tipping"],
  ["offloaded", "Offloaded"],
  ["exited", "Left the yard"],
] as const;

export type Status = (typeof STATUSES)[number][0];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);

export const ROLES = ["pending", "floor", "procurement", "executive", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  pending: "Waiting",
  floor: "Floor",
  procurement: "Procurement",
  executive: "Executive",
  admin: "Admin",
};

export type Company = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sortOrder: number;
};

export type Commodity = {
  id: string;
  name: string;
  moistureMax: number;
};

export type Hub = {
  id: string;
  name: string;
  region: string;
};

export type MarketPrice = {
  id: string;
  commodityId: string;
  hubId: string;
  pricePerMt: number;
  currency: string;
  quotedOn: string;
  note: string;
};

export type AuditEvent = {
  id: string;
  deliveryId: string;
  at: string;
  actorName: string;
  action: string;
  detail: string;
};

export type Delivery = {
  id: string;
  companyId: string;
  loggedOn: string | null;
  waybill: string;
  truckNumber: string;
  truckNorm: string;
  commodityId: string;
  declaredMt: number | null;
  sgsMt: number | null;
  contractQtyMt: number | null;
  contractBalMt: number | null;
  grossKg: number | null;
  tareKg: number | null;
  moisturePct: number | null;
  brokenSeal: boolean;
  damagedBags: number;
  qcNote: string;
  driverName: string;
  driverContact: string;
  origin: string;
  supplierName: string;
  supplierContact: string;
  warehouse: string;
  deliveredOn: string | null;
  status: Status;
  offloadedOn: string | null;
  comment: string;
  officer: string;
  purchasePriceMt: number | null;
  marketHubId: string | null;
  photoUrl: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  modifiedAt: string;
};

export type ExceptionKind =
  | "sgs_missing"
  | "weight_gap"
  | "moisture"
  | "broken_seal"
  | "shared_plate"
  | "shared_waybill"
  | "above_desk";

export const EXCEPTION_KINDS: ExceptionKind[] = [
  "sgs_missing",
  "weight_gap",
  "moisture",
  "broken_seal",
  "shared_plate",
  "shared_waybill",
  "above_desk",
];

export const EXCEPTION_LABEL: Record<ExceptionKind, string> = {
  sgs_missing: "SGS missing",
  weight_gap: "Weight gap",
  moisture: "Moisture",
  broken_seal: "Broken seal",
  shared_plate: "Plate at two houses",
  shared_waybill: "Waybill reused",
  above_desk: "Above the desk",
};

export type YardException = {
  id: string;
  deliveryId: string;
  kind: ExceptionKind;
  fingerprint: string;
  detail: string;
};

export type ExceptionClear = {
  id: string;
  deliveryId: string;
  kind: ExceptionKind;
  fingerprint: string;
  note: string;
  clearedBy: string;
  clearedAt: string;
};

export type Movement = {
  id: string;
  fromCompanyId: string;
  toCompanyId: string;
  commodityId: string;
  tonnes: number;
  loggedOn: string;
  deliveryId: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type HousePosition = {
  companyId: string;
  trucksInYard: number;
  tonnesInYard: number;
  cashTied: number;
  unpricedTrucks: number;
  tonnesReceived: number;
  tonnesIn: number;
  tonnesOut: number;
};

export type Contract = {
  id: string;
  companyId: string;
  supplierName: string;
  commodityId: string;
  tonnes: number;
  pricePerMt: number | null;
  signedOn: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type ContractBook = {
  contract: Contract;
  received: number;
  inYard: number;
  stillToCome: number;
};

export type SupplierLine = {
  key: string;
  name: string;
  contact: string;
  trucks: number;
  declared: number;
  sgs: number;
  avgGap: number | null;
  claims: number;
  origins: string[];
  houses: string[];
  lastOn: string | null;
};

export type StaffMember = {
  userId: string;
  displayName: string;
  email: string;
  role: Role;
};

export type Me = {
  userId: string;
  displayName: string;
  email: string;
  role: Role;
};

export type Workspace =
  | { gate: "pending"; me: Me }
  | {
      gate: "open";
      me: Me;
      companies: Company[];
      commodities: Commodity[];
      hubs: Hub[];
      prices: MarketPrice[];
      deliveries: Delivery[];
      audits: AuditEvent[];
      clears: ExceptionClear[];
      movements: Movement[];
      contracts: Contract[];
      staff: StaffMember[];
    };

export function canEditYard(role: Role) {
  return role === "admin" || role === "floor";
}

export function canEditMarket(role: Role) {
  return role === "admin" || role === "procurement";
}

export function canEditCommercial(role: Role) {
  return role === "admin" || role === "floor" || role === "procurement";
}

export function canAdmin(role: Role) {
  return role === "admin";
}

export function canClearException(role: Role) {
  return role === "admin" || role === "floor";
}

export function canMoveStock(role: Role) {
  return role === "admin" || role === "floor" || role === "procurement";
}

export function canBrief(role: Role) {
  return role === "admin" || role === "executive";
}

export function canRecordContract(role: Role) {
  return role === "admin" || role === "procurement";
}

export function normPlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** SGS 0 beside a positive declaration is an empty capture, not a zero load. */
export function capturedSgs(d: Pick<Delivery, "sgsMt" | "declaredMt">): number | null {
  if (d.sgsMt === null) return null;
  if (d.sgsMt === 0 && (d.declaredMt === null || d.declaredMt > 0)) return null;
  return d.sgsMt;
}

export function bridgeNetMt(d: Pick<Delivery, "grossKg" | "tareKg">): number | null {
  if (d.grossKg === null || d.tareKg === null) return null;
  return Math.round((d.grossKg - d.tareKg) / 10) / 100;
}

export function weightGap(d: Pick<Delivery, "sgsMt" | "declaredMt">): number | null {
  const sgs = capturedSgs(d);
  if (sgs === null || d.declaredMt === null) return null;
  return Math.round((sgs - d.declaredMt) * 100) / 100;
}

export type PriceFlag = "above" | "below" | "at" | "none";

export function priceFlag(purchase: number | null, market: number | null): PriceFlag {
  if (purchase === null || market === null || market <= 0) return "none";
  const ratio = purchase / market;
  if (ratio > 1.01) return "above";
  if (ratio < 0.99) return "below";
  return "at";
}

export function latestPriceMap(prices: MarketPrice[]) {
  const map = new Map<string, MarketPrice>();
  const sorted = [...prices].sort((a, b) => a.quotedOn.localeCompare(b.quotedOn));
  for (const price of sorted) map.set(`${price.commodityId}:${price.hubId}`, price);
  return map;
}

export function marketFor(d: Delivery, prices: MarketPrice[]): MarketPrice | null {
  if (!d.marketHubId) return null;
  return latestPriceMap(prices).get(`${d.commodityId}:${d.marketHubId}`) ?? null;
}

export function inYard(status: string) {
  return status !== "offloaded" && status !== "exited";
}

export function sum(values: Array<number | null>) {
  let total = 0;
  let any = false;
  for (const value of values) {
    if (value === null) continue;
    total += value;
    any = true;
  }
  return any ? Math.round(total * 100) / 100 : 0;
}

export function formatMt(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatGhs(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `GHS ${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function moistureBreach(d: Delivery, commodities: Commodity[]) {
  if (d.moisturePct === null) return false;
  const commodity = commodities.find((item) => item.id === d.commodityId);
  if (!commodity) return false;
  return d.moisturePct > commodity.moistureMax;
}

const PAST_BRIDGE = new Set(["inspection", "hold", "cleared", "offloading", "offloaded", "exited"]);

function normKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function bookTonnes(delivery: Delivery) {
  return capturedSgs(delivery) ?? delivery.declaredMt ?? 0;
}

export function listExceptions(
  deliveries: Delivery[],
  commodities: Commodity[],
  prices: MarketPrice[],
): YardException[] {
  const byPlate = new Map<string, Delivery[]>();
  const byWaybill = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    if (delivery.truckNorm.length >= 4) {
      const list = byPlate.get(delivery.truckNorm) ?? [];
      list.push(delivery);
      byPlate.set(delivery.truckNorm, list);
    }
    const waybill = normKey(delivery.waybill);
    if (waybill.length >= 4) {
      const list = byWaybill.get(waybill) ?? [];
      list.push(delivery);
      byWaybill.set(waybill, list);
    }
  }

  const found: YardException[] = [];
  for (const delivery of deliveries) {
    if (PAST_BRIDGE.has(delivery.status) && capturedSgs(delivery) === null && (delivery.declaredMt ?? 0) > 0) {
      found.push({
        id: `${delivery.id}:sgs_missing`,
        deliveryId: delivery.id,
        kind: "sgs_missing",
        fingerprint: "missing",
        detail: `${formatMt(delivery.declaredMt)} MT declared and no SGS figure after the bridge.`,
      });
    }
    const gap = weightGap(delivery);
    const gapLimit = inYard(delivery.status) ? 1 : 5;
    if (gap !== null && Math.abs(gap) >= gapLimit) {
      found.push({
        id: `${delivery.id}:weight_gap`,
        deliveryId: delivery.id,
        kind: "weight_gap",
        fingerprint: `${delivery.declaredMt}:${capturedSgs(delivery)}`,
        detail: `SGS is ${formatMt(Math.abs(gap))} MT ${gap > 0 ? "over" : "under"} the declaration${inYard(delivery.status) ? ", and the truck is still in the yard" : ""}.`,
      });
    }
    if (moistureBreach(delivery, commodities)) {
      const commodity = commodities.find((item) => item.id === delivery.commodityId);
      found.push({
        id: `${delivery.id}:moisture`,
        deliveryId: delivery.id,
        kind: "moisture",
        fingerprint: String(delivery.moisturePct),
        detail: `${delivery.moisturePct}% against a ${commodity?.moistureMax ?? "—"}% ceiling.`,
      });
    }
    if (delivery.brokenSeal) {
      found.push({
        id: `${delivery.id}:broken_seal`,
        deliveryId: delivery.id,
        kind: "broken_seal",
        fingerprint: "broken",
        detail: "Seal was marked broken. Do not tip until the floor clears it.",
      });
    }
    if (inYard(delivery.status)) {
      const mates = (byPlate.get(delivery.truckNorm) ?? []).filter(
        (other) => other.id !== delivery.id && other.companyId !== delivery.companyId && inYard(other.status),
      );
      if (mates.length > 0) {
        found.push({
          id: `${delivery.id}:shared_plate`,
          deliveryId: delivery.id,
          kind: "shared_plate",
          fingerprint: mates
            .map((other) => other.id)
            .sort()
            .join(","),
          detail: `Plate ${delivery.truckNumber} is also in the yard for another company.`,
        });
      }
    }
    const waybill = normKey(delivery.waybill);
    const papers = (byWaybill.get(waybill) ?? []).filter(
      (other) => other.id !== delivery.id && other.companyId !== delivery.companyId,
    );
    if (papers.length > 0) {
      found.push({
        id: `${delivery.id}:shared_waybill`,
        deliveryId: delivery.id,
        kind: "shared_waybill",
        fingerprint: papers
          .map((other) => other.id)
          .sort()
          .join(","),
        detail: `Waybill ${delivery.waybill} is also on another company's ticket.`,
      });
    }
    const quote = marketFor(delivery, prices);
    if (priceFlag(delivery.purchasePriceMt, quote?.pricePerMt ?? null) === "above" && quote) {
      found.push({
        id: `${delivery.id}:above_desk`,
        deliveryId: delivery.id,
        kind: "above_desk",
        fingerprint: `${delivery.purchasePriceMt}:${quote.pricePerMt}`,
        detail: `Bought at ${formatGhs(delivery.purchasePriceMt)} against a desk of ${formatGhs(quote.pricePerMt)}.`,
      });
    }
  }
  return found;
}

export function openExceptions(items: YardException[], clears: ExceptionClear[]) {
  return items.filter(
    (item) =>
      !clears.some(
        (clear) =>
          clear.deliveryId === item.deliveryId &&
          clear.kind === item.kind &&
          clear.fingerprint === item.fingerprint,
      ),
  );
}

export function housePosition(companyId: string, deliveries: Delivery[], movements: Movement[]): HousePosition {
  const mine = deliveries.filter((delivery) => delivery.companyId === companyId);
  const yard = mine.filter((delivery) => inYard(delivery.status));
  const done = mine.filter((delivery) => !inYard(delivery.status));
  let cash = 0;
  let unpriced = 0;
  for (const delivery of yard) {
    const tonnes = bookTonnes(delivery);
    if (delivery.purchasePriceMt === null) {
      if (tonnes > 0) unpriced += 1;
      continue;
    }
    cash += tonnes * delivery.purchasePriceMt;
  }
  const tonnesIn = movements
    .filter((movement) => movement.toCompanyId === companyId)
    .reduce((total, movement) => total + movement.tonnes, 0);
  const tonnesOut = movements
    .filter((movement) => movement.fromCompanyId === companyId)
    .reduce((total, movement) => total + movement.tonnes, 0);
  return {
    companyId,
    trucksInYard: yard.length,
    tonnesInYard: sum(yard.map(bookTonnes)),
    cashTied: Math.round(cash * 100) / 100,
    unpricedTrucks: unpriced,
    tonnesReceived: sum(done.map(bookTonnes)),
    tonnesIn: Math.round(tonnesIn * 100) / 100,
    tonnesOut: Math.round(tonnesOut * 100) / 100,
  };
}

export function movementHint(comment: string, companies: Company[]) {
  const match = comment.match(/from\s+(.+?)\s+to\s+([^\n.]+)/i);
  if (!match) return null;
  const fromId = matchCompany(match[1] ?? "", companies);
  const toId = matchCompany(match[2] ?? "", companies);
  if (!fromId || !toId || fromId === toId) return null;
  return { fromId, toId };
}

function matchCompany(text: string, companies: Company[]) {
  const norm = text.trim().toLowerCase();
  if (!norm) return null;
  const hit = companies.find((company) => {
    const name = company.name.toLowerCase();
    const code = company.code.toLowerCase();
    return name === norm || code === norm || name.includes(norm) || norm.includes(name);
  });
  return hit?.id ?? null;
}

export function normSupplier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(hajia|alhaji|alhaja|haji|hajji)\s+/, "")
    .trim();
}

export function contractBooks(contracts: Contract[], deliveries: Delivery[]): ContractBook[] {
  const grouped = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const key = `${contract.companyId}|${normSupplier(contract.supplierName)}|${contract.commodityId}`;
    const list = grouped.get(key) ?? [];
    list.push(contract);
    grouped.set(key, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.signedOn.localeCompare(b.signedOn) || a.createdAt.localeCompare(b.createdAt));
  }
  const received = new Map<string, number>();
  const yard = new Map<string, number>();
  for (const delivery of deliveries) {
    if (!delivery.loggedOn || !normSupplier(delivery.supplierName)) continue;
    const key = `${delivery.companyId}|${normSupplier(delivery.supplierName)}|${delivery.commodityId}`;
    const list = grouped.get(key);
    if (!list) continue;
    const match = [...list].reverse().find((contract) => contract.signedOn <= (delivery.loggedOn ?? ""));
    if (!match) continue;
    const tonnes = bookTonnes(delivery);
    const bucket = inYard(delivery.status) ? yard : received;
    bucket.set(match.id, (bucket.get(match.id) ?? 0) + tonnes);
  }
  return [...contracts]
    .sort((a, b) => b.signedOn.localeCompare(a.signedOn))
    .map((contract) => {
      const got = Math.round((received.get(contract.id) ?? 0) * 100) / 100;
      const waiting = Math.round((yard.get(contract.id) ?? 0) * 100) / 100;
      return {
        contract,
        received: got,
        inYard: waiting,
        stillToCome: Math.round((contract.tonnes - got - waiting) * 100) / 100,
      };
    });
}

export function houseContract(companyId: string, books: ContractBook[]) {
  const mine = books.filter((book) => book.contract.companyId === companyId);
  return {
    promised: sum(mine.map((book) => book.contract.tonnes)),
    received: sum(mine.map((book) => book.received)),
    inYard: sum(mine.map((book) => book.inYard)),
    stillToCome: sum(mine.map((book) => book.stillToCome)),
    count: mine.length,
  };
}

export function tonnesLeft(value: number) {
  if (value < 0) return `${formatMt(Math.abs(value))} MT over`;
  return `${formatMt(value)} MT to come`;
}

export function contractForDelivery(delivery: Delivery, books: ContractBook[]): ContractBook | null {
  if (!delivery.loggedOn || !normSupplier(delivery.supplierName)) return null;
  const hit = books
    .filter(
      (book) =>
        book.contract.companyId === delivery.companyId &&
        book.contract.commodityId === delivery.commodityId &&
        normSupplier(book.contract.supplierName) === normSupplier(delivery.supplierName) &&
        book.contract.signedOn <= (delivery.loggedOn ?? ""),
    )
    .sort(
      (a, b) =>
        b.contract.signedOn.localeCompare(a.contract.signedOn) ||
        b.contract.createdAt.localeCompare(a.contract.createdAt),
    );
  return hit[0] ?? null;
}

export function supplierLedger(deliveries: Delivery[]): SupplierLine[] {
  const groups = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    const key = normSupplier(delivery.supplierName);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(delivery);
    groups.set(key, list);
  }
  const lines: SupplierLine[] = [];
  for (const [key, rows] of groups) {
    const gaps = rows.map((row) => weightGap(row)).filter((gap): gap is number => gap !== null);
    const origins = [...new Set(rows.map((row) => row.origin.trim()).filter(Boolean))];
    const houses = [...new Set(rows.map((row) => row.companyId))];
    const dates = rows.map((row) => row.loggedOn).filter((date): date is string => Boolean(date)).sort();
    const claims = rows.filter((row) => row.brokenSeal || Math.abs(weightGap(row) ?? 0) >= 5).length;
    const names = new Map<string, number>();
    for (const row of rows) {
      const name = row.supplierName.trim();
      if (!name) continue;
      names.set(name, (names.get(name) ?? 0) + 1);
    }
    const name =
      [...names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] ?? key;
    lines.push({
      key,
      name,
      contact: rows.find((row) => row.supplierContact.trim())?.supplierContact.trim() ?? "",
      trucks: rows.length,
      declared: sum(rows.map((row) => row.declaredMt)),
      sgs: sum(rows.map((row) => capturedSgs(row))),
      avgGap: gaps.length ? Math.round((gaps.reduce((total, gap) => total + gap, 0) / gaps.length) * 100) / 100 : null,
      claims,
      origins,
      houses,
      lastOn: dates.at(-1) ?? null,
    });
  }
  return lines.sort((a, b) => b.trucks - a.trucks || a.name.localeCompare(b.name));
}

export function morningBrief(input: {
  on: string;
  companies: Company[];
  deliveries: Delivery[];
  movements: Movement[];
  contracts: Contract[];
  openCount: number;
  exceptionLines?: string[];
}) {
  const yard = input.deliveries.filter((delivery) => inYard(delivery.status));
  const houses = input.companies.filter((company) => company.active);
  const positions = houses.map((company) => housePosition(company.id, input.deliveries, input.movements));
  const books = contractBooks(input.contracts, input.deliveries);
  const cash = positions.reduce((total, position) => total + position.cashTied, 0);
  const lines = [
    `JNI Scalehouse · ${input.on}`,
    `In the yard: ${yard.length} trucks, ${formatMt(sum(yard.map(bookTonnes)))} MT`,
    `Cash tied up: ${formatGhs(Math.round(cash * 100) / 100)}`,
    `Open exceptions: ${input.openCount}`,
  ];
  for (const line of (input.exceptionLines ?? []).slice(0, 3)) lines.push(`· ${line}`);
  lines.push("");
  for (const company of houses) {
    const position = positions.find((item) => item.companyId === company.id);
    if (!position || position.trucksInYard === 0) continue;
    lines.push(`${company.code}: ${position.trucksInYard} trucks, ${formatMt(position.tonnesInYard)} MT, ${formatGhs(position.cashTied)}`);
  }
  const paper = houses
    .map((company) => ({ company, standing: houseContract(company.id, books) }))
    .filter((row) => row.standing.count > 0);
  if (paper.length) {
    lines.push("");
    lines.push("Contracts still to come:");
    for (const row of paper) {
      lines.push(`${row.company.code}: ${tonnesLeft(row.standing.stillToCome)} of ${formatMt(row.standing.promised)} MT`);
    }
  }
  return lines.join("\n");
}

export function whatsAppHref(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("0") && digits.length === 10 ? `233${digits.slice(1)}` : digits;
  const body = encodeURIComponent(text);
  return local ? `https://wa.me/${local}?text=${body}` : `https://wa.me/?text=${body}`;
}
