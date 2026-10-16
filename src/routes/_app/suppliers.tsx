import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { contractBooks, formatDate, formatMt, normSupplier, supplierLedger, tonnesLeft, whatsAppHref } from "@/lib/domain";
import { useYard } from "@/components/yard-provider";
import { control } from "@/components/ui";

export const Route = createFileRoute("/_app/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  const { workspace, companyId } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const lines = useMemo(() => {
    if (!open) return [];
    const scoped = companyId === "all" ? open.deliveries : open.deliveries.filter((delivery) => delivery.companyId === companyId);
    const needle = query.trim().toLowerCase();
    return supplierLedger(scoped).filter((line) => !needle || `${line.name} ${line.origins.join(" ")} ${line.contact}`.toLowerCase().includes(needle));
  }, [open, companyId, query]);
  if (!open) return null;
  const code = (id: string) => open.companies.find((company) => company.id === id)?.code ?? id;
  const books = contractBooks(open.contracts, open.deliveries).filter(
    (book) => companyId === "all" || book.contract.companyId === companyId,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-4xl">Suppliers</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Track supplier delivery history, total delivered tonnage, and quality records across all companies. Select any supplier to view their ticket history and open contract balances.
        </p>
      </div>
      <div className="max-w-md">
        <input
          className={control}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by supplier name or origin…"
          aria-label="Search suppliers"
        />
      </div>
      {lines.length === 0 ? <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">No suppliers found matching your search.</p> : null}
      <ul className="space-y-3">
        {lines.map((line) => {
          const trucks = open.deliveries.filter(
            (delivery) => normSupplier(delivery.supplierName) === line.key && (companyId === "all" || delivery.companyId === companyId),
          );
          const paper = books.filter((book) => normSupplier(book.contract.supplierName) === line.key);
          const still = paper.reduce((total, book) => total + book.stillToCome, 0);
          const hello = `Bonjour ${line.name}. JNI Scalehouse: ${line.trucks} trucks on the log.`;
          return (
            <li key={line.key} className="rounded-lg border border-line bg-surface p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenKey((current) => (current === line.key ? null : line.key))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-sm text-muted">
                      {line.houses.map(code).join(", ") || "—"} · {line.origins.join(", ") || "Origin not set"}
                      {line.contact ? ` · ${line.contact}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{line.trucks} trucks</p>
                </div>
                <p className="mt-2 text-sm tabular-nums text-muted">
                  Declared {formatMt(line.declared)} · SGS {formatMt(line.sgs)} · avg gap {formatMt(line.avgGap)} · claims {line.claims}
                  {line.lastOn ? ` · last ${formatDate(line.lastOn)}` : ""}
                  {paper.length ? ` · ${tonnesLeft(still)}` : ""}
                </p>
              </button>
              {line.contact ? (
                <a className="mt-2 inline-flex h-11 items-center text-sm font-semibold text-primary" href={whatsAppHref(line.contact, hello)} target="_blank" rel="noreferrer">
                  WhatsApp supplier
                </a>
              ) : null}
              {openKey === line.key ? (
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {trucks.slice(0, 8).map((delivery) => (
                    <li key={delivery.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {delivery.truckNumber || "No plate"} · {formatDate(delivery.loggedOn)}
                      </span>
                      <Link to="/yard/$id" params={{ id: delivery.id }} className="font-semibold text-primary">
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
