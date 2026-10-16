import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import {
  bridgeNetMt,
  canEditCommercial,
  canEditYard,
  capturedSgs,
  formatDate,
  formatGhs,
  formatMt,
  formatWhen,
  listExceptions,
  marketFor,
  moistureBreach,
  movementHint,
  openExceptions,
  priceFlag,
  weightGap,
  canClearException,
  canMoveStock,
  contractBooks,
  contractForDelivery,
  tonnesLeft,
  EXCEPTION_LABEL,
} from "@/lib/domain";
import { clearException, setCommercial, updateDelivery } from "@/lib/scalehouse.functions";
import { isTransportError } from "@/lib/outbox";
import { useYard } from "@/components/yard-provider";
import { parsePhotos } from "@/lib/photo";
import { DeliveryForm, draftFromDelivery, payloadFromDraft } from "@/components/delivery-form";
import { MovementForm } from "@/components/movement-form";
import { Button, Field, Panel, PricePill, StatusPill, control, controlClass, scrollToFirstError } from "@/components/ui";

export const Route = createFileRoute("/_app/yard/$id")({ component: TicketPage });

function TicketPage() {
  const { id } = Route.useParams();
  const { workspace, user, reload, queueUpdate, pendingIds } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const priceFormRef = useRef<HTMLFormElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [hub, setHub] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const delivery = open.deliveries.find((item) => item.id === id);
  if (!delivery) {
    return (
      <div>
        <h1 className="font-display text-4xl">Not on the log</h1>
        <Link to="/yard" className="mt-3 inline-flex text-sm font-semibold text-primary">
          Back to trucks
        </Link>
      </div>
    );
  }
  const company = open.companies.find((item) => item.id === delivery.companyId);
  const commodity = open.commodities.find((item) => item.id === delivery.commodityId);
  const quote = marketFor(delivery, open.prices);
  const flag = priceFlag(delivery.purchasePriceMt, quote?.pricePerMt ?? null);
  const gap = weightGap(delivery);
  const net = bridgeNetMt(delivery);
  const audits = open.audits.filter((event) => event.deliveryId === delivery.id);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  const warehouses = [...new Set(open.deliveries.map((item) => item.warehouse).filter(Boolean))].sort();
  const openPlates = open.deliveries
    .filter((item) => item.id !== delivery.id && item.status !== "offloaded" && item.status !== "exited")
    .map((item) => item.truckNorm);
  const wet = moistureBreach(delivery, open.commodities);
  const cover = contractForDelivery(delivery, contractBooks(open.contracts, open.deliveries));

  return (
    <div className="space-y-6">
      <div className="no-print space-y-2">
        <Link to="/yard" className="inline-flex text-sm font-semibold text-primary">
          ← Trucks
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl">{delivery.truckNumber || "No plate"}</h1>
            <StatusPill status={delivery.status} />
            <PricePill flag={flag} />
          </div>
          {canEditYard(open.me.role) ? (
            <Button
              variant={isEditing ? "quiet" : "primary"}
              onClick={() => setIsEditing((prev) => !prev)}
              className="shrink-0"
            >
              {isEditing ? (
                "Cancel edit"
              ) : (
                <>
                  <Pencil className="size-4" />
                  Edit
                </>
              )}
            </Button>
          ) : null}
        </div>
        <p className="text-muted">
          {company?.name ?? "Company"} · {delivery.waybill || "No waybill"} · {formatDate(delivery.loggedOn)}
        </p>
        {cover ? (
          <p className="no-print text-sm">
            Counts against {cover.contract.supplierName}: {tonnesLeft(cover.stillToCome)} of {formatMt(cover.contract.tonnes)} MT.
          </p>
        ) : null}
      </div>

      <article className="print-sheet">
        <p className="text-xs font-semibold tracking-widest uppercase">JNI Scalehouse · Delivery receipt</p>
        <h1 className="mt-2 font-display text-3xl">{company?.name}</h1>
        <p>
          Waybill {delivery.waybill || "—"} · Truck {delivery.truckNumber || "—"} · {formatDate(delivery.loggedOn)}
        </p>
        <p>
          Driver {delivery.driverName || "—"} · {delivery.driverContact || "no phone"} · Origin {delivery.origin || "—"}
        </p>
        <p>
          Supplier {delivery.supplierName || "—"} · Warehouse {delivery.warehouse || "—"}
        </p>
        <p>
          Declared {formatMt(delivery.declaredMt)} MT · SGS {formatMt(capturedSgs(delivery))} MT · Bridge net{" "}
          {formatMt(net)} MT · Gap {formatMt(gap)} MT
        </p>
        <p>
          Moisture {delivery.moisturePct ?? "—"}% · Seal {delivery.brokenSeal ? "BROKEN" : "intact"} · Damaged bags{" "}
          {delivery.damagedBags}
        </p>
        <p>Officer {delivery.officer || "—"} · Status {delivery.status}</p>
        {delivery.comment ? <p>Note: {delivery.comment}</p> : null}
      </article>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {canEditYard(open.me.role) && isEditing ? (
            <DeliveryForm
              key={delivery.id}
              initial={draftFromDelivery(delivery)}
              companies={open.companies}
              commodities={open.commodities}
              hubs={open.hubs}
              warehouses={warehouses}
              openPlates={openPlates}
              mode="cards"
              submitLabel="Save ticket"
              onSubmit={async (draft) => {
                const data = { id: delivery.id, ...payloadFromDraft(draft), actorName: actor };
                if (!navigator.onLine || delivery.id.startsWith("local_")) {
                  await queueUpdate(data);
                  return;
                }
                try {
                  await updateDelivery({ data });
                  reload();
                } catch (err) {
                  if (!isTransportError(err)) throw err;
                  await queueUpdate(data);
                }
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Card 1: Waybill */}
              <div className="no-print space-y-4 rounded-lg border border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="font-display text-2xl">Waybill</h2>
                  {canEditYard(open.me.role) ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-muted">Company</span>
                    <p className="mt-0.5 text-sm font-semibold">{company ? `${company.code} · ${company.name}` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Date</span>
                    <p className="mt-0.5 text-sm font-semibold">{formatDate(delivery.loggedOn)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Waybill number</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.waybill || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Truck number</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.truckNumber || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Commodity</span>
                    <p className="mt-0.5 text-sm font-semibold">{commodity?.name ?? delivery.commodityId}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Declared quantity (MT)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMt(delivery.declaredMt)} MT</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">SGS quantity (MT)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMt(capturedSgs(delivery))} MT</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Origin</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.origin || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Driver</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.driverName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Driver contact</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.driverContact || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Supplier</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.supplierName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Supplier contact</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.supplierContact || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Contract quantity (MT)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMt(delivery.contractQtyMt)} MT</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Contract balance (MT)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMt(delivery.contractBalMt)} MT</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Bridge and inspection */}
              <div className="no-print space-y-4 rounded-lg border border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="font-display text-2xl">Bridge and inspection</h2>
                  {canEditYard(open.me.role) ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-muted">Gross (kg) / Tare (kg)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {delivery.grossKg ? `${delivery.grossKg.toLocaleString()} kg` : "—"} / {delivery.tareKg ? `${delivery.tareKg.toLocaleString()} kg` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Bridge net</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMt(net)} MT</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Moisture</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.moisturePct !== null ? `${delivery.moisturePct}%` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Damaged bags</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{delivery.damagedBags ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Seal status</span>
                    <p className="mt-0.5 text-sm font-semibold">
                      {delivery.brokenSeal ? <span className="text-accent font-bold">BROKEN</span> : "Intact"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Purchase price (GHS / MT)</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatGhs(delivery.purchasePriceMt)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Market hub</span>
                    <p className="mt-0.5 text-sm font-semibold">
                      {open.hubs.find((h) => h.id === delivery.marketHubId)?.name || "Not set"}
                    </p>
                  </div>
                </div>

                {delivery.qcNote ? (
                  <div className="border-t border-line/60 pt-3">
                    <span className="text-xs font-medium text-muted">QC Note</span>
                    <p className="mt-0.5 text-sm">{delivery.qcNote}</p>
                  </div>
                ) : null}
              </div>

              {/* Card 3: Dispatch */}
              <div className="no-print space-y-4 rounded-lg border border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="font-display text-2xl">Dispatch</h2>
                  {canEditYard(open.me.role) ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-muted">Status</span>
                    <div className="mt-1"><StatusPill status={delivery.status} /></div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Warehouse</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.warehouse || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Delivered to warehouse</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.deliveredOn ? formatDate(delivery.deliveredOn) : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Date offloaded</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.offloadedOn ? formatDate(delivery.offloadedOn) : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted">Officer in charge</span>
                    <p className="mt-0.5 text-sm font-semibold">{delivery.officer || "—"}</p>
                  </div>
                </div>

                {delivery.comment ? (
                  <div className="border-t border-line/60 pt-3">
                    <span className="text-xs font-medium text-muted">Comment / Instructions</span>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted">{delivery.comment}</p>
                  </div>
                ) : null}

                {delivery.photoUrl ? (() => {
                  const photos = parsePhotos(delivery.photoUrl);
                  if (photos.length === 0) return null;
                  return (
                    <div className="border-t border-line/60 pt-3">
                      <span className="text-xs font-medium text-muted">
                        Truck Photo{photos.length > 1 ? `s (${photos.length})` : ""}
                      </span>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block overflow-hidden rounded-md border border-line"
                            title="Click to view full size"
                          >
                            <img
                              src={url}
                              alt={`Truck photo ${idx + 1}`}
                              className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            </div>
          )}
        {pendingIds.has(delivery.id) ? (
          <p className="no-print rounded-lg border border-line bg-accent-soft px-4 py-3 text-sm font-semibold text-accent">
            This ticket is on the phone. It has not reached the yard log yet.
          </p>
        ) : null}
        <TicketExceptions deliveryId={delivery.id} />
        {canMoveStock(open.me.role) && !delivery.id.startsWith("local_") ? (
          <Panel title="Move this load to another company">
            <MovementForm
              companies={open.companies}
              commodities={open.commodities}
              actorName={actor}
              preset={{
                fromId: movementHint(delivery.comment, open.companies)?.fromId ?? delivery.companyId,
                toId: movementHint(delivery.comment, open.companies)?.toId,
                deliveryId: delivery.id,
                tonnes: capturedSgs(delivery) ?? delivery.declaredMt ?? undefined,
                commodityId: delivery.commodityId,
              }}
              onDone={reload}
            />
          </Panel>
        ) : null}
        {!canEditYard(open.me.role) && canEditCommercial(open.me.role) ? (() => {
          const initialPrice = delivery.purchasePriceMt === null ? "" : String(delivery.purchasePriceMt);
          const initialHub = delivery.marketHubId ?? "";
          const currentPrice = price ?? initialPrice;
          const currentHub = hub ?? initialHub;
          const isPriceDirty = currentPrice.trim() !== initialPrice.trim() || currentHub !== initialHub;
          return (
            <form
              ref={priceFormRef}
              noValidate
              className="no-print space-y-3 rounded-lg border border-line bg-surface p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!isPriceDirty) return;
                setError(null);
                setPriceError(null);
                const purchase = currentPrice.trim();
                if (purchase !== "") {
                  const num = Number(purchase);
                  if (Number.isNaN(num) || num <= 0) {
                    setPriceError("Price must be a positive number.");
                    setTimeout(() => scrollToFirstError(priceFormRef.current), 40);
                    return;
                  }
                }
                setCommercial({
                  data: {
                    id: delivery.id,
                    purchasePriceMt: purchase === "" ? null : Number(purchase),
                    marketHubId: currentHub || null,
                    actorName: actor,
                  },
                })
                  .then(() => {
                    setMessage("Price saved.");
                    setPriceError(null);
                    setPrice(null);
                    setHub(null);
                    reload();
                  })
                  .catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : "Could not save the price.";
                    setError(msg);
                    setTimeout(() => scrollToFirstError(priceFormRef.current), 40);
                  });
              }}
            >
              <h2 className="font-display text-2xl">Purchase price</h2>
              <Field label="GHS per tonne" error={priceError}>
                <input
                  className={controlClass(Boolean(priceError))}
                  aria-invalid={Boolean(priceError)}
                  inputMode="decimal"
                  value={currentPrice}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setPriceError(null);
                  }}
                />
              </Field>
              <Field label="Market hub">
                <select
                  className={controlClass(false)}
                  value={currentHub}
                  onChange={(event) => setHub(event.target.value)}
                >
                  <option value="">Not set</option>
                  {open.hubs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              {error ? <p className="text-sm text-accent" role="alert">{error}</p> : null}
              {message ? <p className="text-sm text-primary">{message}</p> : null}
              <Button
                type="submit"
                disabled={!isPriceDirty}
                title={!isPriceDirty ? "No changes to save" : undefined}
              >
                Save price
              </Button>
            </form>
          );
        })() : null}
      </div>
      <aside className="space-y-4">
        <div className="no-print rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">This load</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Declared" value={`${formatMt(delivery.declaredMt)} MT`} />
            <Row label="SGS" value={`${formatMt(capturedSgs(delivery))} MT`} />
            <Row label="Gap" value={`${formatMt(gap)} MT`} />
            <Row label="Purchase" value={formatGhs(delivery.purchasePriceMt)} />
            <Row label="Desk" value={quote ? formatGhs(quote.pricePerMt) : "No quote"} />
          </dl>
          {delivery.brokenSeal ? <p className="mt-3 text-sm font-semibold text-accent">Broken seal. Hold the tip.</p> : null}
          {wet ? (
            <p className="mt-2 text-sm font-semibold text-accent">
              Moisture is over the {commodity?.moistureMax}% ceiling for {commodity?.name}.
            </p>
          ) : null}
          <button type="button" onClick={() => window.print()} className="mt-4 h-11 w-full rounded-md border border-line text-sm font-semibold">
            Print receipt
          </button>
          <Link to="/voice" className="mt-2 flex h-11 items-center justify-center text-sm font-semibold text-primary">
            French lines for the driver
          </Link>
        </div>
        <div className="no-print rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">Custody</h2>
          <ol className="mt-3 space-y-3">
            {audits.map((event) => (
              <li key={event.id} className="border-t border-line pt-3 text-sm first:border-0 first:pt-0">
                <p className="font-semibold">{event.action}</p>
                <p className="text-muted">{event.detail}</p>
                <p className="text-xs text-muted">
                  {event.actorName || "Yard"} · {formatWhen(event.at)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function TicketExceptions({ deliveryId }: { deliveryId: string }) {
  const { workspace, user, reload } = useYard();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = workspace?.gate === "open" ? workspace : null;
  if (!open || deliveryId.startsWith("local_")) return null;
  const items = openExceptions(
    listExceptions(open.deliveries, open.commodities, open.prices),
    open.clears,
  ).filter((item) => item.deliveryId === deliveryId);
  if (items.length === 0) return null;
  const floor = canClearException(open.me.role);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  return (
    <div className="no-print rounded-lg border border-line bg-surface p-4">
      <h2 className="font-display text-2xl">Flagged issues on this ticket</h2>
      <ul className="mt-3 space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">{EXCEPTION_LABEL[item.kind]}</p>
            <p className="mt-1 text-sm">{item.detail}</p>
            {floor ? (
              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  clearException({
                    data: {
                      deliveryId: item.deliveryId,
                      kind: item.kind,
                      fingerprint: item.fingerprint,
                      note,
                      actorName: actor,
                    },
                  })
                    .then(() => {
                      setNote("");
                      reload();
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not clear it."));
                }}
              >
                <input
                  className={control}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Why this can pass"
                  aria-label="Clearance note"
                />
                <Button type="submit">Clear</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
    </div>
  );
}
