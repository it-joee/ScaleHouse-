import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Boot, LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Boot />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
