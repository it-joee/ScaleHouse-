import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, PauseCircle, Pencil, Plus, Search, X } from "lucide-react";
import { canAdmin, type Company } from "@/lib/domain";
import { saveCompany } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { Button, Field, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_app/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const { workspace, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit Modal State
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // Add Company Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const admin = open ? canAdmin(open.me.role) : false;
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";

  // Escape key handler for both modals
  useEffect(() => {
    if (!editingCompany && !showAddModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingCompany && !editBusy) setEditingCompany(null);
        if (showAddModal && !busy) setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingCompany, editBusy, showAddModal, busy]);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = "Company legal name is required.";
    }
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      errs.code = "Short code is required.";
    } else if (cleanCode.length < 2 || cleanCode.length > 6) {
      errs.code = "Code must be between 2 and 6 letters (e.g. JNI, ROYAL).";
    }
    return errs;
  };

  const companiesWithTrucks = useMemo(() => {
    if (!open) return [];
    return open.companies.map((company) => {
      const trucks = open.deliveries.filter((delivery) => delivery.companyId === company.id).length;
      return { company, trucks };
    });
  }, [open]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companiesWithTrucks.filter(({ company }) => {
      if (statusFilter === "receiving" && !company.active) return false;
      if (statusFilter === "paused" && company.active) return false;
      if (!q) return true;
      return (
        company.name.toLowerCase().includes(q) ||
        company.code.toLowerCase().includes(q)
      );
    });
  }, [companiesWithTrucks, search, statusFilter]);

  const handleToggleActive = (company: Company) => {
    setTogglingId(company.id);
    setError(null);
    saveCompany({
      data: {
        id: company.id,
        name: company.name,
        code: company.code,
        active: !company.active,
        actorName: actor,
      },
    })
      .then(() => reload())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not update the company."))
      .finally(() => setTogglingId(null));
  };

  const handleStartEdit = (company: Company) => {
    setEditingCompany(company);
    setEditName(company.name);
    setEditCode(company.code);
    setEditActive(company.active);
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleSaveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCompany) return;

    const errs: Record<string, string> = {};
    if (!editName.trim()) {
      errs.name = "Company legal name is required.";
    }
    const cleanCode = editCode.trim().toUpperCase();
    if (!cleanCode) {
      errs.code = "Short code is required.";
    } else if (cleanCode.length < 2 || cleanCode.length > 6) {
      errs.code = "Code must be between 2 and 6 letters (e.g. JNI, ROYAL).";
    }

    if (Object.keys(errs).length > 0) {
      setEditFieldErrors(errs);
      return;
    }

    setEditBusy(true);
    setEditError(null);

    saveCompany({
      data: {
        id: editingCompany.id,
        name: editName.trim(),
        code: cleanCode,
        active: editActive,
        actorName: actor,
      },
    })
      .then(() => {
        setEditingCompany(null);
        reload();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not update the company.";
        setEditError(msg);
        if (/code/i.test(msg)) {
          setEditFieldErrors((prev) => ({ ...prev, code: msg }));
        } else if (/name/i.test(msg)) {
          setEditFieldErrors((prev) => ({ ...prev, name: msg }));
        }
      })
      .finally(() => setEditBusy(false));
  };

  const handleSubmitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setBusy(true);
    setError(null);
    saveCompany({
      data: {
        id: "",
        name: name.trim(),
        code: code.trim().toUpperCase(),
        active: true,
        actorName: actor,
      },
    })
      .then(() => {
        setName("");
        setCode("");
        setFieldErrors({});
        setShowAddModal(false);
        reload();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not add the company.";
        setError(message);
        if (/code/i.test(message)) {
          setFieldErrors((prev) => ({ ...prev, code: message }));
        } else if (/name/i.test(message)) {
          setFieldErrors((prev) => ({ ...prev, name: message }));
        }
      })
      .finally(() => setBusy(false));
  };

  if (!open) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Companies</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Manage registered companies and active receiving entities across the scalehouse network. Registered companies immediately appear in intake, board summaries, and reports.
        </p>
      </div>

      {/* Filter, Search Bar, and Add Company Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              placeholder="Search companies by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search companies"
            />
          </div>
          <div className="relative w-full sm:w-44">
            <select
              className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-sm font-medium text-ink shadow-xs transition hover:border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="receiving">Receiving (Active)</option>
              <option value="paused">Paused</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted tabular-nums">
            {filteredCompanies.length} {filteredCompanies.length === 1 ? "company" : "companies"}
          </p>
          {admin ? (
            <Button
              onClick={() => {
                setName("");
                setCode("");
                setFieldErrors({});
                setError(null);
                setShowAddModal(true);
              }}
              className="inline-flex h-10 items-center gap-2"
            >
              <Plus className="size-4" />
              Add company
            </Button>
          ) : null}
        </div>
      </div>

      {error && !showAddModal ? (
        <p className="text-sm font-medium text-accent" role="alert">
          {error}
        </p>
      ) : null}

      {filteredCompanies.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="font-semibold text-ink">No companies found</p>
          <p className="mt-1 text-sm text-muted">No registered companies match your search or filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-bg/50 text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Trucks</th>
                  <th className="px-4 py-3">Status</th>
                  {admin ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCompanies.map(({ company, trucks }) => (
                  <tr key={company.id} className="transition-colors hover:bg-bg/40">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-xs font-bold text-primary">
                          {company.code.slice(0, 3)}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{company.name}</p>
                          <p className="text-xs text-muted md:hidden">{company.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md border border-line bg-bg px-2 py-0.5 text-xs font-bold tracking-wide text-primary">
                        {company.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                      <span className="font-semibold text-ink">{trucks}</span>{" "}
                      <span className="text-muted">{trucks === 1 ? "truck" : "trucks"}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {company.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          Receiving
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                          <PauseCircle className="size-3" aria-hidden="true" />
                          Paused
                        </span>
                      )}
                    </td>
                    {admin ? (
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(company)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition hover:bg-bg hover:border-ink/30"
                          >
                            <Pencil className="size-3 text-muted" aria-hidden="true" />
                            Edit
                          </button>
                          {company.id !== "unassigned" ? (
                            <button
                              type="button"
                              disabled={togglingId === company.id}
                              onClick={() => handleToggleActive(company)}
                              className={cn(
                                "inline-flex h-8 items-center justify-center rounded-md border border-line px-2.5 text-xs font-semibold shadow-xs transition disabled:opacity-50",
                                company.active
                                  ? "bg-surface text-ink hover:bg-bg"
                                  : "bg-primary text-primary-fg hover:opacity-90",
                              )}
                            >
                              {togglingId === company.id ? "Updating…" : company.active ? "Pause" : "Reopen"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {filteredCompanies.map(({ company, trucks }) => (
              <div key={company.id} className="rounded-lg border border-line bg-surface p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-xs font-bold text-primary">
                      {company.code.slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{company.name}</p>
                      <p className="text-xs font-bold text-primary">{company.code}</p>
                    </div>
                  </div>
                  {company.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Receiving
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                      <PauseCircle className="size-3" aria-hidden="true" />
                      Paused
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3">
                  <p className="text-xs text-muted tabular-nums">
                    <span className="font-semibold text-ink">{trucks}</span> {trucks === 1 ? "truck" : "trucks"} logged
                  </p>
                  {admin ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(company)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition hover:bg-bg"
                      >
                        <Pencil className="size-3 text-muted" aria-hidden="true" />
                        Edit
                      </button>
                      {company.id !== "unassigned" ? (
                        <button
                          type="button"
                          disabled={togglingId === company.id}
                          onClick={() => handleToggleActive(company)}
                          className={cn(
                            "inline-flex h-8 items-center justify-center rounded-md border border-line px-2.5 text-xs font-semibold shadow-xs transition disabled:opacity-50",
                            company.active
                              ? "bg-surface text-ink hover:bg-bg"
                              : "bg-primary text-primary-fg hover:opacity-90",
                          )}
                        >
                          {togglingId === company.id ? "Updating…" : company.active ? "Pause" : "Reopen"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Company Modal Dialog */}
      {editingCompany ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-company-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editBusy) {
              setEditingCompany(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 id="edit-company-title" className="font-display text-xl font-bold text-ink">
                  Edit Company
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Update legal name and short code for <span className="font-semibold text-primary">{editingCompany.code}</span>.
                </p>
              </div>
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditingCompany(null)}
                className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              noValidate
              className="mt-4 space-y-4"
              onSubmit={handleSaveEdit}
            >
              <Field label="Legal name" error={editFieldErrors.name}>
                <input
                  className={controlClass(Boolean(editFieldErrors.name))}
                  aria-invalid={Boolean(editFieldErrors.name)}
                  value={editName}
                  disabled={editBusy}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editFieldErrors.name) {
                      setEditFieldErrors((prev) => ({ ...prev, name: "" }));
                    }
                  }}
                />
              </Field>

              <Field
                label="Short code"
                hint="Two to six letters. Printed on the board and intake sheets."
                error={editFieldErrors.code}
              >
                <input
                  className={controlClass(Boolean(editFieldErrors.code))}
                  aria-invalid={Boolean(editFieldErrors.code)}
                  value={editCode}
                  disabled={editBusy}
                  onChange={(e) => {
                    setEditCode(e.target.value.toUpperCase());
                    if (editFieldErrors.code) {
                      setEditFieldErrors((prev) => ({ ...prev, code: "" }));
                    }
                  }}
                />
              </Field>

              {editingCompany.id !== "unassigned" ? (
                <label className="flex items-center gap-2.5 pt-1 text-sm font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-line text-primary focus:ring-primary/20"
                    checked={editActive}
                    disabled={editBusy}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  <span className="text-ink">Allow intake (Receiving active)</span>
                </label>
              ) : null}

              {editError ? (
                <p className="rounded-md bg-accent-soft p-3 text-xs font-semibold text-accent" role="alert">
                  {editError}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
                <Button
                  variant="quiet"
                  disabled={editBusy}
                  onClick={() => setEditingCompany(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Add Company Modal Dialog */}
      {showAddModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-company-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 id="add-company-title" className="font-display text-xl font-bold text-ink">
                  Add Company
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Register a new receiving company to the scalehouse network.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowAddModal(false)}
                className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              noValidate
              className="mt-4 space-y-4"
              onSubmit={handleSubmitAdd}
            >
              <Field label="Legal name" error={fieldErrors.name}>
                <input
                  className={controlClass(Boolean(fieldErrors.name))}
                  aria-invalid={Boolean(fieldErrors.name)}
                  placeholder="e.g. Frontier Agritrade Ltd"
                  value={name}
                  disabled={busy}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                />
              </Field>

              <Field
                label="Short code"
                hint="Two to six letters (e.g. JNI, ROYAL). Printed on the board."
                error={fieldErrors.code}
              >
                <input
                  className={controlClass(Boolean(fieldErrors.code))}
                  aria-invalid={Boolean(fieldErrors.code)}
                  placeholder="e.g. FRT"
                  value={code}
                  disabled={busy}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    clearFieldError("code");
                  }}
                />
              </Field>

              {error ? (
                <p className="rounded-md bg-accent-soft p-3 text-xs font-semibold text-accent" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Adding…" : "Add company"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
