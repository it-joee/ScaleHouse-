import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  canBrief,
  capturedSgs,
  contractBooks,
  formatMt,
  houseContract,
  inYard,
  listExceptions,
  morningBrief,
  openExceptions,
  tonnesLeft,
  whatsAppHref,
} from "@/lib/domain";
import { useYard } from "@/components/yard-provider";
import { Button, control } from "@/components/ui";

const PHONE_KEY = "jni-scalehouse-wa";

export const Route = createFileRoute("/_app/whatsapp")({ component: WhatsAppPage });

function WhatsAppPage() {
  const { workspace, companyId } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem(PHONE_KEY);
    if (saved) setPhone(saved);
  }, []);
  const brief = useMemo(() => {
    if (!open) return "";
    const deliveries = companyId === "all" ? open.deliveries : open.deliveries.filter((delivery) => delivery.companyId === companyId);
    const exceptions = openExceptions(listExceptions(open.deliveries, open.commodities, open.prices), open.clears).filter(
      (item) => companyId === "all" || deliveries.some((delivery) => delivery.id === item.deliveryId),
    );
    return morningBrief({
      on: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date()),
      companies: open.companies.filter((company) => companyId === "all" || company.id === companyId),
      deliveries,
      movements: open.movements,
      contracts: open.contracts,
      openCount: exceptions.length,
      exceptionLines: exceptions.slice(0, 3).map((item) => item.detail),
    });
  }, [open, companyId]);
  if (!open) return null;
  if (!canBrief(open.me.role)) {
    return (
      <div>
        <h1 className="font-display text-4xl">Executives and admins</h1>
        <p className="mt-2 text-muted">The WhatsApp deck is the morning strip. The floor and procurement stay on the yard.</p>
      </div>
    );
  }
  const yard = open.deliveries.filter(
    (delivery) => inYard(delivery.status) && (companyId === "all" || delivery.companyId === companyId),
  );
  const code = (id: string) => open.companies.find((company) => company.id === id)?.code ?? id;
  const books = contractBooks(open.contracts, open.deliveries);
  const houses = open.companies.filter((company) => company.active && (companyId === "all" || company.id === companyId));

  function savePhone(value: string) {
    setPhone(value);
    window.localStorage.setItem(PHONE_KEY, value);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">WhatsApp</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Generate and share daily scalehouse summaries with executives and team members. Review current yard tonnage, flagged issues, and sister company delivery status directly via WhatsApp.
        </p>
      </div>
      {houses.some((company) => houseContract(company.id, books).count > 0) ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {houses.map((company) => {
            const standing = houseContract(company.id, books);
            if (standing.count === 0) return null;
            return (
              <div key={company.id} className="rounded-lg border border-line bg-surface p-4">
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">{company.code}</p>
                <p className="font-display text-2xl">{tonnesLeft(standing.stillToCome)}</p>
                <p className="text-sm text-muted">
                  of {formatMt(standing.promised)} MT · {standing.count} contracts
                </p>
              </div>
            );
          })}
        </section>
      ) : (
        <p className="text-sm text-muted">No active contracts recorded yet. Outstanding balances will appear here as procurement enters contracts.</p>
      )}
      <label className="block max-w-sm text-sm">
        <span className="font-semibold">Send to</span>
        <input
          className={`${control} mt-1.5`}
          inputMode="tel"
          placeholder="024 000 0000"
          value={phone}
          onChange={(event) => savePhone(event.target.value)}
          aria-label="WhatsApp number"
        />
      </label>
      <section className="rounded-lg border border-line bg-surface p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm">{brief}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              void navigator.clipboard.writeText(brief).then(() => {
                setCopied(true);
              });
            }}
          >
            {copied ? "Copied" : "Copy brief"}
          </Button>
          <a
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg"
            href={whatsAppHref(phone, brief)}
            target="_blank"
            rel="noreferrer"
          >
            Open in WhatsApp
          </a>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Trucks still inside</h2>
        {yard.length === 0 ? <p className="text-sm text-muted">Nothing is waiting in this view.</p> : null}
        <ul className="space-y-3">
          {yard.slice(0, 12).map((delivery) => {
            const driverText = `Bonjour. Le camion ${delivery.truckNumber || "sans plaque"} est au parc JNI. ${formatMt(delivery.declaredMt)} MT déclarées. Attendez l'appel.`;
            const supplierText = `Bonjour. Le camion ${delivery.truckNumber || "sans plaque"} (${code(delivery.companyId)}) est arrivé. ${formatMt(delivery.declaredMt)} MT déclarées. SGS: ${formatMt(capturedSgs(delivery))} MT.`;
            return (
              <li key={delivery.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {delivery.truckNumber || "No plate"} · {code(delivery.companyId)}
                    </p>
                    <p className="text-sm text-muted">
                      {delivery.supplierName || "No supplier"} · {formatMt(delivery.declaredMt)} MT · {delivery.origin || "Origin not set"}
                    </p>
                  </div>
                  <Link to="/yard/$id" params={{ id: delivery.id }} className="text-sm font-semibold text-primary">
                    Ticket
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {delivery.driverContact ? (
                    <a className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm font-semibold" href={whatsAppHref(delivery.driverContact, driverText)} target="_blank" rel="noreferrer">
                      Message driver
                    </a>
                  ) : null}
                  {delivery.supplierContact ? (
                    <a className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm font-semibold" href={whatsAppHref(delivery.supplierContact, supplierText)} target="_blank" rel="noreferrer">
                      Message supplier
                    </a>
                  ) : null}
                  {!delivery.driverContact && !delivery.supplierContact ? (
                    <p className="text-sm text-muted">No phone on this ticket.</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
