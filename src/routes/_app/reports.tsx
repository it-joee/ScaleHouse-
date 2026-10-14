import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { capturedSgs, formatMt, sum, weightGap } from "@/lib/domain";
import { useYard } from "@/components/yard-provider";
import { Panel, Stat } from "@/components/ui";
import { TonneChart } from "@/components/tonne-chart";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function ReportsPage() {
  const { workspace, companyId } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const deliveries = useMemo(() => {
    if (!open) return [];
    if (companyId === "all") return open.deliveries;
    return open.deliveries.filter((delivery) => delivery.companyId === companyId);
  }, [open, companyId]);
  if (!open) return null;
  const companies = open.companies.filter((company) => deliveries.some((delivery) => delivery.companyId === company.id));
  const chart = companies.map((company) => {
    const rows = deliveries.filter((delivery) => delivery.companyId === company.id);
    return {
      code: company.code,
      name: company.name,
      trucks: rows.length,
      declared: sum(rows.map((row) => row.declaredMt)),
      sgs: sum(rows.map((row) => capturedSgs(row))),
      gap: sum(rows.map((row) => weightGap(row))),
    };
  });
  const origins = new Map<string, number>();
  for (const delivery of deliveries) {
    const key = delivery.origin.trim() || "Not stated";
    origins.set(key, (origins.get(key) ?? 0) + (delivery.declaredMt ?? 0));
  }
  const originRows = [...origins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const originMax = originRows[0]?.[1] || 1;
  const gaps = deliveries
    .map((delivery) => ({ delivery, gap: weightGap(delivery) }))
    .filter((row): row is { delivery: (typeof deliveries)[number]; gap: number } => row.gap !== null)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 8);

  function exportCsv() {
    if (!open) return;
    const yard = open;
    const header = [
      "Company",
      "Date",
      "Waybill",
      "Truck",
      "Commodity",
      "Declared MT",
      "SGS MT",
      "Gap MT",
      "Driver",
      "Contact",
      "Origin",
      "Supplier",
      "Warehouse",
      "Status",
      "Offloaded",
      "Comment",
      "Officer",
      "Purchase GHS/MT",
    ];
    const lines = [header.join(",")];
    for (const delivery of deliveries) {
      const company = yard.companies.find((item) => item.id === delivery.companyId);
      const commodity = yard.commodities.find((item) => item.id === delivery.commodityId);
      lines.push(
        [
          company?.name ?? "",
          delivery.loggedOn ?? "",
          delivery.waybill,
          delivery.truckNumber,
          commodity?.name ?? "",
          delivery.declaredMt,
          capturedSgs(delivery),
          weightGap(delivery),
          delivery.driverName,
          delivery.driverContact,
          delivery.origin,
          delivery.supplierName,
          delivery.warehouse,
          delivery.status,
          delivery.offloadedOn ?? "",
          delivery.comment,
          delivery.officer,
          delivery.purchasePriceMt,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jni-scalehouse-log.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Reports</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Analyze throughput volume, weight discrepancies, and commodity origin distribution across all operations. Export or print operational summaries.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <button type="button" onClick={exportCsv} className="h-11 rounded-md border border-line bg-surface px-4 text-sm font-semibold">
            Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg">
            Print brief
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Declared" value={formatMt(sum(deliveries.map((row) => row.declaredMt)))} note="MT" />
        <Stat label="SGS captured" value={formatMt(sum(deliveries.map((row) => capturedSgs(row))))} note="MT" />
        <Stat label="Gap" value={formatMt(sum(deliveries.map((row) => weightGap(row))))} note="SGS minus declared" />
      </div>
      <Panel title="Performance by sister company">
        <TonneChart rows={chart} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 font-semibold">Company</th>
                <th className="py-2 text-right font-semibold">Trucks</th>
                <th className="py-2 text-right font-semibold">Declared</th>
                <th className="py-2 text-right font-semibold">SGS</th>
                <th className="py-2 text-right font-semibold">Gap</th>
              </tr>
            </thead>
            <tbody>
              {chart.map((row) => (
                <tr key={row.code} className="border-t border-line">
                  <td className="py-2 font-semibold">{row.name}</td>
                  <td className="py-2 text-right tabular-nums">{row.trucks}</td>
                  <td className="py-2 text-right tabular-nums">{formatMt(row.declared)}</td>
                  <td className="py-2 text-right tabular-nums">{formatMt(row.sgs)}</td>
                  <td className={`py-2 text-right tabular-nums ${row.gap < 0 ? "text-accent" : ""}`}>{formatMt(row.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Declared tonnes by origin">
          <ul className="space-y-3">
            {originRows.map(([name, tonnes]) => (
              <li key={name}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{name}</span>
                  <span className="tabular-nums">{formatMt(tonnes)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-primary-soft">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (tonnes / originMax) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Largest quantity gaps">
          <ul className="divide-y divide-line text-sm">
            {gaps.map(({ delivery, gap }) => (
              <li key={delivery.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{delivery.truckNumber || "No plate"}</span>
                  <span className="text-muted"> · {delivery.waybill || "no waybill"}</span>
                </span>
                <span className={`tabular-nums ${gap < 0 ? "text-accent" : ""}`}>{formatMt(gap)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
