import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { canEditYard } from "@/lib/domain";
import { createDelivery } from "@/lib/scalehouse.functions";
import { isTransportError } from "@/lib/outbox";
import type { SpokenFields } from "@/lib/speech-intake";
import { useYard } from "@/components/yard-provider";
import { DeliveryForm, emptyDraft, payloadFromDraft } from "@/components/delivery-form";
import { SpokenIntake } from "@/components/spoken-intake";

export const Route = createFileRoute("/_app/intake")({ component: IntakePage });

function IntakePage() {
  const navigate = useNavigate();
  const { workspace, companyId, user, reload, queueCreate, online } = useYard();
  const [spoken, setSpoken] = useState<{ token: number; fields: SpokenFields } | null>(null);
  const open = workspace?.gate === "open" ? workspace : null;
  if (!open) return null;
  if (!canEditYard(open.me.role)) {
    return (
      <div>
        <h1 className="font-display text-4xl">Intake is a floor desk</h1>
        <p className="mt-2 text-muted">Executives and procurement can read the log. The gate team records the truck.</p>
        <Link to="/yard" className="mt-4 inline-flex text-sm font-semibold text-primary">
          Back to the yard
        </Link>
      </div>
    );
  }
  const warehouses = [...new Set(open.deliveries.map((delivery) => delivery.warehouse).filter(Boolean))].sort();
  const openPlates = open.deliveries
    .filter((delivery) => delivery.status !== "offloaded" && delivery.status !== "exited")
    .map((delivery) => delivery.truckNorm);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-4xl">Add intake/waybill</h1>
        {!online ? (
          <p className="mt-2 text-sm font-semibold text-accent">No signal. The ticket stays on this phone and syncs later.</p>
        ) : null}
      </div>
      <SpokenIntake onApply={(fields) => setSpoken({ token: Date.now(), fields })} />
      <DeliveryForm
        initial={emptyDraft(companyId)}
        companies={open.companies}
        commodities={open.commodities}
        hubs={open.hubs}
        warehouses={warehouses}
        openPlates={openPlates}
        spoken={spoken}
        submitLabel="Save to the log"
        onSubmit={async (draft) => {
          const data = {
            ...payloadFromDraft(draft),
            actorName: user.displayName ?? user.primaryEmail ?? "Yard",
          };
          if (!navigator.onLine) {
            const localId = await queueCreate(data);
            await navigate({ to: "/yard/$id", params: { id: localId } });
            return;
          }
          try {
            const created = await createDelivery({ data });
            reload();
            await navigate({ to: "/yard/$id", params: { id: created.id } });
          } catch (err) {
            if (!isTransportError(err)) throw err;
            const localId = await queueCreate(data);
            await navigate({ to: "/yard/$id", params: { id: localId } });
          }
        }}
      />
    </div>
  );
}
