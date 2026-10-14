import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, Clock, Search } from "lucide-react";
import { canAdmin, ROLE_LABEL, type Role } from "@/lib/domain";
import { setStaffRole } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";

export const Route = createFileRoute("/_app/team")({ component: TeamPage });

const DESKS: Role[] = ["floor", "procurement", "executive", "admin"];

const ROLE_PERMISSIONS: Record<Role, string> = {
  admin: "Full platform administration & user management",
  floor: "Weighbridge, intake tickets & inspection",
  procurement: "Market sheet & commercial pricing",
  executive: "Board, briefs & position reports",
  pending: "Awaiting administrator approval",
};

function TeamPage() {
  const { workspace, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const actor = user.displayName ?? user.primaryEmail ?? "Yard";

  const filteredStaff = useMemo(() => {
    if (!open) return [];
    const needle = search.trim().toLowerCase();
    return open.staff.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (!needle) return true;
      const haystack = `${member.displayName} ${member.email} ${member.userId}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [open, search, roleFilter]);

  if (!open) return null;
  if (!canAdmin(open.me.role)) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-4xl">Access Restricted</h1>
        <p className="text-muted">Only administrators can manage team members and roles.</p>
      </div>
    );
  }

  const handleRoleChange = async (userId: string, nextRole: Role) => {
    setUpdatingId(userId);
    setFeedback(null);
    try {
      await setStaffRole({ data: { userId, role: nextRole, actorName: actor } });
      setFeedback({ type: "success", text: "Role updated successfully." });
      reload();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Could not update role.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">Team Members</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Manage your team and assign roles to control access and permissions across the scalehouse.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              placeholder="Search members by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search members"
            />
          </div>
          <div className="relative w-full sm:w-44">
            <select
              className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-sm font-medium text-ink shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="floor">Floor</option>
              <option value="procurement">Procurement</option>
              <option value="executive">Executive</option>
              <option value="pending">Pending approval</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {filteredStaff.length} {filteredStaff.length === 1 ? "member" : "members"}
        </p>
      </div>

      {feedback ? (
        <p
          className={`text-sm font-medium ${
            feedback.type === "success" ? "text-primary" : "text-accent"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      {filteredStaff.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="font-semibold text-ink">No members found</p>
          <p className="mt-1 text-sm text-muted">No team members match your search or filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-bg/50 text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredStaff.map((member) => {
                  const isCurrent = member.userId === user.id || member.userId === open.me.userId;
                  const initial = (member.displayName || member.email || "U").charAt(0).toUpperCase();
                  const isPending = member.role === "pending";

                  return (
                    <tr key={member.userId} className="transition-colors hover:bg-bg/40">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary-soft text-sm font-bold text-primary">
                            {initial}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-ink">{member.displayName || "Unnamed Member"}</p>
                              {isCurrent ? (
                                <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                  You
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted tabular-nums">
                        {member.email || "—"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <select
                            id={`role-${member.userId}`}
                            className="h-8.5 cursor-pointer appearance-none rounded-md border border-line bg-surface py-1 pr-7 pl-2.5 text-xs font-semibold text-ink shadow-xs transition hover:border-ink/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
                            value={member.role === "pending" ? "pending" : member.role}
                            disabled={updatingId === member.userId}
                            onChange={(event) => {
                              const nextRole = event.target.value as Role;
                              if (nextRole === "pending") return;
                              void handleRoleChange(member.userId, nextRole);
                            }}
                            aria-label={`Role for ${member.displayName || member.email}`}
                          >
                            {isPending ? <option value="pending">Pending Approval</option> : null}
                            {DESKS.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                            <Clock className="size-3" aria-hidden="true" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted">
                        {ROLE_PERMISSIONS[member.role] ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {filteredStaff.map((member) => {
              const isCurrent = member.userId === user.id || member.userId === open.me.userId;
              const initial = (member.displayName || member.email || "U").charAt(0).toUpperCase();
              const isPending = member.role === "pending";

              return (
                <div key={member.userId} className="rounded-lg border border-line bg-surface p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary-soft text-sm font-bold text-primary">
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-ink">{member.displayName || "Unnamed Member"}</p>
                          {isCurrent ? (
                            <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted">{member.email || "—"}</p>
                      </div>
                    </div>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                        <Clock className="size-3" aria-hidden="true" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-xs font-medium text-muted">Role</span>
                    <div className="relative inline-flex items-center">
                      <select
                        className="h-8.5 cursor-pointer appearance-none rounded-md border border-line bg-surface py-1 pr-7 pl-2.5 text-xs font-semibold text-ink shadow-xs transition hover:border-ink/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
                        value={member.role === "pending" ? "pending" : member.role}
                        disabled={updatingId === member.userId}
                        onChange={(event) => {
                          const nextRole = event.target.value as Role;
                          if (nextRole === "pending") return;
                          void handleRoleChange(member.userId, nextRole);
                        }}
                        aria-label={`Role for ${member.displayName || member.email}`}
                      >
                        {isPending ? <option value="pending">Pending Approval</option> : null}
                        {DESKS.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
