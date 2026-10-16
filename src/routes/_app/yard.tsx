import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { capturedSgs, formatDate, formatMt, weightGap } from "@/lib/domain";
import { useYard } from "@/components/yard-provider";
import { StatusPill } from "@/components/ui";

export const Route = createFileRoute("/_app/yard")({ component: YardPage });

function YardPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (!/\/yard\/?$/.test(pathname)) return <Outlet />;
  return <YardList />;
}

function YardList() {
  const { workspace, companyId, pendingIds } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => {
    if (!open) return [];
    const needle = query.trim().toLowerCase();
    const plate = needle.replace(/[^a-z0-9]/g, "");
    return open.deliveries.filter((delivery) => {
      if (companyId !== "all" && delivery.companyId !== companyId) return false;
      if (status !== "all" && delivery.status !== status) return false;
      if (!needle) return true;
      const hay = [
        delivery.waybill,
        delivery.truckNumber,
        delivery.truckNorm,
        delivery.driverName,
        delivery.supplierName,
        delivery.origin,
        delivery.officer,
        delivery.comment,
        delivery.warehouse,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle) || (plate.length > 0 && delivery.truckNorm.toLowerCase().includes(plate));
    });
  }, [open, companyId, query, status]);
  if (!open) return null;
  const code = (id: string) => open.companies.find((company) => company.id === id)?.code ?? id;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-4xl">Trucks</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Monitor incoming and processed trucks across all companies. Track weighbridge status, waybills, and inspection stages in real time.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            placeholder="Plate, waybill, driver, supplier"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search the log"
          />
        </div>
        <div className="relative w-full sm:w-48">
          <select
            className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-sm font-medium text-ink shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Status"
          >
            <option value="all">Every status</option>
            <option value="pending">In queue</option>
            <option value="weighing">On the bridge</option>
            <option value="inspection">Inspection</option>
            <option value="hold">Held</option>
            <option value="cleared">Cleared to tip</option>
            <option value="offloading">Tipping</option>
            <option value="offloaded">Offloaded</option>
            <option value="exited">Left the yard</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        </div>
      </div>
      <p className="text-sm text-muted tabular-nums">{rows.length} trucks</p>
      <div className="space-y-2 md:hidden">
        {rows.map((delivery) => (
          <div key={delivery.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{delivery.truckNumber || "No plate"}</p>
                <p className="text-sm text-muted">{code(delivery.companyId)} · {delivery.waybill || "No waybill"}</p>
                {pendingIds.has(delivery.id) ? <p className="text-xs font-semibold text-accent">Waiting to sync</p> : null}
              </div>
              <StatusPill status={delivery.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/60 pt-2">
              <p className="text-xs tabular-nums text-muted">
                {formatMt(delivery.declaredMt)} declared · {formatMt(capturedSgs(delivery))} SGS · gap {formatMt(weightGap(delivery))}
              </p>
              <Link
                to="/yard/$id"
                params={{ id: delivery.id }}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition hover:bg-bg hover:border-ink/30"
              >
                More
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="no-print hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Co.</th>
              <th className="px-3 py-3 font-semibold">Waybill</th>
              <th className="px-3 py-3 font-semibold">Truck</th>
              <th className="px-3 py-3 font-semibold">Origin</th>
              <th className="px-3 py-3 font-semibold text-right">Declared</th>
              <th className="px-3 py-3 font-semibold text-right">SGS</th>
              <th className="px-3 py-3 font-semibold text-right">Gap</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((delivery) => {
              const gap = weightGap(delivery);
              return (
                <tr key={delivery.id} className="border-b border-line last:border-0 hover:bg-bg/40 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatDate(delivery.loggedOn)}</td>
                  <td className="px-3 py-3 font-semibold">{code(delivery.companyId)}</td>
                  <td className="px-3 py-3">
                    <Link to="/yard/$id" params={{ id: delivery.id }} className="font-semibold text-primary hover:underline">
                      {delivery.waybill || "Open"}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{delivery.truckNumber || "—"}</td>
                  <td className="px-3 py-3">{delivery.origin || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMt(delivery.declaredMt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMt(capturedSgs(delivery))}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${gap !== null && gap < 0 ? "text-accent" : ""}`}>
                    {formatMt(gap)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={delivery.status} />
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <Link
                      to="/yard/$id"
                      params={{ id: delivery.id }}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition hover:bg-bg hover:border-ink/30"
                    >
                      More
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
