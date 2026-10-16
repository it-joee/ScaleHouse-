import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  STATUSES,
  type AuditEvent,
  type Commodity,
  type Company,
  type Contract,
  type Delivery,
  type ExceptionClear,
  type ExceptionKind,
  type Hub,
  type MarketPrice,
  type Me,
  type Movement,
  type Role,
  type StaffMember,
  type Status,
  type Workspace,
  canAdmin,
  canClearException,
  canEditCommercial,
  canEditMarket,
  canEditYard,
  canMoveStock,
  canRecordContract,
  normPlate,
} from "@/lib/domain";

/**
 * The yard is shared by every admitted member of this workspace.
 * user id admits people and signs the audit trail. It does not hide trucks.
 */

const STATUS_SET = new Set<string>(STATUSES.map(([id]) => id));
const EXCEPTION_SET = new Set<ExceptionKind>([
  "sgs_missing",
  "weight_gap",
  "moisture",
  "broken_seal",
  "shared_plate",
  "shared_waybill",
  "above_desk",
]);

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Missing details.");
  return input as Record<string, unknown>;
}

function str(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Use a real date.");
  return text;
}

function numOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Enter a number.");
  return Math.round(n * 1000) / 1000;
}

function nonNeg(value: number | null, label: string) {
  if (value !== null && value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function instant(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function flag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type DeliveryInput = {
  companyId: string;
  loggedOn: string | null;
  waybill: string;
  truckNumber: string;
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
  actorName: string;
};

function parseDelivery(input: unknown): DeliveryInput {
  const row = asRecord(input);
  const status = str(row.status, 40);
  if (!STATUS_SET.has(status)) throw new Error("Pick a yard status.");
  const bags = row.damagedBags === "" || row.damagedBags === null || row.damagedBags === undefined
    ? 0
    : Number(row.damagedBags);
  if (!Number.isInteger(bags) || bags < 0 || bags > 100000) {
    throw new Error("Damaged bags should be a whole number.");
  }
  const photoUrl = str(row.photoUrl, 2_500_000);
  if (photoUrl.length > 2_500_000) throw new Error("Photos total size is too large.");
  const moisture = nonNeg(numOrNull(row.moisturePct), "Moisture");
  if (moisture !== null && moisture > 100) throw new Error("Moisture should be a percent.");
  const truckNumber = str(row.truckNumber, 40);
  if (!truckNumber) throw new Error("Enter the truck number.");
  return {
    companyId: str(row.companyId, 40),
    loggedOn: dateOrNull(row.loggedOn),
    waybill: str(row.waybill, 80),
    truckNumber,
    commodityId: str(row.commodityId, 40),
    declaredMt: nonNeg(numOrNull(row.declaredMt), "Declared quantity"),
    sgsMt: nonNeg(numOrNull(row.sgsMt), "SGS quantity"),
    contractQtyMt: nonNeg(numOrNull(row.contractQtyMt), "Contract quantity"),
    contractBalMt: numOrNull(row.contractBalMt),
    grossKg: nonNeg(numOrNull(row.grossKg), "Gross weight"),
    tareKg: nonNeg(numOrNull(row.tareKg), "Tare weight"),
    moisturePct: moisture,
    brokenSeal: flag(row.brokenSeal),
    damagedBags: bags,
    qcNote: str(row.qcNote, 500),
    driverName: str(row.driverName, 120),
    driverContact: str(row.driverContact, 80),
    origin: str(row.origin, 80),
    supplierName: str(row.supplierName, 120),
    supplierContact: str(row.supplierContact, 80),
    warehouse: str(row.warehouse, 120),
    deliveredOn: dateOrNull(row.deliveredOn),
    status: status as Status,
    offloadedOn: dateOrNull(row.offloadedOn),
    comment: str(row.comment, 2000),
    officer: str(row.officer, 120),
    purchasePriceMt: nonNeg(numOrNull(row.purchasePriceMt), "Purchase price"),
    marketHubId: str(row.marketHubId, 40) || null,
    photoUrl,
    actorName: str(row.actorName, 80),
  };
}

async function ensureStaff(sql: Sql, userId: string, displayName: string, email: string): Promise<Me> {
  const rows = await sql<{ user_id: string; display_name: string; email: string; role: string }>`
    insert into staff (user_id, display_name, email, role)
    values (${userId}, ${displayName}, ${email}, 'pending')
    on conflict (user_id) do update set
      display_name = case when excluded.display_name <> '' then excluded.display_name else staff.display_name end,
      email = case when excluded.email <> '' then excluded.email else staff.email end
    returning user_id, display_name, email, role
  `;
  let role = (rows[0]?.role ?? "pending") as Role;
  if (role === "pending") {
    // The first real sign-in runs the yard. A leftover test or preview-only
    // account must not sit on the admin desk and lock the owner out — only an
    // admin who signed in with Google or X counts as already holding it.
    const promoted = await sql<{ role: string }>`
      update staff set role = 'admin'
      where user_id = ${userId}
        and role = 'pending'
        and not exists (
          select 1
          from staff s
          join "account" a on a."userId" = s.user_id
          where s.role = 'admin'
            and a."providerId" in ('grok-google', 'grok-x')
        )
      returning role
    `;
    if (promoted[0]?.role === "admin") role = "admin";
  }
  return {
    userId,
    displayName: rows[0]?.display_name || displayName,
    email: rows[0]?.email || email,
    role,
  };
}

function assertDesk(role: Role, allowed: boolean) {
  if (role === "pending") throw new Error("An admin still has to admit you to the yard.");
  if (!allowed) throw new Error("Your desk cannot change that.");
}

function mapCompany(row: Record<string, unknown>): Company {
  return {
    id: text(row.id),
    name: text(row.name),
    code: text(row.code),
    active: flag(row.active),
    sortOrder: num(row.sort_order) ?? 100,
  };
}

function mapDelivery(row: Record<string, unknown>): Delivery {
  const status = text(row.status);
  return {
    id: text(row.id),
    companyId: text(row.company_id),
    loggedOn: row.logged_on ? text(row.logged_on).slice(0, 10) : null,
    waybill: text(row.waybill),
    truckNumber: text(row.truck_number),
    truckNorm: text(row.truck_norm),
    commodityId: text(row.commodity_id),
    declaredMt: num(row.declared_mt),
    sgsMt: num(row.sgs_mt),
    contractQtyMt: num(row.contract_qty_mt),
    contractBalMt: num(row.contract_bal_mt),
    grossKg: num(row.gross_kg),
    tareKg: num(row.tare_kg),
    moisturePct: num(row.moisture_pct),
    brokenSeal: flag(row.broken_seal),
    damagedBags: num(row.damaged_bags) ?? 0,
    qcNote: text(row.qc_note),
    driverName: text(row.driver_name),
    driverContact: text(row.driver_contact),
    origin: text(row.origin),
    supplierName: text(row.supplier_name),
    supplierContact: text(row.supplier_contact),
    warehouse: text(row.warehouse),
    deliveredOn: row.delivered_on ? text(row.delivered_on).slice(0, 10) : null,
    status: (STATUS_SET.has(status) ? status : "pending") as Status,
    offloadedOn: row.offloaded_on ? text(row.offloaded_on).slice(0, 10) : null,
    comment: text(row.comment),
    officer: text(row.officer),
    purchasePriceMt: num(row.purchase_price_mt),
    marketHubId: row.market_hub_id ? text(row.market_hub_id) : null,
    photoUrl: text(row.photo_url),
    createdBy: text(row.created_by),
    createdAt: instant(row.created_at),
    modifiedBy: text(row.modified_by),
    modifiedAt: instant(row.modified_at),
  };
}

async function loadOpen(sql: Sql, me: Me): Promise<Workspace> {
  const [companies, commodities, hubs, prices, deliveries, audits, clears, movements, contracts, staff] = await Promise.all([
    sql<Record<string, unknown>>`select id, name, code, active, sort_order from companies order by sort_order, name`,
    sql<Record<string, unknown>>`select id, name, moisture_max from commodities order by name`,
    sql<Record<string, unknown>>`select id, name, region from hubs order by name`,
    sql<Record<string, unknown>>`select id, commodity_id, hub_id, price_per_mt, currency, quoted_on, note from market_prices order by quoted_on desc`,
    sql<Record<string, unknown>>`select * from deliveries order by logged_on desc nulls last, id desc`,
    sql<Record<string, unknown>>`select id, delivery_id, at, actor_name, action, detail from audit_events order by at desc`,
    sql<Record<string, unknown>>`select id, delivery_id, kind, fingerprint, note, cleared_by, cleared_at from exception_clears order by cleared_at desc`,
    sql<Record<string, unknown>>`select id, from_company_id, to_company_id, commodity_id, tonnes, logged_on, delivery_id, note, created_by, created_at from movements order by logged_on desc, created_at desc`,
    sql<Record<string, unknown>>`select id, company_id, supplier_name, commodity_id, tonnes, price_per_mt, signed_on, note, created_by, created_at from contracts order by signed_on desc, created_at desc`,
    me.role === "admin"
      ? sql<Record<string, unknown>>`select user_id, display_name, email, role from staff order by created_at`
      : Promise.resolve([]),
  ]);
  return {
    gate: "open",
    me,
    companies: companies.map(mapCompany),
    commodities: commodities.map(
      (row): Commodity => ({
        id: text(row.id),
        name: text(row.name),
        moistureMax: num(row.moisture_max) ?? 0,
      }),
    ),
    hubs: hubs.map(
      (row): Hub => ({ id: text(row.id), name: text(row.name), region: text(row.region) }),
    ),
    prices: prices.map(
      (row): MarketPrice => ({
        id: text(row.id),
        commodityId: text(row.commodity_id),
        hubId: text(row.hub_id),
        pricePerMt: num(row.price_per_mt) ?? 0,
        currency: text(row.currency) || "GHS",
        quotedOn: text(row.quoted_on).slice(0, 10),
        note: text(row.note),
      }),
    ),
    deliveries: deliveries.map(mapDelivery),
    audits: audits.map(
      (row): AuditEvent => ({
        id: text(row.id),
        deliveryId: text(row.delivery_id),
        at: instant(row.at),
        actorName: text(row.actor_name),
        action: text(row.action),
        detail: text(row.detail),
      }),
    ),
    clears: clears.map(
      (row): ExceptionClear => ({
        id: text(row.id),
        deliveryId: text(row.delivery_id),
        kind: (EXCEPTION_SET.has(text(row.kind) as ExceptionKind) ? text(row.kind) : "sgs_missing") as ExceptionKind,
        fingerprint: text(row.fingerprint),
        note: text(row.note),
        clearedBy: text(row.cleared_by),
        clearedAt: instant(row.cleared_at),
      }),
    ),
    movements: movements.map(
      (row): Movement => ({
        id: text(row.id),
        fromCompanyId: text(row.from_company_id),
        toCompanyId: text(row.to_company_id),
        commodityId: text(row.commodity_id),
        tonnes: num(row.tonnes) ?? 0,
        loggedOn: text(row.logged_on).slice(0, 10),
        deliveryId: row.delivery_id ? text(row.delivery_id) : null,
        note: text(row.note),
        createdBy: text(row.created_by),
        createdAt: instant(row.created_at),
      }),
    ),
    contracts: contracts.map(
      (row): Contract => ({
        id: text(row.id),
        companyId: text(row.company_id),
        supplierName: text(row.supplier_name),
        commodityId: text(row.commodity_id),
        tonnes: num(row.tonnes) ?? 0,
        pricePerMt: num(row.price_per_mt),
        signedOn: text(row.signed_on).slice(0, 10),
        note: text(row.note),
        createdBy: text(row.created_by),
        createdAt: instant(row.created_at),
      }),
    ),
    staff: staff.map(
      (row): StaffMember => ({
        userId: text(row.user_id),
        displayName: text(row.display_name),
        email: text(row.email),
        role: (text(row.role) || "pending") as Role,
      }),
    ),
  };
}

async function requireRefs(sql: Sql, input: DeliveryInput, previousCompanyId?: string) {
  if (!input.companyId) throw new Error("Pick a company.");
  const company = await sql<{ id: string; active: boolean }>`
    select id, active from companies where id = ${input.companyId}
  `;
  if (!company[0]) throw new Error("Pick a company on the yard.");
  if (!company[0].active && input.companyId !== previousCompanyId) {
    throw new Error("That company is paused. An admin can open it again.");
  }
  const commodity = await sql<{ id: string }>`select id from commodities where id = ${input.commodityId}`;
  if (!commodity[0]) throw new Error("Pick a commodity.");
  if (input.marketHubId) {
    const hub = await sql<{ id: string }>`select id from hubs where id = ${input.marketHubId}`;
    if (!hub[0]) throw new Error("That market hub is not on the sheet.");
  }
}

function actor(userId: string, name: string) {
  return { userId, name: name || "Yard" };
}

export const getWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input ?? {});
    return { displayName: str(row.displayName, 120), email: str(row.email, 200) };
  })
  .handler(async ({ context, data }): Promise<Workspace> => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.displayName, data.email);
    if (me.role === "pending") return { gate: "pending", me };
    return loadOpen(sql, me);
  });

