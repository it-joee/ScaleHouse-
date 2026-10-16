import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canAdmin, canRecordContract, contractBooks, formatGhs, formatMt, houseContract, tonnesLeft } from "@/lib/domain";
import { removeContract, saveContract } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { Button, Field, Panel, Stat, controlClass, scrollToFirstError } from "@/components/ui";

export const Route = createFileRoute("/_app/contracts")({ component: ContractsPage });

function ContractsPage() {
  const { workspace, companyId, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const formRef = useRef<HTMLFormElement | null>(null);
  const [company, setCompany] = useState("");
  const [supplier, setSupplier] = useState("");
  const [commodityId, setCommodityId] = useState("shea");
  const [tonnes, setTonnes] = useState("");
  const [price, setPrice] = useState("");
  const [signedOn, setSignedOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const books = useMemo(() => (open ? contractBooks(open.contracts, open.deliveries) : []), [open]);
  if (!open) return null;
  const houses = open.companies.filter((item) => item.active && (companyId === "all" || item.id === companyId));
  const visible = books.filter((book) => companyId === "all" || book.contract.companyId === companyId);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  const code = (id: string) => open.companies.find((item) => item.id === id)?.code ?? id;
  const commodityName = (id: string) => open.commodities.find((item) => item.id === id)?.name ?? id;
  const names = [...new Set(open.deliveries.map((item) => item.supplierName.trim()).filter((name) => name.length > 1))].sort((a, b) =>
    a.localeCompare(b),
  );
  const focus = companyId === "all" ? null : houseContract(companyId, books);

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
    const selectedCompany = company || (companyId !== "all" ? companyId : "");
    const errs: Record<string, string> = {};
    if (!selectedCompany) {
      errs.company = "Please select a company.";
    }
    if (!supplier.trim()) {
      errs.supplier = "Supplier name is required.";
    }
    if (!tonnes.trim()) {
      errs.tonnes = "Tonnes is required.";
    } else {
      const num = Number(tonnes);
      if (Number.isNaN(num) || num <= 0) {
        errs.tonnes = "Tonnes must be a positive number.";
      }
    }
    if (price.trim() !== "") {
      const num = Number(price);
      if (Number.isNaN(num) || num < 0) {
        errs.price = "Price must be a valid number.";
      }
    }
    if (!signedOn) {
      errs.signedOn = "Signed date is required.";
    }
    return errs;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Contracts</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Track contracted tonnage for each company and supplier. Deliveries automatically draw down contract balances as trucks arrive and offload at the yard.
        </p>
      </div>
      {focus ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Promised" value={formatMt(focus.promised)} note={`${focus.count} contracts`} />
          <Stat label="Received" value={formatMt(focus.received)} note="Offloaded against the paper" />
          <Stat label="In the yard" value={formatMt(focus.inYard)} note="Not yet tipped" />
          <Stat label="Still to come" value={tonnesLeft(focus.stillToCome)} note="Promised, not yet on a ticket" />
        </div>
      ) : (
        <Panel title="Summary by company">
          <ul className="divide-y divide-line">
            {houses.map((item) => {
              const standing = houseContract(item.id, books);
              return (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <p className="font-semibold">
                    {item.code} · {item.name}
                  </p>
                  <p className="tabular-nums text-muted">
                    {formatMt(standing.promised)} promised · {formatMt(standing.received)} received · {tonnesLeft(standing.stillToCome)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {canRecordContract(open.me.role) ? (
        <Panel title="New contract">
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
              const selectedCompany = company || (companyId !== "all" ? companyId : "");
              saveContract({
                data: {
                  companyId: selectedCompany,
                  supplierName: supplier,
                  commodityId,
                  tonnes: Number(tonnes),
                  pricePerMt: price.trim() === "" ? null : Number(price),
                  signedOn,
                  note,
                  actorName: actor,
                },
              })
                .then(() => {
                  setSupplier("");
                  setTonnes("");
                  setPrice("");
                  setNote("");
                  setFieldErrors({});
                  reload();
                })
                .catch((err: unknown) => {
                  const message = err instanceof Error ? err.message : "Could not save the contract.";
                  setError(message);
                  setTimeout(() => scrollToFirstError(formRef.current), 40);
                })
                .finally(() => setBusy(false));
            }}
          >
            <Field label="House" error={fieldErrors.company}>
              <select
                className={controlClass(Boolean(fieldErrors.company))}
                aria-invalid={Boolean(fieldErrors.company)}
                value={company || (companyId !== "all" ? companyId : "")}
                onChange={(event) => {
                  setCompany(event.target.value);
                  clearFieldError("company");
                }}
              >
                <option value="">Select</option>
                {open.companies.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier" error={fieldErrors.supplier}>
              <input
                className={controlClass(Boolean(fieldErrors.supplier))}
                aria-invalid={Boolean(fieldErrors.supplier)}
                list="known-suppliers"
                value={supplier}
                onChange={(event) => {
                  setSupplier(event.target.value);
                  clearFieldError("supplier");
                }}
              />
              <datalist id="known-suppliers">
                {names.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <Field label="Commodity">
              <select
                className={controlClass(false)}
                value={commodityId}
                onChange={(event) => setCommodityId(event.target.value)}
              >
                {open.commodities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
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
            <Field label="Price per MT" hint="Optional." error={fieldErrors.price}>
              <input
                className={controlClass(Boolean(fieldErrors.price))}
                aria-invalid={Boolean(fieldErrors.price)}
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  clearFieldError("price");
                }}
              />
            </Field>
            <Field label="Signed" error={fieldErrors.signedOn}>
              <input
                className={controlClass(Boolean(fieldErrors.signedOn))}
                aria-invalid={Boolean(fieldErrors.signedOn)}
                type="date"
                value={signedOn}
                onChange={(event) => {
                  setSignedOn(event.target.value);
                  clearFieldError("signedOn");
                }}
              />
            </Field>
            <Field label="Note">
              <input
                className={controlClass(false)}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            {error ? <p className="text-sm text-accent sm:col-span-2" role="alert">{error}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Record contract"}
              </Button>
            </div>
          </form>
        </Panel>
      ) : (
        <p className="text-sm text-muted">Procurement and administrators can record new contracts. Other roles can view current balances.</p>
      )}
      <Panel title="Active contracts">
        {visible.length === 0 ? (
          <p className="text-sm text-muted">No contracts on file yet. Recorded contracts will display here with live fulfillment tracking.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((book) => (
              <li key={book.contract.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {code(book.contract.companyId)} · {book.contract.supplierName}
                  </p>
                  <p className="text-muted">
                    {commodityName(book.contract.commodityId)} · {formatMt(book.contract.tonnes)} MT promised · signed {book.contract.signedOn}
                    {book.contract.pricePerMt !== null ? ` · ${formatGhs(book.contract.pricePerMt)}` : ""}
                  </p>
                  <p className="tabular-nums text-muted">
                    Received {formatMt(book.received)} · in yard {formatMt(book.inYard)} · {tonnesLeft(book.stillToCome)}
                  </p>
                  {book.contract.note ? <p className="text-muted">{book.contract.note}</p> : null}
                </div>
                {canAdmin(open.me.role) ? (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setError(null);
                      removeContract({ data: { id: book.contract.id, actorName: actor } })
                        .then(() => reload())
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not remove it."));
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
