import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { STATUSES, normPlate, type Commodity, type Company, type Delivery, type Hub, type Status } from "@/lib/domain";
import type { SpokenFields } from "@/lib/speech-intake";
import { fileToPhoto, parsePhotos, serializePhotos } from "@/lib/photo";
import { cn } from "@/lib/cn";
import { Button, Field, controlClass, scrollToFirstError } from "@/components/ui";

export type Draft = {
  companyId: string;
  loggedOn: string;
  waybill: string;
  truckNumber: string;
  commodityId: string;
  declaredMt: string;
  sgsMt: string;
  contractQtyMt: string;
  contractBalMt: string;
  grossKg: string;
  tareKg: string;
  moisturePct: string;
  brokenSeal: boolean;
  damagedBags: string;
  qcNote: string;
  driverName: string;
  driverContact: string;
  origin: string;
  supplierName: string;
  supplierContact: string;
  warehouse: string;
  deliveredOn: string;
  status: Status;
  offloadedOn: string;
  comment: string;
  officer: string;
  purchasePriceMt: string;
  marketHubId: string;
  photoUrl: string;
};

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function numText(value: number | null) {
  return value === null ? "" : String(value);
}

export function emptyDraft(companyId: string): Draft {
  return {
    companyId: companyId === "all" ? "" : companyId,
    loggedOn: todayISO(),
    waybill: "",
    truckNumber: "",
    commodityId: "shea",
    declaredMt: "",
    sgsMt: "",
    contractQtyMt: "",
    contractBalMt: "",
    grossKg: "",
    tareKg: "",
    moisturePct: "",
    brokenSeal: false,
    damagedBags: "0",
    qcNote: "",
    driverName: "",
    driverContact: "",
    origin: "",
    supplierName: "",
    supplierContact: "",
    warehouse: "",
    deliveredOn: "",
    status: "pending",
    offloadedOn: "",
    comment: "",
    officer: "",
    purchasePriceMt: "",
    marketHubId: "",
    photoUrl: "",
  };
}

export function draftFromDelivery(delivery: Delivery): Draft {
  return {
    companyId: delivery.companyId,
    loggedOn: delivery.loggedOn ?? "",
    waybill: delivery.waybill,
    truckNumber: delivery.truckNumber,
    commodityId: delivery.commodityId,
    declaredMt: numText(delivery.declaredMt),
    sgsMt: numText(delivery.sgsMt),
    contractQtyMt: numText(delivery.contractQtyMt),
    contractBalMt: numText(delivery.contractBalMt),
    grossKg: numText(delivery.grossKg),
    tareKg: numText(delivery.tareKg),
    moisturePct: numText(delivery.moisturePct),
    brokenSeal: delivery.brokenSeal,
    damagedBags: String(delivery.damagedBags),
    qcNote: delivery.qcNote,
    driverName: delivery.driverName,
    driverContact: delivery.driverContact,
    origin: delivery.origin,
    supplierName: delivery.supplierName,
    supplierContact: delivery.supplierContact,
    warehouse: delivery.warehouse,
    deliveredOn: delivery.deliveredOn ?? "",
    status: delivery.status,
    offloadedOn: delivery.offloadedOn ?? "",
    comment: delivery.comment,
    officer: delivery.officer,
    purchasePriceMt: numText(delivery.purchasePriceMt),
    marketHubId: delivery.marketHubId ?? "",
    photoUrl: delivery.photoUrl,
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Check the numbers — one of them is not a figure.");
  return n;
}

export function payloadFromDraft(draft: Draft) {
  const bags = draft.damagedBags.trim() === "" ? 0 : Number(draft.damagedBags);
  if (!Number.isInteger(bags)) throw new Error("Damaged bags should be a whole number.");
  return {
    companyId: draft.companyId,
    loggedOn: draft.loggedOn || null,
    waybill: draft.waybill,
    truckNumber: draft.truckNumber,
    commodityId: draft.commodityId,
    declaredMt: optionalNumber(draft.declaredMt),
    sgsMt: optionalNumber(draft.sgsMt),
    contractQtyMt: optionalNumber(draft.contractQtyMt),
    contractBalMt: optionalNumber(draft.contractBalMt),
    grossKg: optionalNumber(draft.grossKg),
    tareKg: optionalNumber(draft.tareKg),
    moisturePct: optionalNumber(draft.moisturePct),
    brokenSeal: draft.brokenSeal,
    damagedBags: bags,
    qcNote: draft.qcNote,
    driverName: draft.driverName,
    driverContact: draft.driverContact,
    origin: draft.origin,
    supplierName: draft.supplierName,
    supplierContact: draft.supplierContact,
    warehouse: draft.warehouse,
    deliveredOn: draft.deliveredOn || null,
    status: draft.status,
    offloadedOn: draft.offloadedOn || null,
    comment: draft.comment,
    officer: draft.officer,
    purchasePriceMt: optionalNumber(draft.purchasePriceMt),
    marketHubId: draft.marketHubId || null,
    photoUrl: draft.photoUrl,
  };
}

const WAYBILL_KEYS: (keyof Draft)[] = [
  "companyId",
  "loggedOn",
  "waybill",
  "truckNumber",
  "commodityId",
  "declaredMt",
  "sgsMt",
  "origin",
  "driverName",
  "driverContact",
  "supplierName",
  "supplierContact",
  "contractQtyMt",
  "contractBalMt",
];

const BRIDGE_KEYS: (keyof Draft)[] = [
  "grossKg",
  "tareKg",
  "moisturePct",
  "damagedBags",
  "purchasePriceMt",
  "marketHubId",
  "brokenSeal",
  "qcNote",
];

const DISPATCH_KEYS: (keyof Draft)[] = [
  "status",
  "warehouse",
  "deliveredOn",
  "offloadedOn",
  "officer",
  "comment",
  "photoUrl",
];

function isFieldDifferent(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return a !== b;
  }
  const strA = (a === null || a === undefined ? "" : String(a)).trim();
  const strB = (b === null || b === undefined ? "" : String(b)).trim();
  return strA !== strB;
}

