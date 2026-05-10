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
  signInDemo: (role?: Role) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ROLE_PRIORITY: Role[] = ["admin", "teacher", "student"];
const DEMO_AUTH_KEY = "studentsphere.demo.auth";

function metadataRole(user: SupaUser | null): Role | null {
  const role = user?.user_metadata?.role;
  return role === "admin" || role === "teacher" || role === "student" ? role : null;
}

function createDemoUser(role: Role = "admin"): SupaUser {
  const email = role === "admin" ? "admin@gmail.com" : `${role}@demo.local`;
  return {
    id: `demo-${role}`,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "demo", providers: ["demo"] },
    user_metadata: { full_name: `Demo ${role[0].toUpperCase()}${role.slice(1)}`, role },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  } as SupaUser;
}

function createDemoProfile(role: Role = "admin"): Profile {
  return {
    id: `demo-profile-${role}`,
    user_id: `demo-${role}`,
    full_name: `Demo ${role[0].toUpperCase()}${role.slice(1)}`,
    email: role === "admin" ? "admin@gmail.com" : `${role}@demo.local`,
    avatar_url: null,
    phone: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const setDemoAuth = (role: Role = "admin") => {
    setSession(null);
    setUser(createDemoUser(role));
    setProfile(createDemoProfile(role));
    setRoles([role]);
    setIsDemo(true);
  };

  const loadAuxData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile | null) ?? null);
    setRoles(((roleRows ?? []) as { role: Role }[]).map((r) => r.role));
  };

  const refresh = async () => {
    const savedDemoRole =
      typeof window !== "undefined" ? (localStorage.getItem(DEMO_AUTH_KEY) as Role | null) : null;
    if (savedDemoRole === "admin" || savedDemoRole === "teacher" || savedDemoRole === "student") {
      setDemoAuth(savedDemoRole);
      return;
    }

    const { data } = await supabase.auth.getSession();
    setIsDemo(false);
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      await loadAuxData(data.session.user.id);
    } else {
      setProfile(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    const savedDemoRole =
      typeof window !== "undefined" ? (localStorage.getItem(DEMO_AUTH_KEY) as Role | null) : null;
    if (savedDemoRole === "admin" || savedDemoRole === "teacher" || savedDemoRole === "student") {
      setDemoAuth(savedDemoRole);
      setLoading(false);
      return;
    }

    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setIsDemo(false);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => {
          loadAuxData(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // Then fetch existing session
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadAuxData(data.session.user.id);
      }
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInDemo = async (role: Role = "admin") => {
    if (typeof window !== "undefined") localStorage.setItem(DEMO_AUTH_KEY, role);
    setDemoAuth(role);
  };

  const signOut = async () => {
    if (typeof window !== "undefined") localStorage.removeItem(DEMO_AUTH_KEY);
    if (!isDemo) await supabase.auth.signOut();
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
        signInDemo,
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