export const createDelivery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parseDelivery(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditYard(me.role));
    await requireRefs(sql, data);
    const id = `dlv_${crypto.randomUUID()}`;
    const who = actor(context.userId, data.actorName);
    const plate = normPlate(data.truckNumber);
    await sql`
      insert into deliveries (
        id, company_id, logged_on, waybill, truck_number, truck_norm, commodity_id,
        declared_mt, sgs_mt, contract_qty_mt, contract_bal_mt, gross_kg, tare_kg,
        moisture_pct, broken_seal, damaged_bags, qc_note, driver_name, driver_contact,
        origin, supplier_name, supplier_contact, warehouse, delivered_on, status,
        offloaded_on, comment, officer, purchase_price_mt, market_hub_id, photo_url,
        created_by, modified_by
      ) values (
        ${id}, ${data.companyId}, ${data.loggedOn}, ${data.waybill}, ${data.truckNumber}, ${plate},
        ${data.commodityId}, ${data.declaredMt}, ${data.sgsMt}, ${data.contractQtyMt}, ${data.contractBalMt},
        ${data.grossKg}, ${data.tareKg}, ${data.moisturePct}, ${data.brokenSeal}, ${data.damagedBags},
        ${data.qcNote}, ${data.driverName}, ${data.driverContact}, ${data.origin}, ${data.supplierName},
        ${data.supplierContact}, ${data.warehouse}, ${data.deliveredOn}, ${data.status}, ${data.offloadedOn},
        ${data.comment}, ${data.officer}, ${data.purchasePriceMt}, ${data.marketHubId}, ${data.photoUrl},
        ${who.name}, ${who.name}
      )
    `;
    await sql`
      insert into audit_events (id, delivery_id, actor_user_id, actor_name, action, detail)
      values (${`aud_${crypto.randomUUID()}`}, ${id}, ${who.userId}, ${who.name}, 'Opened', ${`${data.truckNumber} · ${data.waybill || "no waybill"}`})
    `;
    return { id };
  });