export function DeliveryForm({
  initial,
  companies,
  commodities,
  hubs,
  warehouses,
  openPlates,
  submitLabel = "Save ticket",
  spoken,
  mode = "single",
  onSubmit,
}: {
  initial: Draft;
  companies: Company[];
  commodities: Commodity[];
  hubs: Hub[];
  warehouses: string[];
  openPlates: string[];
  submitLabel?: string;
  spoken?: { token: number; fields: SpokenFields } | null;
  mode?: "single" | "cards";
  onSubmit: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [lastSaved, setLastSaved] = useState<Draft>(initial);
  const lastSavedRef = useRef<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busySection, setBusySection] = useState<"waybill" | "bridge" | "dispatch" | null>(null);
  const [waybillSuccess, setWaybillSuccess] = useState<string | null>(null);
  const [bridgeSuccess, setBridgeSuccess] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [waybillError, setWaybillError] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const waybillFormRef = useRef<HTMLFormElement>(null);
  const bridgeFormRef = useRef<HTMLFormElement>(null);
  const dispatchFormRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lastSavedRef.current = lastSaved;
  }, [lastSaved]);

  useEffect(() => {
    const prevSaved = lastSavedRef.current;
    setLastSaved(initial);
    lastSavedRef.current = initial;
    setDraft((current) => {
      const next: Draft = { ...current };
      for (const k of WAYBILL_KEYS) {
        if (!isFieldDifferent(current[k], prevSaved[k])) {
          (next as Record<string, unknown>)[k] = initial[k];
        }
      }
      for (const k of BRIDGE_KEYS) {
        if (!isFieldDifferent(current[k], prevSaved[k])) {
          (next as Record<string, unknown>)[k] = initial[k];
        }
      }
      for (const k of DISPATCH_KEYS) {
        if (!isFieldDifferent(current[k], prevSaved[k])) {
          (next as Record<string, unknown>)[k] = initial[k];
        }
      }
      return next;
    });
  }, [initial]);

  const isWaybillDirty = useMemo(
    () => WAYBILL_KEYS.some((key) => isFieldDifferent(draft[key], lastSaved[key])),
    [draft, lastSaved],
  );

  const isBridgeDirty = useMemo(
    () => BRIDGE_KEYS.some((key) => isFieldDifferent(draft[key], lastSaved[key])),
    [draft, lastSaved],
  );

  const isDispatchDirty = useMemo(
    () => DISPATCH_KEYS.some((key) => isFieldDifferent(draft[key], lastSaved[key])),
    [draft, lastSaved],
  );

  useEffect(() => {
    if (!spoken) return;
    setDraft((current) => ({
      ...current,
      truckNumber: spoken.fields.truckNumber ?? current.truckNumber,
      declaredMt: spoken.fields.declaredMt ?? current.declaredMt,
      supplierName: spoken.fields.supplierName ?? current.supplierName,
      origin: spoken.fields.origin ?? current.origin,
      waybill: spoken.fields.waybill ?? current.waybill,
      driverName: spoken.fields.driverName ?? current.driverName,
      driverContact: spoken.fields.driverContact ?? current.driverContact,
      commodityId: spoken.fields.commodityId ?? current.commodityId,
    }));
  }, [spoken]);
  const plate = normPlate(draft.truckNumber);
  const clash = useMemo(
    () => (plate ? openPlates.filter((item) => item === plate) : []),
    [openPlates, plate],
  );
  const net =
    draft.grossKg && draft.tareKg
      ? Math.round((Number(draft.grossKg) - Number(draft.tareKg)) / 10) / 100
      : null;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  const validateWaybill = () => {
    const errs: Record<string, string> = {};
    if (!draft.companyId) {
      errs.companyId = "Please select a company.";
    }
    if (!draft.truckNumber.trim()) {
      errs.truckNumber = "Truck plate number is required.";
    }
    if (draft.declaredMt) {
      const num = Number(draft.declaredMt);
      if (Number.isNaN(num) || num <= 0) {
        errs.declaredMt = "Declared quantity must be a positive number.";
      }
    }
    if (draft.sgsMt) {
      const num = Number(draft.sgsMt);
      if (Number.isNaN(num) || num <= 0) {
        errs.sgsMt = "SGS quantity must be a positive number.";
      }
    }
    if (draft.contractQtyMt) {
      const num = Number(draft.contractQtyMt);
      if (Number.isNaN(num) || num < 0) {
        errs.contractQtyMt = "Contract quantity cannot be negative.";
      }
    }
    if (draft.contractBalMt) {
      const num = Number(draft.contractBalMt);
      if (Number.isNaN(num) || num < 0) {
        errs.contractBalMt = "Contract balance cannot be negative.";
      }
    }
    return errs;
  };

  const validateBridge = () => {
    const errs: Record<string, string> = {};
    if (draft.grossKg) {
      const num = Number(draft.grossKg);
      if (Number.isNaN(num) || num <= 0) {
        errs.grossKg = "Gross weight must be a positive number.";
      }
    }
    if (draft.tareKg) {
      const num = Number(draft.tareKg);
      if (Number.isNaN(num) || num <= 0) {
        errs.tareKg = "Tare weight must be a positive number.";
      }
    }
    if (
      draft.grossKg &&
      draft.tareKg &&
      !Number.isNaN(Number(draft.grossKg)) &&
      !Number.isNaN(Number(draft.tareKg)) &&
      Number(draft.tareKg) >= Number(draft.grossKg)
    ) {
      errs.tareKg = "Tare weight cannot exceed or equal gross weight.";
    }
    if (draft.moisturePct) {
      const num = Number(draft.moisturePct);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        errs.moisturePct = "Moisture must be between 0% and 100%.";
      }
    }
    if (draft.damagedBags) {
      const num = Number(draft.damagedBags);
      if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
        errs.damagedBags = "Damaged bags must be 0 or a positive whole number.";
      }
    }
    if (draft.purchasePriceMt) {
      const num = Number(draft.purchasePriceMt);
      if (Number.isNaN(num) || num <= 0) {
        errs.purchasePriceMt = "Purchase price must be a positive number.";
      }
    }
    return errs;
  };

  const validateDispatch = () => {
    return {} as Record<string, string>;
  };

  const validateAll = () => {
    return { ...validateWaybill(), ...validateBridge(), ...validateDispatch() };
  };

  const handleSaveWaybill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isWaybillDirty || busySection === "waybill") return;
    const errs = validateWaybill();
    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setTimeout(() => scrollToFirstError(waybillFormRef.current), 40);
      return;
    }
    setBusySection("waybill");
    setWaybillError(null);
    setWaybillSuccess(null);
    const sectionDraft: Draft = {
      ...lastSaved,
      companyId: draft.companyId,
      loggedOn: draft.loggedOn,
      waybill: draft.waybill,
      truckNumber: draft.truckNumber,
      commodityId: draft.commodityId,
      declaredMt: draft.declaredMt,
      sgsMt: draft.sgsMt,
      origin: draft.origin,
      driverName: draft.driverName,
      driverContact: draft.driverContact,
      supplierName: draft.supplierName,
      supplierContact: draft.supplierContact,
      contractQtyMt: draft.contractQtyMt,
      contractBalMt: draft.contractBalMt,
    };
    onSubmit(sectionDraft)
      .then(() => {
        setLastSaved((prev) => ({
          ...prev,
          companyId: draft.companyId,
          loggedOn: draft.loggedOn,
          waybill: draft.waybill,
          truckNumber: draft.truckNumber,
          commodityId: draft.commodityId,
          declaredMt: draft.declaredMt,
          sgsMt: draft.sgsMt,
          origin: draft.origin,
          driverName: draft.driverName,
          driverContact: draft.driverContact,
          supplierName: draft.supplierName,
          supplierContact: draft.supplierContact,
          contractQtyMt: draft.contractQtyMt,
          contractBalMt: draft.contractBalMt,
        }));
        setWaybillSuccess("Waybill saved.");
        setTimeout(() => setWaybillSuccess(null), 3500);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not save waybill.";
        setWaybillError(message);
        if (/company/i.test(message)) {
          setFieldErrors((prev) => ({ ...prev, companyId: message }));
        } else if (/truck|plate/i.test(message)) {
          setFieldErrors((prev) => ({ ...prev, truckNumber: message }));
        }
        setTimeout(() => scrollToFirstError(waybillFormRef.current), 40);
      })
      .finally(() => setBusySection(null));
  };

  const handleSaveBridge = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBridgeDirty || busySection === "bridge") return;
    const errs = validateBridge();
    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setTimeout(() => scrollToFirstError(bridgeFormRef.current), 40);
      return;
    }
    setBusySection("bridge");
    setBridgeError(null);
    setBridgeSuccess(null);
    const sectionDraft: Draft = {
      ...lastSaved,
      grossKg: draft.grossKg,
      tareKg: draft.tareKg,
      moisturePct: draft.moisturePct,
      damagedBags: draft.damagedBags,
      purchasePriceMt: draft.purchasePriceMt,
      marketHubId: draft.marketHubId,
      brokenSeal: draft.brokenSeal,
      qcNote: draft.qcNote,
    };
    onSubmit(sectionDraft)
      .then(() => {
        setLastSaved((prev) => ({
          ...prev,
          grossKg: draft.grossKg,
          tareKg: draft.tareKg,
          moisturePct: draft.moisturePct,
          damagedBags: draft.damagedBags,
          purchasePriceMt: draft.purchasePriceMt,
          marketHubId: draft.marketHubId,
          brokenSeal: draft.brokenSeal,
          qcNote: draft.qcNote,
        }));
        setBridgeSuccess("Bridge and inspection saved.");
        setTimeout(() => setBridgeSuccess(null), 3500);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not save bridge and inspection.";
        setBridgeError(message);
        setTimeout(() => scrollToFirstError(bridgeFormRef.current), 40);
      })
      .finally(() => setBusySection(null));
  };

  const handleSaveDispatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isDispatchDirty || busySection === "dispatch") return;
    const errs = validateDispatch();
    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setTimeout(() => scrollToFirstError(dispatchFormRef.current), 40);
      return;
    }
    setBusySection("dispatch");
    setDispatchError(null);
    setDispatchSuccess(null);
    const sectionDraft: Draft = {
      ...lastSaved,
      status: draft.status,
      warehouse: draft.warehouse,
      deliveredOn: draft.deliveredOn,
      offloadedOn: draft.offloadedOn,
      officer: draft.officer,
      comment: draft.comment,
      photoUrl: draft.photoUrl,
    };
    onSubmit(sectionDraft)
      .then(() => {
        setLastSaved((prev) => ({
          ...prev,
          status: draft.status,
          warehouse: draft.warehouse,
          deliveredOn: draft.deliveredOn,
          offloadedOn: draft.offloadedOn,
          officer: draft.officer,
          comment: draft.comment,
          photoUrl: draft.photoUrl,
        }));
        setDispatchSuccess("Dispatch saved.");
        setTimeout(() => setDispatchSuccess(null), 3500);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not save dispatch.";
        setDispatchError(message);
        setTimeout(() => scrollToFirstError(dispatchFormRef.current), 40);
      })
      .finally(() => setBusySection(null));
  };

  const renderWaybillFields = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" error={fieldErrors.companyId}>
          <select
            className={controlClass(Boolean(fieldErrors.companyId))}
            aria-invalid={Boolean(fieldErrors.companyId)}
            value={draft.companyId}
            onChange={(event) => set("companyId", event.target.value)}
            required
          >
            <option value="">Select</option>
            {companies.filter((company) => company.active || company.id === draft.companyId).map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} · {company.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" error={fieldErrors.loggedOn}>
          <input
            className={controlClass(Boolean(fieldErrors.loggedOn))}
            aria-invalid={Boolean(fieldErrors.loggedOn)}
            type="date"
            value={draft.loggedOn}
            onChange={(event) => set("loggedOn", event.target.value)}
          />
        </Field>
        <Field label="Waybill number" hint="Leave blank only if the paper has not reached the gate." error={fieldErrors.waybill}>
          <input
            className={controlClass(Boolean(fieldErrors.waybill))}
            aria-invalid={Boolean(fieldErrors.waybill)}
            value={draft.waybill}
            onChange={(event) => set("waybill", event.target.value)}
          />
        </Field>
        <Field label="Truck number" error={fieldErrors.truckNumber}>
          <input
            className={controlClass(Boolean(fieldErrors.truckNumber))}
            aria-invalid={Boolean(fieldErrors.truckNumber)}
            value={draft.truckNumber}
            onChange={(event) => set("truckNumber", event.target.value)}
            required
          />
        </Field>
        <Field label="Commodity" error={fieldErrors.commodityId}>
          <select
            className={controlClass(Boolean(fieldErrors.commodityId))}
            aria-invalid={Boolean(fieldErrors.commodityId)}
            value={draft.commodityId}
            onChange={(event) => set("commodityId", event.target.value)}
          >
            {commodities.map((commodity) => (
              <option key={commodity.id} value={commodity.id}>
                {commodity.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Declared quantity (MT)" error={fieldErrors.declaredMt}>
          <input
            className={controlClass(Boolean(fieldErrors.declaredMt))}
            aria-invalid={Boolean(fieldErrors.declaredMt)}
            inputMode="decimal"
            value={draft.declaredMt}
            onChange={(event) => set("declaredMt", event.target.value)}
          />
        </Field>
        <Field label="SGS quantity (MT)" error={fieldErrors.sgsMt}>
          <input
            className={controlClass(Boolean(fieldErrors.sgsMt))}
            aria-invalid={Boolean(fieldErrors.sgsMt)}
            inputMode="decimal"
            value={draft.sgsMt}
            onChange={(event) => set("sgsMt", event.target.value)}
          />
        </Field>
        <Field label="Origin" error={fieldErrors.origin}>
          <input
            className={controlClass(Boolean(fieldErrors.origin))}
            aria-invalid={Boolean(fieldErrors.origin)}
            value={draft.origin}
            onChange={(event) => set("origin", event.target.value)}
          />
        </Field>
        <Field label="Driver" error={fieldErrors.driverName}>
          <input
            className={controlClass(Boolean(fieldErrors.driverName))}
            aria-invalid={Boolean(fieldErrors.driverName)}
            value={draft.driverName}
            onChange={(event) => set("driverName", event.target.value)}
          />
        </Field>
        <Field label="Driver contact" error={fieldErrors.driverContact}>
          <input
            className={controlClass(Boolean(fieldErrors.driverContact))}
            aria-invalid={Boolean(fieldErrors.driverContact)}
            value={draft.driverContact}
            onChange={(event) => set("driverContact", event.target.value)}
          />
        </Field>
        <Field label="Supplier" error={fieldErrors.supplierName}>
          <input
            className={controlClass(Boolean(fieldErrors.supplierName))}
            aria-invalid={Boolean(fieldErrors.supplierName)}
            value={draft.supplierName}
            onChange={(event) => set("supplierName", event.target.value)}
          />
        </Field>
        <Field label="Supplier contact" error={fieldErrors.supplierContact}>
          <input
            className={controlClass(Boolean(fieldErrors.supplierContact))}
            aria-invalid={Boolean(fieldErrors.supplierContact)}
            value={draft.supplierContact}
            onChange={(event) => set("supplierContact", event.target.value)}
          />
        </Field>
        <Field label="Contract quantity (MT)" error={fieldErrors.contractQtyMt}>
          <input
            className={controlClass(Boolean(fieldErrors.contractQtyMt))}
            aria-invalid={Boolean(fieldErrors.contractQtyMt)}
            inputMode="decimal"
            value={draft.contractQtyMt}
            onChange={(event) => set("contractQtyMt", event.target.value)}
          />
        </Field>
        <Field label="Contract balance (MT)" error={fieldErrors.contractBalMt}>
          <input
            className={controlClass(Boolean(fieldErrors.contractBalMt))}
            aria-invalid={Boolean(fieldErrors.contractBalMt)}
            inputMode="decimal"
            value={draft.contractBalMt}
            onChange={(event) => set("contractBalMt", event.target.value)}
          />
        </Field>
      </div>
      {clash.length > 0 ? (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          Plate {plate} is already open on the yard. Check it is not a double entry.
        </p>
      ) : null}
      {!draft.waybill.trim() ? (
        <p className="text-sm text-muted">No waybill yet. The comment should say who to chase.</p>
      ) : null}
    </>
  );

  const renderBridgeFields = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gross (kg)" error={fieldErrors.grossKg}>
          <input
            className={controlClass(Boolean(fieldErrors.grossKg))}
            aria-invalid={Boolean(fieldErrors.grossKg)}
            inputMode="decimal"
            value={draft.grossKg}
            onChange={(event) => set("grossKg", event.target.value)}
          />
        </Field>
        <Field label="Tare (kg)" error={fieldErrors.tareKg}>
          <input
            className={controlClass(Boolean(fieldErrors.tareKg))}
            aria-invalid={Boolean(fieldErrors.tareKg)}
            inputMode="decimal"
            value={draft.tareKg}
            onChange={(event) => set("tareKg", event.target.value)}
          />
        </Field>
        <Field label="Moisture %" error={fieldErrors.moisturePct}>
          <input
            className={controlClass(Boolean(fieldErrors.moisturePct))}
            aria-invalid={Boolean(fieldErrors.moisturePct)}
            inputMode="decimal"
            value={draft.moisturePct}
            onChange={(event) => set("moisturePct", event.target.value)}
          />
        </Field>
        <Field label="Damaged bags" error={fieldErrors.damagedBags}>
          <input
            className={controlClass(Boolean(fieldErrors.damagedBags))}
            aria-invalid={Boolean(fieldErrors.damagedBags)}
            inputMode="numeric"
            value={draft.damagedBags}
            onChange={(event) => set("damagedBags", event.target.value)}
          />
        </Field>
        <Field label="Purchase price (GHS / MT)" error={fieldErrors.purchasePriceMt}>
          <input
            className={controlClass(Boolean(fieldErrors.purchasePriceMt))}
            aria-invalid={Boolean(fieldErrors.purchasePriceMt)}
            inputMode="decimal"
            value={draft.purchasePriceMt}
            onChange={(event) => set("purchasePriceMt", event.target.value)}
          />
        </Field>
        <Field label="Market hub" error={fieldErrors.marketHubId}>
          <select
            className={controlClass(Boolean(fieldErrors.marketHubId))}
            aria-invalid={Boolean(fieldErrors.marketHubId)}
            value={draft.marketHubId}
            onChange={(event) => set("marketHubId", event.target.value)}
          >
            <option value="">Not set</option>
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-sm text-muted tabular-nums">
        Bridge net: {net === null || Number.isNaN(net) ? "—" : `${net.toFixed(2)} MT`}
      </p>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={draft.brokenSeal}
          onChange={(event) => set("brokenSeal", event.target.checked)}
        />
        Broken seal — do not clear to tip
      </label>
      <Field label="QC note" error={fieldErrors.qcNote}>
        <input
          className={controlClass(Boolean(fieldErrors.qcNote))}
          aria-invalid={Boolean(fieldErrors.qcNote)}
          value={draft.qcNote}
          onChange={(event) => set("qcNote", event.target.value)}
        />
      </Field>
    </>
  );

  const renderDispatchFields = () => {
    const photos = parsePhotos(draft.photoUrl);
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set("status", id)}
              className={
                draft.status === id
                  ? "h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg"
                  : "h-11 rounded-md border border-line bg-surface px-3 text-sm font-semibold text-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Warehouse" error={fieldErrors.warehouse}>
            <input
              className={controlClass(Boolean(fieldErrors.warehouse))}
              aria-invalid={Boolean(fieldErrors.warehouse)}
              list="warehouses"
              value={draft.warehouse}
              onChange={(event) => set("warehouse", event.target.value)}
            />
            <datalist id="warehouses">
              {warehouses.map((warehouse) => (
                <option key={warehouse} value={warehouse} />
              ))}
            </datalist>
          </Field>
          <Field label="Delivered to warehouse" error={fieldErrors.deliveredOn}>
            <input
              className={controlClass(Boolean(fieldErrors.deliveredOn))}
              aria-invalid={Boolean(fieldErrors.deliveredOn)}
              type="date"
              value={draft.deliveredOn}
              onChange={(event) => set("deliveredOn", event.target.value)}
            />
          </Field>
          <Field label="Date offloaded" error={fieldErrors.offloadedOn}>
            <input
              className={controlClass(Boolean(fieldErrors.offloadedOn))}
              aria-invalid={Boolean(fieldErrors.offloadedOn)}
              type="date"
              value={draft.offloadedOn}
              onChange={(event) => set("offloadedOn", event.target.value)}
            />
          </Field>
          <Field label="Officer in charge" error={fieldErrors.officer}>
            <input
              className={controlClass(Boolean(fieldErrors.officer))}
              aria-invalid={Boolean(fieldErrors.officer)}
              value={draft.officer}
              onChange={(event) => set("officer", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Comment" error={fieldErrors.comment}>
          <textarea
            className={cn(
              "min-h-24 w-full rounded-md border bg-surface px-3 py-2 text-base text-ink outline-none transition-colors",
              fieldErrors.comment
                ? "border-accent ring-1 ring-accent focus:border-accent"
                : "border-line focus:border-primary focus:ring-2 focus:ring-primary/20",
            )}
            aria-invalid={Boolean(fieldErrors.comment)}
            value={draft.comment}
            onChange={(event) => set("comment", event.target.value)}
          />
        </Field>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">
              Truck photo{photos.length > 1 ? `s (${photos.length})` : ""}
            </span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length === 0) return;
                setPhotoBusy(true);
                setPhotoError(null);
                try {
                  const newUrls: string[] = [];
                  for (const file of files) {
                    const url = await fileToPhoto(file);
                    newUrls.push(url);
                  }
                  const updated = [...photos, ...newUrls];
                  set("photoUrl", serializePhotos(updated));
                } catch (err: unknown) {
                  setPhotoError(err instanceof Error ? err.message : "Could not read the photo.");
                } finally {
                  setPhotoBusy(false);
                  if (event.target) event.target.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="quiet"
              disabled={photoBusy}
              onClick={() => photoInputRef.current?.click()}
              className="h-9 px-3 text-xs"
            >
              <Upload className="size-3.5" />
              {photos.length > 0 ? "Upload new photos" : "Upload photo"}
            </Button>
          </div>

          {photoError ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">
              {photoError}
            </p>
          ) : null}

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((url, idx) => (
                <div key={idx} className="group relative overflow-hidden rounded-md border border-line bg-surface shadow-2xs">
                  <img
                    src={url}
                    alt={`Truck photo ${idx + 1}`}
                    className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    aria-label={`Remove photo ${idx + 1}`}
                    onClick={() => {
                      const next = photos.filter((_, i) => i !== idx);
                      set("photoUrl", serializePhotos(next));
                    }}
                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-ink/80 text-surface backdrop-blur-xs transition hover:bg-accent focus:outline-none"
                    title="Remove this photo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <div className="absolute bottom-1 left-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-surface">
                    #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => photoInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-surface/50 p-6 text-center transition hover:border-primary hover:bg-surface"
            >
              <ImageIcon className="size-8 text-muted/60" />
              <p className="mt-2 text-sm font-semibold text-ink">No photo yet</p>
              <p className="text-xs text-muted">Click or tap to upload photo (JPEG, PNG)</p>
            </div>
          )}

          {photoBusy ? (
            <p className="text-xs font-semibold text-primary animate-pulse">
              Processing photo…
            </p>
          ) : null}
        </div>
      </>
    );
  };

  if (mode === "cards") {
    return (
      <div className="space-y-6">
        {/* Card 1: Waybill */}
        <form
          ref={waybillFormRef}
          noValidate
          className="no-print rounded-lg border border-line bg-surface p-5 space-y-4 shadow-xs"
          onSubmit={handleSaveWaybill}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-2xl">Waybill</h2>
            {waybillSuccess ? (
              <span className="text-sm font-semibold text-primary" role="status">
                {waybillSuccess}
              </span>
            ) : null}
          </div>
          {renderWaybillFields()}
          {waybillError ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">
              {waybillError}
            </p>
          ) : null}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={busySection === "waybill" || !isWaybillDirty}
              title={!isWaybillDirty ? "No changes in waybill to save" : undefined}
            >
              {busySection === "waybill" ? "Saving…" : "Save waybill"}
            </Button>
          </div>
        </form>

        {/* Card 2: Bridge and inspection */}
        <form
          ref={bridgeFormRef}
          noValidate
          className="no-print rounded-lg border border-line bg-surface p-5 space-y-4 shadow-xs"
          onSubmit={handleSaveBridge}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-2xl">Bridge and inspection</h2>
            {bridgeSuccess ? (
              <span className="text-sm font-semibold text-primary" role="status">
                {bridgeSuccess}
              </span>
            ) : null}
          </div>
          {renderBridgeFields()}
          {bridgeError ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">
              {bridgeError}
            </p>
          ) : null}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={busySection === "bridge" || !isBridgeDirty}
              title={!isBridgeDirty ? "No changes in bridge & inspection to save" : undefined}
            >
              {busySection === "bridge" ? "Saving…" : "Save bridge & inspection"}
            </Button>
          </div>
        </form>

        {/* Card 3: Dispatch */}
        <form
          ref={dispatchFormRef}
          noValidate
          className="no-print rounded-lg border border-line bg-surface p-5 space-y-4 shadow-xs"
          onSubmit={handleSaveDispatch}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-2xl">Dispatch</h2>
            {dispatchSuccess ? (
              <span className="text-sm font-semibold text-primary" role="status">
                {dispatchSuccess}
              </span>
            ) : null}
          </div>
          {renderDispatchFields()}
          {dispatchError ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">
              {dispatchError}
            </p>
          ) : null}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={busySection === "dispatch" || !isDispatchDirty}
              title={!isDispatchDirty ? "No changes in dispatch to save" : undefined}
            >
              {busySection === "dispatch" ? "Saving…" : "Save dispatch"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const errs = validateAll();
        if (Object.keys(errs).length > 0) {
          setFieldErrors(errs);
          setTimeout(() => {
            scrollToFirstError(formRef.current);
          }, 40);
          return;
        }
        setBusy(true);
        setError(null);
        onSubmit(draft)
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "Could not save.";
            setError(message);
            if (/company/i.test(message)) {
              setFieldErrors((prev) => ({ ...prev, companyId: message }));
            } else if (/truck|plate/i.test(message)) {
              setFieldErrors((prev) => ({ ...prev, truckNumber: message }));
            }
            setTimeout(() => {
              scrollToFirstError(formRef.current);
            }, 40);
          })
          .finally(() => setBusy(false));
      }}
    >
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Waybill</h2>
        {renderWaybillFields()}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Bridge and inspection</h2>
        {renderBridgeFields()}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Dispatch</h2>
        {renderDispatchFields()}
      </section>

      {error ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
