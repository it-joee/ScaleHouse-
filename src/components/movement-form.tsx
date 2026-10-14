import { useRef, useState } from "react";
import type { Commodity, Company } from "@/lib/domain";
import { recordMovement } from "@/lib/scalehouse.functions";
import { Button, Field, controlClass, scrollToFirstError } from "@/components/ui";

export function MovementForm({
  companies,
  commodities,
  actorName,
  preset,
  onDone,
}: {
  companies: Company[];
  commodities: Commodity[];
  actorName: string;
  preset?: { fromId?: string; toId?: string; deliveryId?: string; tonnes?: number; commodityId?: string };
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [fromId, setFromId] = useState(preset?.fromId ?? "");
  const [toId, setToId] = useState(preset?.toId ?? "");
  const [commodityId, setCommodityId] = useState(preset?.commodityId || commodities[0]?.id || "shea");
  const [tonnes, setTonnes] = useState(preset?.tonnes ? String(preset.tonnes) : "");
  const [loggedOn, setLoggedOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const houses = companies.filter((company) => company.active || company.id === fromId || company.id === toId);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fromId) {
      errs.fromId = "Please select the origin house.";
    }
    if (!toId) {
      errs.toId = "Please select the destination house.";
    } else if (fromId && toId === fromId) {
      errs.toId = "Destination house must be different from origin.";
    }
    if (!tonnes.trim()) {
      errs.tonnes = "Tonnes is required.";
    } else {
      const num = Number(tonnes);
      if (Number.isNaN(num) || num <= 0) {
        errs.tonnes = "Tonnes must be a positive number.";
      }
    }
    if (!loggedOn) {
      errs.loggedOn = "Date is required.";
    }
    return errs;
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
          setFieldErrors(errs);
          setTimeout(() => scrollToFirstError(formRef.current), 40);
          return;
        }
        setBusy(true);
        setError(null);
        recordMovement({
          data: {
            fromCompanyId: fromId,
            toCompanyId: toId,
            commodityId,
            tonnes: Number(tonnes),
            loggedOn,
            deliveryId: preset?.deliveryId ?? "",
            note,
            actorName,
          },
        })
          .then(() => {
            setTonnes("");
            setNote("");
            setFieldErrors({});
            onDone();
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "Could not record the movement.";
            setError(message);
            setTimeout(() => scrollToFirstError(formRef.current), 40);
          })
          .finally(() => setBusy(false));
      }}
    >
      <Field label="From" error={fieldErrors.fromId}>
        <select
          className={controlClass(Boolean(fieldErrors.fromId))}
          aria-invalid={Boolean(fieldErrors.fromId)}
          value={fromId}
          onChange={(event) => {
            setFromId(event.target.value);
            clearFieldError("fromId");
          }}
        >
          <option value="">Select</option>
          {houses.map((company) => (
            <option key={company.id} value={company.id}>
              {company.code} · {company.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="To" error={fieldErrors.toId}>
        <select
          className={controlClass(Boolean(fieldErrors.toId))}
          aria-invalid={Boolean(fieldErrors.toId)}
          value={toId}
          onChange={(event) => {
            setToId(event.target.value);
            clearFieldError("toId");
          }}
        >
          <option value="">Select</option>
          {houses.map((company) => (
            <option key={company.id} value={company.id}>
              {company.code} · {company.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Commodity">
        <select
          className={controlClass(false)}
          value={commodityId}
          onChange={(event) => setCommodityId(event.target.value)}
        >
          {commodities.map((commodity) => (
            <option key={commodity.id} value={commodity.id}>
              {commodity.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tonnes" error={fieldErrors.tonnes}>
        <input
          className={controlClass(Boolean(fieldErrors.tonnes))}
          aria-invalid={Boolean(fieldErrors.tonnes)}
          inputMode="decimal"
          value={tonnes}
          onChange={(event) => {
            setTonnes(event.target.value);
            clearFieldError("tonnes");
          }}
        />
      </Field>
      <Field label="Date" error={fieldErrors.loggedOn}>
        <input
          className={controlClass(Boolean(fieldErrors.loggedOn))}
          aria-invalid={Boolean(fieldErrors.loggedOn)}
          type="date"
          value={loggedOn}
          onChange={(event) => {
            setLoggedOn(event.target.value);
            clearFieldError("loggedOn");
          }}
        />
      </Field>
      <Field label="Note">
        <input
          className={controlClass(false)}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Waybill or warehouse"
        />
      </Field>
      {error ? <p className="text-sm text-accent sm:col-span-2" role="alert">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Record movement"}
        </Button>
      </div>
    </form>
  );
}