export const updateDelivery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    return { id: str(row.id, 80), ...parseDelivery(row) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditYard(me.role));
    const prev = await sql<{ status: string; company_id: string }>`
      select status, company_id from deliveries where id = ${data.id}
    `;
    if (!prev[0]) throw new Error("That truck is no longer on the log.");
    await requireRefs(sql, data, prev[0].company_id);
    const who = actor(context.userId, data.actorName);
    const plate = normPlate(data.truckNumber);
    const updated = await sql<{ id: string }>`
      update deliveries set
        company_id = ${data.companyId},
        logged_on = ${data.loggedOn},
        waybill = ${data.waybill},
        truck_number = ${data.truckNumber},
        truck_norm = ${plate},
        commodity_id = ${data.commodityId},
        declared_mt = ${data.declaredMt},
        sgs_mt = ${data.sgsMt},
        contract_qty_mt = ${data.contractQtyMt},
        contract_bal_mt = ${data.contractBalMt},
        gross_kg = ${data.grossKg},
        tare_kg = ${data.tareKg},
        moisture_pct = ${data.moisturePct},
        broken_seal = ${data.brokenSeal},
        damaged_bags = ${data.damagedBags},
        qc_note = ${data.qcNote},
        driver_name = ${data.driverName},
        driver_contact = ${data.driverContact},
        origin = ${data.origin},
        supplier_name = ${data.supplierName},
        supplier_contact = ${data.supplierContact},
        warehouse = ${data.warehouse},
        delivered_on = ${data.deliveredOn},
        status = ${data.status},
        offloaded_on = ${data.offloadedOn},
        comment = ${data.comment},
        officer = ${data.officer},
        purchase_price_mt = ${data.purchasePriceMt},
        market_hub_id = ${data.marketHubId},
        photo_url = ${data.photoUrl},
        modified_by = ${who.name},
        modified_at = now()
      where id = ${data.id}
      returning id
    `;
    if (!updated[0]) throw new Error("That truck is no longer on the log.");
    const detail =
      prev[0].status === data.status
        ? "Ticket edited."
        : `${prev[0].status} → ${data.status}`;
    await sql`
      insert into audit_events (id, delivery_id, actor_user_id, actor_name, action, detail)
      values (
        ${`aud_${crypto.randomUUID()}`}, ${data.id}, ${who.userId}, ${who.name},
        ${prev[0].status === data.status ? "Updated" : "Status"}, ${detail}
      )
    `;
    return { id: data.id };
  });

