import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppUser } from "@/lib/auth/use-current-user";
import { createDelivery, getWorkspace, updateDelivery } from "@/lib/scalehouse.functions";
import type { Workspace } from "@/lib/domain";
import {
  applyOutbox,
  enqueueCreate,
  enqueueUpdate,
  flushOutbox,
  listOutbox,
  pendingDeliveryIds,
  type GatePayload,
  type OutboxOp,
} from "@/lib/outbox";

const STORAGE = "jni-scalehouse-company";

type YardContextValue = {
  user: AppUser;
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  companyId: string;
  setCompanyId: (id: string) => void;
  reload: () => void;
  online: boolean;
  syncing: boolean;
  outbox: OutboxOp[];
  pendingIds: Set<string>;
  queueCreate: (payload: GatePayload) => Promise<string>;
  queueUpdate: (payload: GatePayload & { id: string }) => Promise<string>;
  flushNow: () => Promise<void>;
};

const YardContext = createContext<YardContextValue | null>(null);

export function YardProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyIdState] = useState("all");
  const [tick, setTick] = useState(0);
  const [outbox, setOutbox] = useState<OutboxOp[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE);
    if (saved) setCompanyIdState(saved);
  }, []);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    window.localStorage.setItem(STORAGE, id);
  }, []);

  const refreshOutbox = useCallback(async () => {
    const rows = await listOutbox();
    setOutbox(rows);
    return rows;
  }, []);

  useEffect(() => {
    void refreshOutbox();
    const mark = () => setOnline(navigator.onLine);
    mark();
    window.addEventListener("online", mark);
    window.addEventListener("offline", mark);
    return () => {
      window.removeEventListener("online", mark);
      window.removeEventListener("offline", mark);
    };
  }, [refreshOutbox]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getWorkspace({
      data: { displayName: user.displayName ?? "", email: user.primaryEmail ?? "" },
    })
      .then((next) => {
        if (cancel) return;
        setWorkspace(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(err instanceof Error ? err.message : "Could not open the yard.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [user.id, user.displayName, user.primaryEmail, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const flushNow = useCallback(async () => {
    if (flushing.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const done = await flushOutbox({
        create: (payload) => createDelivery({ data: payload }),
        update: (payload) => updateDelivery({ data: payload }),
      });
      await refreshOutbox();
      if (done > 0) setTick((n) => n + 1);
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [refreshOutbox]);

  useEffect(() => {
    if (!online || outbox.length === 0) return;
    void flushNow();
  }, [online, outbox.length, flushNow]);

  const queueCreate = useCallback(
    async (payload: GatePayload) => {
      const localId = await enqueueCreate(payload);
      await refreshOutbox();
      return localId;
    },
    [refreshOutbox],
  );

  const queueUpdate = useCallback(
    async (payload: GatePayload & { id: string }) => {
      const id = await enqueueUpdate(payload);
      await refreshOutbox();
      return id;
    },
    [refreshOutbox],
  );

  const visible = useMemo(() => {
    if (!workspace || workspace.gate !== "open" || outbox.length === 0) return workspace;
    return { ...workspace, deliveries: applyOutbox(workspace.deliveries, outbox) };
  }, [workspace, outbox]);

  const pendingIds = useMemo(() => pendingDeliveryIds(outbox), [outbox]);

  const value = useMemo(
    () => ({
      user,
      workspace: visible,
      loading,
      error,
      companyId,
      setCompanyId,
      reload,
      online,
      syncing,
      outbox,
      pendingIds,
      queueCreate,
      queueUpdate,
      flushNow,
    }),
    [
      user,
      visible,
      loading,
      error,
      companyId,
      setCompanyId,
      reload,
      online,
      syncing,
      outbox,
      pendingIds,
      queueCreate,
      queueUpdate,
      flushNow,
    ],
  );

  return <YardContext.Provider value={value}>{children}</YardContext.Provider>;
}

export function useYard() {
  const value = useContext(YardContext);
  if (!value) throw new Error("Yard provider missing");
  return value;
}
