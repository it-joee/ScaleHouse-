import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canAdmin } from "@/lib/domain";
import { saveCompany } from "@/lib/scalehouse.functions";
import { useYard } from "@/components/yard-provider";
import { Button, Field, Panel, controlClass, scrollToFirstError } from "@/components/ui";

export const Route = createFileRoute("/_app/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const { workspace, user, reload } = useYard();
  const open = workspace?.gate === "open" ? workspace : null;
  const formRef = useRef<HTMLFormElement | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const admin = canAdmin(open.me.role);
  const actor = user.displayName ?? user.primaryEmail ?? "Yard";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Companies</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Manage sister companies and active receiving entities across the scalehouse network. Registered companies immediately appear in intake, board summaries, and reports.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {open.companies.map((company) => {
          const trucks = open.deliveries.filter((delivery) => delivery.companyId === company.id).length;
          return (
            <article key={company.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl text-primary">{company.code}</p>
                  <h2 className="text-lg font-semibold">{company.name}</h2>
                </div>
                <p className="text-sm text-muted tabular-nums">{trucks} trucks</p>
              </div>
              <p className="mt-2 text-sm text-muted">{company.active ? "Receiving" : "Paused — hidden from new intake"}</p>
              {admin && company.id !== "unassigned" ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      saveCompany({
                        data: { id: company.id, name: company.name, code: company.code, active: !company.active, actorName: actor },
                      })
                        .then(() => reload())
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not update the company."));
                    }}
                  >
                    {company.active ? "Pause" : "Reopen"}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {admin ? (
        <Panel title="Add a sister company">
          <form
            ref={formRef}
            noValidate
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const errs = validate();
              if (Object.keys(errs).length > 0) {
                setFieldErrors(errs);
                setTimeout(() => scrollToFirstError(formRef.current), 40);
                return;
              }
              setBusy(true);
              setError(null);
              saveCompany({ data: { id: "", name: name.trim(), code: code.trim().toUpperCase(), active: true, actorName: actor } })
                .then(() => {
                  setName("");
                  setCode("");
                  setFieldErrors({});
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
                  setTimeout(() => scrollToFirstError(formRef.current), 40);
                })
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Legal name" error={fieldErrors.name}>
              <input
                className={controlClass(Boolean(fieldErrors.name))}
                aria-invalid={Boolean(fieldErrors.name)}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
              />
            </Field>
            <Field label="Short code" hint="Two to six letters. Printed on the board." error={fieldErrors.code}>
              <input
                className={controlClass(Boolean(fieldErrors.code))}
                aria-invalid={Boolean(fieldErrors.code)}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  clearFieldError("code");
                }}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add company"}
              </Button>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-accent" role="alert">{error}</p> : null}
        </Panel>
      ) : (
        <p className="text-sm text-muted">An admin adds sister companies. Ask them if a new house is joining the yard.</p>
      )}
    </div>
  );
}