export const setCommercial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const purchasePriceMt = nonNeg(numOrNull(row.purchasePriceMt), "Purchase price");
    return {
      id: str(row.id, 80),
      purchasePriceMt,
      marketHubId: str(row.marketHubId, 40) || null,
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditCommercial(me.role));
    if (data.marketHubId) {
      const hub = await sql<{ id: string }>`select id from hubs where id = ${data.marketHubId}`;
      if (!hub[0]) throw new Error("That market hub is not on the sheet.");
    }
    const who = actor(context.userId, data.actorName);
    const updated = await sql<{ id: string }>`
      update deliveries set
        purchase_price_mt = ${data.purchasePriceMt},
        market_hub_id = ${data.marketHubId},
        modified_by = ${who.name},
        modified_at = now()
      where id = ${data.id}
      returning id
    `;
    if (!updated[0]) throw new Error("That truck is no longer on the log.");
    await sql`
      insert into audit_events (id, delivery_id, actor_user_id, actor_name, action, detail)
      values (${`aud_${crypto.randomUUID()}`}, ${data.id}, ${who.userId}, ${who.name}, 'Price', 'Purchase price or market hub updated.')
    `;
    return { id: data.id };
  });

export const saveCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const name = str(row.name, 80);
    const code = str(row.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (name.length < 2) throw new Error("Enter the company name.");
    if (code.length < 2) throw new Error("Use a short code of at least 2 letters.");
    return {
      id: str(row.id, 40),
      name,
      code,
      active: row.active !== false,
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canAdmin(me.role));
    if (data.id === "unassigned" && !data.active) {
      throw new Error("Unassigned stays open so stray waybills have a home.");
    }
    if (data.id) {
      const clash = await sql<{ id: string }>`
        select id from companies where code = ${data.code} and id <> ${data.id}
      `;
      if (clash[0]) throw new Error("That code is already on the yard.");
      const updated = await sql`
        update companies set name = ${data.name}, code = ${data.code}, active = ${data.active}
        where id = ${data.id}
        returning id
      `;
      if (!updated[0]) throw new Error("That company is not on the yard.");
      return { id: data.id };
    }
    const id = slug(data.code) || slug(data.name);
    const clash = await sql<{ id: string }>`
      select id from companies where id = ${id} or code = ${data.code} or name = ${data.name}
    `;
    if (clash[0]) throw new Error("That company or code is already on the yard.");
    await sql`
      insert into companies (id, name, code, active, sort_order)
      values (${id}, ${data.name}, ${data.code}, true, 100)
    `;
    return { id };
  });

