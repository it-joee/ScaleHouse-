import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { Button, Field, controlClass, scrollToFirstError } from "@/components/ui";

export function Boot({ label = "Opening the yard…" }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">JNI Scalehouse</p>
        <h1 className="mt-2 font-display text-4xl text-ink">{label}</h1>
      </div>
    </main>
  );
}

export function LoginScreen() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (mode === "signup" && !name.trim()) {
      errs.name = "Full name is required.";
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    return errs;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setTimeout(() => scrollToFirstError(formRef.current), 40);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0],
          email: email.trim().toLowerCase(),
          password,
        });
        if (signUpError) {
          const msg = signUpError.message || "Could not create account.";
          setError(msg);
          if (/email/i.test(msg)) {
            setFieldErrors((prev) => ({ ...prev, email: msg }));
          } else if (/password/i.test(msg)) {
            setFieldErrors((prev) => ({ ...prev, password: msg }));
          }
          setLoading(false);
          setTimeout(() => scrollToFirstError(formRef.current), 40);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) {
          const msg = signInError.message || "Invalid email or password.";
          setError(msg);
          if (/email/i.test(msg)) {
            setFieldErrors((prev) => ({ ...prev, email: msg }));
          } else if (/password/i.test(msg)) {
            setFieldErrors((prev) => ({ ...prev, password: msg }));
          }
          setLoading(false);
          setTimeout(() => scrollToFirstError(formRef.current), 40);
          return;
        }
      }
      window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
      setLoading(false);
      setTimeout(() => scrollToFirstError(formRef.current), 40);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-2 lg:px-8">
        <div className="order-2 lg:order-1">
          <h1 className="max-w-xl font-display text-4xl leading-tight text-ink lg:text-5xl">
            Scalehouse Operations
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted leading-relaxed">
            Centralized weighbridge management, truck intake, and commodity tracking across all sister companies.
          </p>
          <ul className="mt-8 space-y-3.5 text-sm text-muted">
            <li className="flex items-center gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5 stroke-[2.5]" />
              </span>
              <span>Automated weighbridge gross and tare verification</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5 stroke-[2.5]" />
              </span>
              <span>Real-time truck queue, waybill, and inspection tracking</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5 stroke-[2.5]" />
              </span>
              <span>Unified commodity reporting across sister entities</span>
            </li>
          </ul>
        </div>

        <div className="order-1 rounded-lg border border-line bg-surface p-6 shadow-sm lg:order-2">
          <h2 className="font-display text-3xl">
            {mode === "signin" ? "Sign In" : "Register"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {mode === "signin"
              ? "Enter your staff email and password to access the scalehouse portal."
              : "Create an account. The first registered staff member becomes the yard administrator."}
          </p>

          <div className="mt-6 flex border-b border-line">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setFieldErrors({});
              }}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === "signin"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setFieldErrors({});
              }}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === "signup"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Register Staff / Admin
            </button>
          </div>

          <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-accent">
                {error}
              </div>
            )}

            {mode === "signup" && (
              <Field label="Full Name" error={fieldErrors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  placeholder="e.g. Samuel Okyeame"
                  className={controlClass(Boolean(fieldErrors.name))}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </Field>
            )}

            <Field label="Email Address" error={fieldErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="you@company.com"
                className={controlClass(Boolean(fieldErrors.email))}
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </Field>

            <Field label="Password" error={fieldErrors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                placeholder="At least 8 characters"
                className={controlClass(Boolean(fieldErrors.password))}
                aria-invalid={Boolean(fieldErrors.password)}
              />
            </Field>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading
                ? "Processing…"
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-muted">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                variant="quiet"
                type="button"
                onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                className="w-full text-xs"
              >
                Continue with {provider.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

