import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  EXCEPTION_LABEL,
  canClearException,
  listExceptions,
  openExceptions,
  type ExceptionKind,
} from "@/lib/domain";
import { clearException } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { Button, control } from "@/components/ui";

export const Route = createFileRoute("/_app/exceptions")({ component: ExceptionsPage });

function ExceptionsPage() {
  const { workspace, companyId, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [kind, setKind] = useState<ExceptionKind | "all">("all");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => {
    if (!open) return [];
    const items = openExceptions(listExceptions(open.deliveries, open.commodities, open.prices), open.clears);
    if (companyId === "all") return items;
    return items.filter((item) => open.deliveries.find((delivery) => delivery.id === item.deliveryId)?.companyId === companyId);
  }, [open, companyId]);
  if (!open) return null;
  const shown = kind === "all" ? rows : rows.filter((item) => item.kind === kind);
  const floor = canClearException(open.me.role);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  const companyName = (id: string) => open.companies.find((company) => company.id === id)?.code ?? id;
  const deliveryFor = (id: string) => open.deliveries.find((delivery) => delivery.id === id);
  const counts = new Map<ExceptionKind, number>();
  for (const item of rows) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const cleared = floor
    ? open.clears.filter((clear) => {
        const delivery = deliveryFor(clear.deliveryId);
        return delivery && (companyId === "all" || delivery.companyId === companyId);
      })
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">Flagged Tickets & Issues</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Deliveries held for inspection or paperwork verification. Review the flagged details below and clear them once approved.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={kind === "all"} label={`Open ${rows.length}`} onClick={() => setKind("all")} />
        {[...counts.entries()].map(([id, count]) => (
          <FilterChip
            key={id}
            active={kind === id}
            label={`${EXCEPTION_LABEL[id]} ${count}`}
            onClick={() => setKind(id)}
          />
        ))}
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">No flagged issues in this view. All deliveries are in good standing.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => {
            const delivery = deliveryFor(item.deliveryId);
            return (
              <li key={item.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-widest text-accent uppercase">{EXCEPTION_LABEL[item.kind]}</p>
                    <p className="mt-1 font-semibold">
                      {delivery?.truckNumber || "No plate"} · {delivery ? companyName(delivery.companyId) : "—"} ·{" "}
                      {delivery?.waybill || "No waybill"}
                    </p>
                    <p className="mt-1 text-sm text-muted">{item.detail}</p>
                  </div>
                  {delivery ? (
                    <Link to="/yard/$id" params={{ id: delivery.id }} className="text-sm font-semibold text-primary">
                      Open ticket
                    </Link>
                  ) : null}
                </div>
                {floor && delivery ? (
                  noteFor === item.id ? (
                    <form
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
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
                            setNoteFor(null);
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
                  ) : (
                    <button
                      type="button"
                      className="mt-3 h-11 text-sm font-semibold text-primary"
                      onClick={() => {
                        setNoteFor(item.id);
                        setNote("");
                      }}
                    >
                      Clear this
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {floor && cleared.length > 0 ? (
        <details className="rounded-lg border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">Cleared ({cleared.length})</summary>
          <ul className="mt-3 divide-y divide-line text-sm">
            {cleared.slice(0, 20).map((clear) => {
              const delivery = deliveryFor(clear.deliveryId);
              return (
                <li key={clear.id} className="py-2">
                  <span className="font-semibold">{EXCEPTION_LABEL[clear.kind]}</span>
                  <span className="text-muted">
                    {" "}
                    · {delivery?.truckNumber || "Truck"} · {clear.clearedBy || "Floor"}
                    {clear.note ? ` · ${clear.note}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-11 shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg"
          : "h-11 shrink-0 rounded-md border border-line bg-surface px-3 text-sm font-semibold"
      }
    >
      {label}
    </button>
  );
}