export const saveHub = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const name = str(row.name, 80);
    if (name.length < 2) throw new Error("Name the hub.");
    return { name, region: str(row.region, 80), actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditMarket(me.role));
    const id = slug(data.name);
    if (!id) throw new Error("Name the hub.");
    await sql`
      insert into hubs (id, name, region) values (${id}, ${data.name}, ${data.region})
      on conflict (id) do update set region = excluded.region
    `;
    return { id };
  });

export const saveCommodity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const name = str(row.name, 80);
    const moistureMax = numOrNull(row.moistureMax);
    if (name.length < 2) throw new Error("Name the commodity.");
    if (moistureMax === null || moistureMax < 0 || moistureMax > 40) {
      throw new Error("Set a moisture ceiling between 0 and 40.");
    }
    return { id: str(row.id, 40), name, moistureMax, actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditMarket(me.role) || canAdmin(me.role));
    if (data.id) {
      await sql`update commodities set moisture_max = ${data.moistureMax}, name = ${data.name} where id = ${data.id}`;
      return { id: data.id };
    }
    const id = slug(data.name);
    await sql`
      insert into commodities (id, name, moisture_max) values (${id}, ${data.name}, ${data.moistureMax})
      on conflict (id) do update set moisture_max = excluded.moisture_max, name = excluded.name
    `;
    return { id };
  });

