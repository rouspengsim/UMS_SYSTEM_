import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as SupaUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "teacher" | "student";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
};

type AuthCtx = {
  user: SupaUser | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  primaryRole: Role | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ROLE_PRIORITY: Role[] = ["admin", "teacher", "student"];

function metadataRole(user: SupaUser | null): Role | null {
  const role = user?.user_metadata?.role;
  return role === "admin" || role === "teacher" || role === "student" ? role : null;
}

function uniqueRoles(values: Array<Role | null | undefined>) {
  return ROLE_PRIORITY.filter((role) => values.includes(role));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadAuxData = async (uid: string, fallbackRole: Role | null = null) => {
    const [profileResult, rolesResult, studentResult, teacherResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("students").select("id").eq("user_id", uid).maybeSingle(),
      supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle(),
    ]);

    const loadedRoles =
      rolesResult.error || !rolesResult.data
        ? []
        : ((rolesResult.data ?? []) as { role: Role }[]).map((r) => r.role);
    const derivedRoles = uniqueRoles([
      ...loadedRoles,
      fallbackRole,
      studentResult.error || !studentResult.data ? null : "student",
      teacherResult.error || !teacherResult.data ? null : "teacher",
    ]);

    setProfile(profileResult.error ? null : ((profileResult.data as Profile | null) ?? null));
    setRoles(derivedRoles);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setIsDemo(false);
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      await loadAuxData(data.session.user.id, metadataRole(data.session.user));
    } else {
      setProfile(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setIsDemo(false);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => {
          loadAuxData(newSession.user.id, metadataRole(newSession.user));
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // Then fetch existing session
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadAuxData(data.session.user.id, metadataRole(data.session.user));
        }
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
        setLoading(false);
      });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setIsDemo(false);
  };

  const requestedRole = metadataRole(user);
  const primaryRole =
    (requestedRole && roles.includes(requestedRole) ? requestedRole : null) ??
    ROLE_PRIORITY.find((r) => roles.includes(r)) ??
    null;

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        primaryRole,
        loading,
        isDemo,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
