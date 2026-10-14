import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canEditMarket, formatDate, formatGhs, latestPriceMap } from "@/lib/domain";
import { removePrice, saveCommodity, saveHub, savePrice } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { Button, Field, Panel, controlClass, scrollToFirstError } from "@/components/ui";

export const Route = createFileRoute("/_app/market")({ component: MarketPage });

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function MarketPage() {
  const { workspace, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const quoteFormRef = useRef<HTMLFormElement | null>(null);
  const hubFormRef = useRef<HTMLFormElement | null>(null);
  const [commodityId, setCommodityId] = useState("shea");
  const [hubId, setHubId] = useState("tamale");
  const [quotedOn, setQuotedOn] = useState(todayISO);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [hubName, setHubName] = useState("");
  const [hubRegion, setHubRegion] = useState("");
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [hubErrors, setHubErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  const latest = useMemo(() => (open ? latestPriceMap(open.prices) : new Map()), [open]);
  if (!open) return null;
  const canEdit = canEditMarket(open.me.role);
  const commodity = open.commodities.find((item) => item.id === commodityId) ?? open.commodities[0];

  const clearQuoteError = (field: string) => {
    if (quoteErrors[field]) {
      setQuoteErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateQuote = () => {
    const errs: Record<string, string> = {};
    if (!quotedOn) {
      errs.quotedOn = "Quote date is required.";
    }
    if (!price.trim()) {
      errs.price = "Price per tonne is required.";
    } else {
      const num = Number(price);
      if (Number.isNaN(num) || num <= 0) {
        errs.price = "Price must be a positive number.";
      }
    }
    return errs;
  };

  const validateHub = () => {
    const errs: Record<string, string> = {};
    if (!hubName.trim()) {
      errs.hubName = "Town or corridor name is required.";
    }
    return errs;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Market</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Track commodity prices and regional hub quotes. Recorded rates are used to verify incoming deliveries and identify weighbridge price discrepancies across markets.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {open.commodities.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCommodityId(item.id)}
            className={
              commodity?.id === item.id
                ? "h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg"
                : "h-11 shrink-0 rounded-md border border-line bg-surface px-4 text-sm font-semibold"
            }
          >
            {item.name}
          </button>
        ))}
      </div>
      <Panel title={commodity ? `${commodity.name} by hub` : "Hubs"}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {open.hubs.map((hub) => {
            const quote = commodity ? latest.get(`${commodity.id}:${hub.id}`) : undefined;
            return (
              <div key={hub.id} className="rounded-md border border-line px-3 py-3">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{hub.region || "Hub"}</p>
                <p className="font-display text-2xl">{hub.name}</p>
                <p className="mt-1 text-sm tabular-nums">{quote ? formatGhs(quote.pricePerMt) : "No quote"}</p>
                <p className="text-xs text-muted">{quote ? formatDate(quote.quotedOn) : "Post a price"}</p>
              </div>
            );
          })}
        </div>
      </Panel>
      {canEdit ? (
        <Panel title="Post a quote">
          <form
            ref={quoteFormRef}
            noValidate
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const errs = validateQuote();
              if (Object.keys(errs).length > 0) {
                setQuoteErrors(errs);
                setTimeout(() => scrollToFirstError(quoteFormRef.current), 40);
                return;
              }
              setError(null);
              savePrice({
                data: {
                  commodityId: commodity?.id ?? commodityId,
                  hubId,
                  quotedOn,
                  pricePerMt: Number(price),
                  note,
                  actorName: actor,
                },
              })
                .then(() => {
                  setMessage("Quote posted.");
                  setPrice("");
                  setNote("");
                  setQuoteErrors({});
                  reload();
                })
                .catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : "Could not post the quote.";
                  setError(msg);
                  setTimeout(() => scrollToFirstError(quoteFormRef.current), 40);
                });
            }}
          >
            <Field label="Hub">
              <select
                className={controlClass(false)}
                value={hubId}
                onChange={(event) => setHubId(event.target.value)}
              >
                {open.hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" error={quoteErrors.quotedOn}>
              <input
                className={controlClass(Boolean(quoteErrors.quotedOn))}
                aria-invalid={Boolean(quoteErrors.quotedOn)}
                type="date"
                value={quotedOn}
                onChange={(event) => {
                  setQuotedOn(event.target.value);
                  clearQuoteError("quotedOn");
                }}
              />
            </Field>
            <Field label="GHS per tonne" error={quoteErrors.price}>
              <input
                className={controlClass(Boolean(quoteErrors.price))}
                aria-invalid={Boolean(quoteErrors.price)}
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  clearQuoteError("price");
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
            <div className="sm:col-span-2">
              <Button type="submit">Post quote</Button>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-accent" role="alert">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
        </Panel>
      ) : (
        <p className="text-sm text-muted">Only procurement and admin post quotes. You can still read the sheet.</p>
      )}
      <Panel title="Quote history">
        {open.prices.length === 0 ? (
          <p className="text-sm text-muted">No quotes on file.</p>
        ) : (
          <ul className="divide-y divide-line">
            {open.prices.map((item) => {
              const hub = open.hubs.find((row) => row.id === item.hubId);
              const name = open.commodities.find((row) => row.id === item.commodityId)?.name ?? item.commodityId;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-semibold">{name}</span>
                  <span>{hub?.name ?? item.hubId}</span>
                  <span className="tabular-nums">{formatDate(item.quotedOn)}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatGhs(item.pricePerMt)}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-accent"
                      onClick={() => {
                        removePrice({ data: { id: item.id, actorName: actor } })
                          .then(() => reload())
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not remove it."));
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {canEdit ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Add a hub">
            <form
              ref={hubFormRef}
              noValidate
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const errs = validateHub();
                if (Object.keys(errs).length > 0) {
                  setHubErrors(errs);
                  setTimeout(() => scrollToFirstError(hubFormRef.current), 40);
                  return;
                }
                saveHub({ data: { name: hubName.trim(), region: hubRegion.trim(), actorName: actor } })
                  .then(() => {
                    setHubName("");
                    setHubRegion("");
                    setHubErrors({});
                    reload();
                  })
                  .catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : "Could not add the hub.";
                    setError(msg);
                    setTimeout(() => scrollToFirstError(hubFormRef.current), 40);
                  });
              }}
            >
              <Field label="Town or corridor" error={hubErrors.hubName}>
                <input
                  className={controlClass(Boolean(hubErrors.hubName))}
                  aria-invalid={Boolean(hubErrors.hubName)}
                  value={hubName}
                  onChange={(event) => {
                    setHubName(event.target.value);
                    if (hubErrors.hubName) {
                      setHubErrors((prev) => {
                        const next = { ...prev };
                        delete next.hubName;
                        return next;
                      });
                    }
                  }}
                />
              </Field>
              <Field label="Region">
                <input
                  className={controlClass(false)}
                  value={hubRegion}
                  onChange={(event) => setHubRegion(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="quiet">
                Add hub
              </Button>
            </form>
          </Panel>
          <Panel title="Moisture ceilings">
            <ul className="space-y-3">
              {open.commodities.map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 font-semibold">{item.name}</span>
                  <span className="tabular-nums text-muted">{item.moistureMax}%</span>
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => {
                      const next = window.prompt(`Moisture ceiling for ${item.name}`, String(item.moistureMax));
                      if (!next) return;
                      saveCommodity({
                        data: { id: item.id, name: item.name, moistureMax: Number(next), actorName: actor },
                      })
                        .then(() => reload())
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not update the ceiling."));
                    }}
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