export const savePrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const price = numOrNull(row.pricePerMt);
    if (price === null || price <= 0) throw new Error("Enter today's price per tonne.");
    return {
      commodityId: str(row.commodityId, 40),
      hubId: str(row.hubId, 40),
      quotedOn: dateOrNull(row.quotedOn),
      pricePerMt: price,
      note: str(row.note, 200),
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditMarket(me.role));
    if (!data.quotedOn) throw new Error("Date the quote.");
    if (!data.commodityId || !data.hubId) throw new Error("Pick a commodity and a hub.");
    const id = `prc_${crypto.randomUUID()}`;
    await sql`
      insert into market_prices (id, commodity_id, hub_id, price_per_mt, quoted_on, note, updated_by)
      values (${id}, ${data.commodityId}, ${data.hubId}, ${data.pricePerMt}, ${data.quotedOn}, ${data.note}, ${data.actorName})
      on conflict (commodity_id, hub_id, quoted_on) do update set
        price_per_mt = excluded.price_per_mt,
        note = excluded.note,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    return { id };
  });

export const removePrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    return { id: str(row.id, 80), actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canEditMarket(me.role));
    await sql`delete from market_prices where id = ${data.id}`;
    return { id: data.id };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const role = str(row.role, 20);
    if (!["floor", "procurement", "executive", "admin"].includes(role)) {
      throw new Error("Pick a desk.");
    }
    return { userId: str(row.userId, 120), role: role as Role, actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canAdmin(me.role));
    if (data.userId === context.userId && data.role !== "admin") {
      const others = await sql<{ n: number }>`
        select count(*)::int as n from staff where role = 'admin' and user_id <> ${context.userId}
      `;
      if ((num(others[0]?.n) ?? 0) === 0) throw new Error("Keep at least one admin on the yard.");
    }
    const updated = await sql`
      update staff set role = ${data.role} where user_id = ${data.userId} returning user_id
    `;
    if (!updated[0]) throw new Error("That person has not signed in yet.");
    return { userId: data.userId };
  });

export const clearException = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const kind = str(row.kind, 40);
    if (!EXCEPTION_SET.has(kind as ExceptionKind)) throw new Error("That is not an exception the desk tracks.");
    const fingerprint = str(row.fingerprint, 400);
    if (!fingerprint) throw new Error("That exception has already moved.");
    return {
      deliveryId: str(row.deliveryId, 80),
      kind: kind as ExceptionKind,
      fingerprint,
      note: str(row.note, 300),
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canClearException(me.role));
    const delivery = await sql<{ id: string }>`select id from deliveries where id = ${data.deliveryId}`;
    if (!delivery[0]) throw new Error("That truck is no longer on the log.");
    const who = actor(context.userId, data.actorName);
    const id = `clr_${crypto.randomUUID()}`;
    await sql`
      insert into exception_clears (id, delivery_id, kind, fingerprint, note, cleared_by, cleared_user_id)
      values (${id}, ${data.deliveryId}, ${data.kind}, ${data.fingerprint}, ${data.note}, ${who.name}, ${who.userId})
      on conflict (delivery_id, kind, fingerprint) do nothing
    `;
    await sql`
      insert into audit_events (id, delivery_id, actor_user_id, actor_name, action, detail)
      values (
        ${`aud_${crypto.randomUUID()}`}, ${data.deliveryId}, ${who.userId}, ${who.name},
        'Cleared', ${data.note ? `${data.kind}: ${data.note}` : data.kind}
      )
    `;
    return { id };
  });

export const recordMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const tonnes = numOrNull(row.tonnes);
    if (tonnes === null || tonnes <= 0) throw new Error("Enter the tonnes that moved.");
    const fromCompanyId = str(row.fromCompanyId, 40);
    const toCompanyId = str(row.toCompanyId, 40);
    if (!fromCompanyId || !toCompanyId) throw new Error("Pick both houses.");
    if (fromCompanyId === toCompanyId) throw new Error("A movement has to leave one house for another.");
    return {
      fromCompanyId,
      toCompanyId,
      commodityId: str(row.commodityId, 40),
      tonnes,
      loggedOn: dateOrNull(row.loggedOn) ?? new Date().toISOString().slice(0, 10),
      deliveryId: str(row.deliveryId, 80) || null,
      note: str(row.note, 300),
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canMoveStock(me.role));
    const houses = await sql<{ id: string }>`
      select id from companies where id in (${data.fromCompanyId}, ${data.toCompanyId})
    `;
    if (houses.length < 2) throw new Error("Both houses have to be on the yard.");
    const commodity = await sql<{ id: string }>`select id from commodities where id = ${data.commodityId}`;
    if (!commodity[0]) throw new Error("Pick a commodity.");
    if (data.deliveryId) {
      const delivery = await sql<{ id: string }>`select id from deliveries where id = ${data.deliveryId}`;
      if (!delivery[0]) throw new Error("That truck is no longer on the log.");
    }
    const who = actor(context.userId, data.actorName);
    const id = `mov_${crypto.randomUUID()}`;
    await sql`
      insert into movements (
        id, from_company_id, to_company_id, commodity_id, tonnes, logged_on, delivery_id, note, created_by
      ) values (
        ${id}, ${data.fromCompanyId}, ${data.toCompanyId}, ${data.commodityId}, ${data.tonnes},
        ${data.loggedOn}, ${data.deliveryId}, ${data.note}, ${who.name}
      )
    `;
    if (data.deliveryId) {
      await sql`
        insert into audit_events (id, delivery_id, actor_user_id, actor_name, action, detail)
        values (
          ${`aud_${crypto.randomUUID()}`}, ${data.deliveryId}, ${who.userId}, ${who.name},
          'Movement', ${`${data.tonnes} MT ${data.fromCompanyId} → ${data.toCompanyId}`}
        )
      `;
    }
    return { id };
  });

export const removeMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    return { id: str(row.id, 80), actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canAdmin(me.role));
    const removed = await sql`delete from movements where id = ${data.id} returning id`;
    if (!removed[0]) throw new Error("That movement is already gone.");
    return { id: data.id };
  });

export const saveContract = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    const supplierName = str(row.supplierName, 120);
    const tonnes = numOrNull(row.tonnes);
    if (supplierName.length < 2) throw new Error("Enter the supplier.");
    if (tonnes === null || tonnes <= 0) throw new Error("Enter the contracted tonnes.");
    return {
      companyId: str(row.companyId, 40),
      supplierName,
      commodityId: str(row.commodityId, 40),
      tonnes,
      pricePerMt: nonNeg(numOrNull(row.pricePerMt), "Price"),
      signedOn: dateOrNull(row.signedOn) ?? new Date().toISOString().slice(0, 10),
      note: str(row.note, 300),
      actorName: str(row.actorName, 80),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canRecordContract(me.role));
    const company = await sql<{ id: string }>`select id from companies where id = ${data.companyId}`;
    if (!company[0]) throw new Error("Pick a company on the yard.");
    const commodity = await sql<{ id: string }>`select id from commodities where id = ${data.commodityId}`;
    if (!commodity[0]) throw new Error("Pick a commodity.");
    const who = actor(context.userId, data.actorName);
    const id = `ctr_${crypto.randomUUID()}`;
    await sql`
      insert into contracts (
        id, company_id, supplier_name, commodity_id, tonnes, price_per_mt, signed_on, note, created_by
      ) values (
        ${id}, ${data.companyId}, ${data.supplierName}, ${data.commodityId}, ${data.tonnes},
        ${data.pricePerMt}, ${data.signedOn}, ${data.note}, ${who.name}
      )
    `;
    return { id };
  });

export const removeContract = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    return { id: str(row.id, 80), actorName: str(row.actorName, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureStaff(sql, context.userId, data.actorName, "");
    assertDesk(me.role, canAdmin(me.role));
    const removed = await sql`delete from contracts where id = ${data.id} returning id`;
    if (!removed[0]) throw new Error("That contract is already gone.");
    return { id: data.id };
  });
