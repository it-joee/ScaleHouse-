import { normPlate, type Delivery, type Status } from "@/lib/domain";

export type GatePayload = {
  actorName: string;
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
};

export type OutboxOp = {
  id: string;
  at: string;
  kind: "create" | "update";
  localId: string;
  payload: GatePayload & { id?: string };
  error?: string;
};

const DB_NAME = "jni-scalehouse";
const STORE = "outbox";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the gate book."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The gate book failed."));
  });
}

export function isTransportError(err: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|networkerror|network error|load failed|offline/i.test(message);
}

export async function listOutbox(): Promise<OutboxOp[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await requestToPromise(db.transaction(STORE).objectStore(STORE).getAll());
  db.close();
  return (rows as OutboxOp[]).sort((a, b) => a.at.localeCompare(b.at));
}

async function putOp(op: OutboxOp) {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).put(op));
  db.close();
}

async function deleteOp(id: string) {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  db.close();
}

export async function enqueueCreate(payload: GatePayload) {
  const localId = `local_${crypto.randomUUID()}`;
  await putOp({
    id: localId,
    at: new Date().toISOString(),
    kind: "create",
    localId,
    payload,
  });
  return localId;
}

export async function enqueueUpdate(payload: GatePayload & { id: string }) {
  const ops = await listOutbox();
  const pendingCreate = ops.find((op) => op.kind === "create" && op.localId === payload.id);
  if (pendingCreate) {
    await putOp({ ...pendingCreate, payload, error: undefined, at: new Date().toISOString() });
    return payload.id;
  }
  const pendingUpdate = ops.find((op) => op.kind === "update" && op.localId === payload.id);
  const id = pendingUpdate?.id ?? `op_${crypto.randomUUID()}`;
  await putOp({
    id,
    at: new Date().toISOString(),
    kind: "update",
    localId: payload.id,
    payload,
  });
  return payload.id;
}

export async function flushOutbox(handlers: {
  create: (payload: GatePayload) => Promise<{ id: string }>;
  update: (payload: GatePayload & { id: string }) => Promise<{ id: string }>;
}) {
  const ops = await listOutbox();
  const idMap = new Map<string, string>();
  let done = 0;
  for (const op of ops) {
    try {
      if (op.kind === "create") {
        const created = await handlers.create(op.payload);
        idMap.set(op.localId, created.id);
        await deleteOp(op.id);
        done += 1;
        continue;
      }
      let id = op.payload.id ?? op.localId;
      if (idMap.has(id)) id = idMap.get(id) ?? id;
      if (id.startsWith("local_")) break;
      await handlers.update({ ...op.payload, id });
      await deleteOp(op.id);
      done += 1;
    } catch (err) {
      const message = isTransportError(err)
        ? "Still no signal."
        : err instanceof Error
          ? err.message
          : "Could not sync this ticket.";
      await putOp({ ...op, error: message });
      break;
    }
  }
  return done;
}

function asDelivery(id: string, payload: GatePayload, at: string, previous?: Delivery): Delivery {
  return {
    id,
    companyId: payload.companyId,
    loggedOn: payload.loggedOn,
    waybill: payload.waybill,
    truckNumber: payload.truckNumber,
    truckNorm: normPlate(payload.truckNumber),
    commodityId: payload.commodityId,
    declaredMt: payload.declaredMt,
    sgsMt: payload.sgsMt,
    contractQtyMt: payload.contractQtyMt,
    contractBalMt: payload.contractBalMt,
    grossKg: payload.grossKg,
    tareKg: payload.tareKg,
    moisturePct: payload.moisturePct,
    brokenSeal: payload.brokenSeal,
    damagedBags: payload.damagedBags,
    qcNote: payload.qcNote,
    driverName: payload.driverName,
    driverContact: payload.driverContact,
    origin: payload.origin,
    supplierName: payload.supplierName,
    supplierContact: payload.supplierContact,
    warehouse: payload.warehouse,
    deliveredOn: payload.deliveredOn,
    status: payload.status,
    offloadedOn: payload.offloadedOn,
    comment: payload.comment,
    officer: payload.officer,
    purchasePriceMt: payload.purchasePriceMt,
    marketHubId: payload.marketHubId,
    photoUrl: payload.photoUrl,
    createdBy: previous?.createdBy || payload.actorName,
    createdAt: previous?.createdAt || at,
    modifiedBy: payload.actorName,
    modifiedAt: at,
  };
}

export function applyOutbox(deliveries: Delivery[], ops: OutboxOp[]) {
  const next = new Map(deliveries.map((delivery) => [delivery.id, { ...delivery }]));
  for (const op of ops) {
    if (op.kind === "create") {
      next.set(op.localId, asDelivery(op.localId, op.payload, op.at));
      continue;
    }
    const id = op.payload.id ?? op.localId;
    const current = next.get(id);
    next.set(id, asDelivery(id, op.payload, op.at, current));
  }
  return [...next.values()];
}

export function pendingDeliveryIds(ops: OutboxOp[]) {
  return new Set(ops.map((op) => (op.kind === "create" ? op.localId : (op.payload.id ?? op.localId))));
}
