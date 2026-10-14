import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canAdmin, canMoveStock, contractBooks, formatGhs, formatMt, houseContract, housePosition, tonnesLeft } from "@/lib/domain";
import { removeMovement } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { MovementForm } from "@/components/movement-form";
import { Button, Panel, Stat } from "@/components/ui";

export const Route = createFileRoute("/_app/position")({ component: PositionPage });

function PositionPage() {
  const { workspace, companyId, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [error, setError] = useState<string | null>(null);
  const positions = useMemo(() => {
    if (!open) return [];
    return open.companies
      .filter((company) => company.active)
      .map((company) => ({ company, position: housePosition(company.id, open.deliveries, open.movements) }));
  }, [open]);
  if (!open) return null;
  const focus = companyId === "all" ? null : positions.find((row) => row.company.id === companyId) ?? null;
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";
  const name = (id: string) => open.companies.find((company) => company.id === id);
  const commodityName = (id: string) => open.commodities.find((item) => item.id === id)?.name ?? id;
  const books = contractBooks(open.contracts, open.deliveries);
  const paper = (id: string) => houseContract(id, books);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{focus ? `${focus.company.name} Position` : "Position"}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Track tonnage currently in the yard, committed capital, received volumes, and internal transfers across all sister companies.
        </p>
        <Link to="/contracts" className="mt-2 inline-flex text-sm font-semibold text-primary">
          View contracts
        </Link>
      </div>
      {focus ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="In the yard" value={String(focus.position.trucksInYard)} note={`${formatMt(focus.position.tonnesInYard)} MT`} />
          <Stat label="Cash tied up" value={formatGhs(focus.position.cashTied)} note={focus.position.unpricedTrucks ? `${focus.position.unpricedTrucks} trucks have no price` : "Priced loads only"} />
          <Stat label="Received" value={formatMt(focus.position.tonnesReceived)} note="Offloaded or left" />
          <Stat label="Moved" value={formatMt(focus.position.tonnesIn - focus.position.tonnesOut)} note={`${formatMt(focus.position.tonnesIn)} in · ${formatMt(focus.position.tonnesOut)} out`} />
          <Stat label="Contract left" value={tonnesLeft(paper(focus.company.id).stillToCome)} note={`${formatMt(paper(focus.company.id).promised)} MT promised`} />
        </div>
      ) : null}
      <Panel title="All Sister Companies">
        <div className="space-y-3 md:hidden">
          {positions.map(({ company, position }) => (
            <div key={company.id} className="border-b border-line pb-3 last:border-0">
              <p className="font-semibold">
                {company.code} · {company.name}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted">
                {position.trucksInYard} trucks · {formatMt(position.tonnesInYard)} MT in yard · {formatGhs(position.cashTied)}
              </p>
              <p className="text-sm tabular-nums text-muted">
                Received {formatMt(position.tonnesReceived)} · in {formatMt(position.tonnesIn)} · out {formatMt(position.tonnesOut)}
                {paper(company.id).count ? ` · ${tonnesLeft(paper(company.id).stillToCome)}` : ""}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-3 font-semibold">House</th>
                <th className="py-2 pr-3 text-right font-semibold">Trucks</th>
                <th className="py-2 pr-3 text-right font-semibold">In yard</th>
                <th className="py-2 pr-3 text-right font-semibold">Cash</th>
                <th className="py-2 pr-3 text-right font-semibold">Received</th>
                <th className="py-2 pr-3 text-right font-semibold">In</th>
                <th className="py-2 pr-3 text-right font-semibold">Out</th>
                <th className="py-2 text-right font-semibold">To come</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(({ company, position }) => (
                <tr key={company.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3 font-semibold">
                    {company.code} · {company.name}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{position.trucksInYard}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatMt(position.tonnesInYard)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatGhs(position.cashTied)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatMt(position.tonnesReceived)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatMt(position.tonnesIn)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatMt(position.tonnesOut)}</td>
                  <td className="py-3 text-right tabular-nums">
                    {paper(company.id).count ? tonnesLeft(paper(company.id).stillToCome) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {canMoveStock(open.me.role) ? (
        <Panel title="Move tonnes between houses">
          <MovementForm companies={open.companies} commodities={open.commodities} actorName={actor} onDone={reload} />
        </Panel>
      ) : (
        <p className="text-sm text-muted">Executives read the position. Floor and procurement record a movement.</p>
      )}
      <Panel title="Movements">
        {open.movements.length === 0 ? (
          <p className="text-sm text-muted">No movements yet. A comment like “From JNI to Frontier” is not a movement until someone records it.</p>
        ) : (
          <ul className="divide-y divide-line">
            {open.movements
              .filter((movement) => companyId === "all" || movement.fromCompanyId === companyId || movement.toCompanyId === companyId)
              .map((movement) => (
                <li key={movement.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">
                      {name(movement.fromCompanyId)?.code ?? movement.fromCompanyId} → {name(movement.toCompanyId)?.code ?? movement.toCompanyId}
                    </p>
                    <p className="text-muted">
                      {formatMt(movement.tonnes)} MT {commodityName(movement.commodityId)} · {movement.loggedOn}
                      {movement.note ? ` · ${movement.note}` : ""} · {movement.createdBy || "Yard"}
                    </p>
                  </div>
                  {canAdmin(open.me.role) ? (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setError(null);
                        removeMovement({ data: { id: movement.id, actorName: actor } })
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
        {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
      </Panel>
    </div>
  );
}
