import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Sidebar, MobileNav } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { useAuth } from "@/lib/auth";
import { canAccessPath } from "@/lib/role-access";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, primaryRole, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && primaryRole && !canAccessPath(primaryRole, pathname)) {
      navigate({ to: "/app" });
    }
  }, [loading, navigate, pathname, primaryRole, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!primaryRole) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <h1 className="font-display text-xl font-bold text-foreground">No role assigned</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This account is signed in, but it is not assigned as student, teacher, or admin. Contact
            an administrator to add the correct role.
          </p>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-5 pb-24 sm:px-5 lg:px-7 lg:py-6 lg:pb-8">
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
