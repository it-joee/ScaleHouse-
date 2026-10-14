import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canBrief, canEditYard, capturedSgs, contractBooks, formatMt, houseContract, inYard, listExceptions, openExceptions, sum, tonnesLeft, weightGap } from "@/lib/domain";
import { useYard } from "@/components/yard-provider";
import { Button, Panel, Stat, StatusPill } from "@/components/ui";
import { TonneChart } from "@/components/tonne-chart";

export const Route = createFileRoute("/_app/")({ component: BoardPage });

function BoardPage() {
  const { workspace, companyId } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const deliveries = useMemo(() => {
    if (!open) return [];
    if (companyId === "all") return open.deliveries;
    return open.deliveries.filter((delivery) => delivery.companyId === companyId);
  }, [open, companyId]);
  if (!open) return null;
  const companies = open.companies.filter((company) => companyId === "all" || company.id === companyId);
  const chart = companies
    .filter((company) => deliveries.some((delivery) => delivery.companyId === company.id))
    .map((company) => {
      const rows = deliveries.filter((delivery) => delivery.companyId === company.id);
      return {
        code: company.code,
        declared: sum(rows.map((row) => row.declaredMt)),
        sgs: sum(rows.map((row) => capturedSgs(row))),
      };
    });
  const queue = deliveries.filter((delivery) => inYard(delivery.status));
  const gap = sum(deliveries.map((delivery) => weightGap(delivery)));
  const companyName = (id: string) => open.companies.find((company) => company.id === id)?.code ?? id;
  const exceptions = openExceptions(listExceptions(open.deliveries, open.commodities, open.prices), open.clears).filter(
    (item) => companyId === "all" || deliveries.some((delivery) => delivery.id === item.deliveryId),
  );
  const books = contractBooks(open.contracts, open.deliveries);
  const paper = companies
    .map((company) => ({ company, standing: houseContract(company.id, books) }))
    .filter((row) => row.standing.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Board</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Live overview of yard activity, scalehouse weights, flagged issues, and delivery status across all sister companies.
          </p>
        </div>
        <div className="flex gap-2">
          {canBrief(open.me.role) ? (
            <Link to="/whatsapp" className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold">
              WhatsApp
            </Link>
          ) : null}
          {canEditYard(open.me.role) ? (
            <Link to="/intake" className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg">
              New truck
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Trucks" value={String(deliveries.length)} note={companyId === "all" ? "All companies" : "This company"} />
        <Stat label="Declared" value={formatMt(sum(deliveries.map((row) => row.declaredMt)))} note="Metric tonnes" />
        <Stat label="SGS captured" value={formatMt(sum(deliveries.map((row) => capturedSgs(row))))} note="Zeros with no weigh skipped" />
        <Stat label="SGS − declared" value={formatMt(gap)} note="Only loads with an SGS figure" />
      </div>
      {exceptions.length > 0 ? (
        <Panel
          title={`${exceptions.length} flagged issues requiring review`}
          action={
            <Link to="/exceptions" className="text-sm font-semibold text-primary">
              View all issues
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {exceptions.slice(0, 5).map((item) => {
              const delivery = deliveries.find((row) => row.id === item.deliveryId);
              return (
                <li key={item.id} className="py-3 text-sm">
                  <Link to="/yard/$id" params={{ id: item.deliveryId }} className="font-semibold">
                    {delivery?.truckNumber || "Truck"} · {companyName(delivery?.companyId ?? "")}
                  </Link>
                  <p className="text-muted">{item.detail}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      {paper.length > 0 ? (
        <Panel
          title="Active contracts summary"
          action={
            <Link to="/contracts" className="text-sm font-semibold text-primary">
              View contracts
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {paper.map(({ company, standing }) => (
              <li key={company.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <p className="font-semibold">
                  {company.code} · {company.name}
                </p>
                <p className="tabular-nums text-muted">
                  {tonnesLeft(standing.stillToCome)} of {formatMt(standing.promised)} MT
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {open.prices.length === 0 ? (
        <Panel title="Desk prices">
          <p className="text-sm text-muted">
            No regional quotes yet. Until procurement posts a price, loads cannot be flagged above or below market.
          </p>
          <Link to="/market" className="mt-3 inline-flex">
            <Button variant="quiet">Open the market sheet</Button>
          </Link>
        </Panel>
      ) : null}
      <Panel title="Tonnes by company">
        <TonneChart rows={chart} />
      </Panel>
      <Panel
        title={`Still in the yard (${queue.length})`}
        action={
          <Link to="/yard" className="text-sm font-semibold text-primary">
            Full log
          </Link>
        }
      >
        {queue.length === 0 ? (
          <p className="text-sm text-muted">Nothing is waiting. Every truck in this view is offloaded or has left.</p>
        ) : (
          <ul className="divide-y divide-line">
            {queue.slice(0, 8).map((delivery) => (
              <li key={delivery.id}>
                <Link to="/yard/$id" params={{ id: delivery.id }} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{delivery.truckNumber || "No plate"}</p>
                    <p className="truncate text-sm text-muted">
                      {companyName(delivery.companyId)} · {delivery.waybill || "No waybill"} · {delivery.origin || "Origin not set"}
                    </p>
                  </div>
                  <StatusPill status={delivery.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
