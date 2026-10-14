import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Boot, LoginScreen } from "@/components/login-screen";
import { Shell } from "@/components/shell";
import { useYard, YardProvider } from "@/components/yard-provider";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Boot />;
  if (!user) return <LoginScreen />;
  return (
    <YardProvider user={user}>
      <Authed />
    </YardProvider>
  );
}

function Authed() {
  const { workspace, loading, error, reload } = useYard();
  if (error?.includes("Unauthorized")) return <LoginScreen />;
  if (workspace?.gate === "pending") {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-6">
        <div className="max-w-md">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">JNI Scalehouse</p>
          <h1 className="mt-2 font-display text-4xl">Waiting to be admitted</h1>
          <p className="mt-3 text-muted">
            {workspace.me.displayName || workspace.me.email || "This account"} is signed in, but an admin
            still has to put you on Floor, Procurement, or Executive.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={reload}>Check again</Button>
            <UserButton />
          </div>
        </div>
      </main>
    );
  }
  if (!workspace || workspace.gate !== "open") {
    if (error) {
      return (
        <main className="grid min-h-screen place-items-center bg-bg px-6">
          <div className="max-w-md">
            <h1 className="font-display text-4xl">The yard did not open</h1>
            <p className="mt-3 text-muted">{error}</p>
            <Button className="mt-6" onClick={reload}>
              Try again
            </Button>
          </div>
        </main>
      );
    }
    return <Boot label={loading ? "Opening the master log…" : "Opening the yard…"} />;
  }
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
