import { useEffect, useMemo, useRef, useState } from "react";
import { STATUSES, normPlate, type Commodity, type Company, type Delivery, type Hub, type Status } from "@/lib/domain";
import type { SpokenFields } from "@/lib/speech-intake";
import { fileToPhoto } from "@/lib/photo";
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

export function DeliveryForm({
  initial,
  companies,
  commodities,
  hubs,
  warehouses,
  openPlates,
  submitLabel,
  spoken,
  onSubmit,
}: {
  initial: Draft;
  companies: Company[];
  commodities: Commodity[];
  hubs: Hub[];
  warehouses: string[];
  openPlates: string[];
  submitLabel: string;
  spoken?: { token: number; fields: SpokenFields } | null;
  onSubmit: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.companyId) {
      errs.companyId = "Please select a sister company.";
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

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const errs = validate();
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
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Bridge and inspection</h2>
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
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Dispatch</h2>
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
        <Field label="Truck photo">
          <input
            className="block w-full text-sm"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              fileToPhoto(file)
                .then((url) => set("photoUrl", url))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not read the photo."));
            }}
          />
        </Field>
        {draft.photoUrl ? (
          <div className="space-y-2">
            <img src={draft.photoUrl} alt="Truck" className="max-h-56 rounded-md border border-line object-cover" />
            <Button variant="quiet" onClick={() => set("photoUrl", "")}>
              Remove photo
            </Button>
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
