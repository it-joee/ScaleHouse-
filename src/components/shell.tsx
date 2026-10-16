import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  AudioLines,
  Building2,
  ChevronDown,
  ClipboardPlus,
  FileBarChart,
  FileSignature,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Scale,
  Truck,
  Users,
  Warehouse,
  BookUser,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { ROLE_LABEL, canAdmin, canBrief, canEditYard, listExceptions, openExceptions, type Role } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { useYard } from "@/components/yard-provider";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

const LINKS = [
  { to: "/", label: "Board", icon: LayoutDashboard, exact: true },
  { to: "/yard", label: "Trucks", icon: Truck, exact: false },
  { to: "/intake", label: "Add intake/waybill", shortLabel: "Intake", icon: ClipboardPlus, exact: true, yard: true },
  { to: "/exceptions", label: "Flagged Issues", shortLabel: "Issues", icon: AlertTriangle, exact: true },
  { to: "/position", label: "Position", icon: Warehouse, exact: true },
  { to: "/contracts", label: "Contracts", icon: FileSignature, exact: true },
  { to: "/suppliers", label: "Suppliers", icon: BookUser, exact: true },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, exact: true, brief: true },
  { to: "/voice", label: "Voice", icon: AudioLines, exact: true },
  { to: "/market", label: "Market", icon: Scale, exact: true },
  { to: "/reports", label: "Reports", icon: FileBarChart, exact: true },
  { to: "/companies", label: "Companies", icon: Building2, exact: true },
  { to: "/team", label: "Team", icon: Users, exact: true, admin: true },
] as const;

type AppTo = (typeof LINKS)[number]["to"];

export function Shell({ children }: { children: ReactNode }) {
  const { workspace, companyId, setCompanyId, online, syncing, outbox, flushNow } = useYard();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  const openCount = useMemo(() => {
    if (!workspace || workspace.gate !== "open") return 0;
    const items = openExceptions(listExceptions(workspace.deliveries, workspace.commodities, workspace.prices), workspace.clears);
    if (companyId === "all") return items.length;
    return items.filter((item) => workspace.deliveries.find((delivery) => delivery.id === item.deliveryId)?.companyId === companyId).length;
  }, [workspace, companyId]);
  if (!workspace || workspace.gate !== "open") return null;
  const role = workspace.me.role;
  const links = LINKS.filter((link) => {
    if ("admin" in link && link.admin && !canAdmin(role)) return false;
    if ("yard" in link && link.yard && !canEditYard(role)) return false;
    if ("brief" in link && link.brief && !canBrief(role)) return false;
    return true;
  });
  const mobile = [
    links.find((link) => link.to === "/")!,
    links.find((link) => link.to === "/yard")!,
    canBrief(role)
      ? links.find((link) => link.to === "/whatsapp")!
      : (links.find((link) => link.to === "/intake") ?? links.find((link) => link.to === "/reports")!),
    links.find((link) => link.to === "/exceptions")!,
  ];
  const moreLinks = links.filter((link) => !mobile.some((item) => item.to === link.to));
  const syncError = outbox.find((op) => op.error)?.error;

  return (
    <div className="min-h-screen bg-bg text-ink md:grid md:grid-cols-[15rem_1fr]">
      <aside className="no-print hidden border-r border-line bg-surface md:sticky md:top-0 md:z-20 md:flex md:h-screen md:flex-col">
        <div className="shrink-0 border-b border-line px-4 py-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">JNI</p>
          <p className="font-display text-2xl font-bold tracking-tight">Scalehouse</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              label={link.label}
              icon={link.icon}
              exact={link.exact}
              badge={link.to === "/exceptions" ? openCount : 0}
            />
          ))}
        </nav>
        <SidebarUserProfile />
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-bg">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <p className="font-display text-xl font-bold tracking-tight md:hidden">Scalehouse</p>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="company-select"
                  className="text-xs font-bold uppercase tracking-wider text-muted select-none"
                >
                  Company
                </label>
                <div className="relative inline-flex items-center">
                  <select
                    id="company-select"
                    className="h-8.5 cursor-pointer appearance-none rounded-md border border-line bg-surface py-1 pr-7 pl-2.5 text-xs font-semibold text-ink shadow-xs transition hover:border-ink/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    value={companyId}
                    onChange={(event) => setCompanyId(event.target.value)}
                    aria-label="Filter by company"
                  >
                    <option value="all">All companies</option>
                    {workspace.companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.code} · {company.name}
                        {company.active ? "" : " (paused)"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 md:hidden">
              <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold tracking-wide text-primary uppercase">
                {ROLE_LABEL[role as Role]}
              </span>
              <UserButton />
            </div>
          </div>
        </header>
        {!online || outbox.length > 0 || syncing ? (
          <div className="no-print flex flex-wrap items-center gap-3 border-b border-line bg-accent-soft px-4 py-3 text-sm text-accent">
            <p className="font-semibold">
              {syncing
                ? "Syncing the gate…"
                : !online
                  ? "No signal. New tickets and status changes stay on this phone."
                  : syncError
                    ? syncError
                    : `${outbox.length} waiting to sync.`}
            </p>
            {online && !syncing && outbox.length > 0 ? (
              <button type="button" onClick={() => void flushNow()} className="h-11 font-semibold underline">
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="px-4 py-5 pb-24 md:px-6 md:pb-8">{children}</div>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        {more ? (
          <div className="absolute inset-x-3 bottom-full mb-2 rounded-lg border border-line bg-surface p-2">
            {moreLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMore(false)}
                className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold"
              >
                <link.icon className="size-4" aria-hidden="true" />
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-5">
          {mobile.map((link) => {
            const active = link.exact ? pathname === link.to : pathname === link.to || pathname.startsWith(`${link.to}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMore(false)}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{"shortLabel" in link && link.shortLabel ? link.shortLabel : link.label}</span>
                {link.to === "/exceptions" && openCount > 0 ? (
                  <span className="sr-only">{openCount} open</span>
                ) : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore((open) => !open)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
              more ? "text-primary" : "text-muted",
            )}
          >
            <Building2 className="size-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  badge,
}: {
  to: AppTo;
  label: string;
  icon: typeof Truck;
  exact: boolean;
  badge?: number;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={cn(
        "flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold",
        active ? "bg-primary text-primary-fg" : "text-ink",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
      {badge ? <span className="ml-auto tabular-nums">{badge}</span> : null}
    </Link>
  );
}

function SidebarUserProfile() {
  const { user, workspace } = useYard();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!user || !workspace || workspace.gate !== "open") return null;
  const role = workspace.me.role;
  const name = user.displayName || workspace.me.displayName || user.primaryEmail?.split("@")[0] || "Account";
  const roleTitle = ROLE_LABEL[role as Role] ?? role;
  const initial = name.charAt(0).toUpperCase();
  const email = user.primaryEmail || workspace.me.email || "";

  return (
    <div className="shrink-0 border-t border-line p-3">
      <div
        className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-bg/60"
        title={email ? `${name} (${email})` : name}
      >
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-9 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary-soft text-sm font-bold text-primary">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-ink">{name}</p>
          <p className="mt-0.5 truncate text-xs font-medium leading-tight text-muted capitalize">{roleTitle}</p>
        </div>
        {authEnabled && !gateSession && (
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().catch(() => setSigningOut(false));
            }}
            title={signingOut ? "Signing out…" : "Sign out"}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
            aria-label="Sign out"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

