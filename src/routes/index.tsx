import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight, Mail, Lock, Loader2 } from "lucide-react";
import {
  UNIVERSITY_FULL_NAME,
  UNIVERSITY_LOGO_URL,
  UNIVERSITY_NAME_EN,
  UNIVERSITY_SHORT_NAME,
} from "@/lib/brand";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const HERO_IMAGES = [
  "https://ddprule.org/wp-content/uploads/2023/07/AB6A0964-scaled.jpg",
  "https://ddprule.org/wp-content/uploads/2020/06/law1-1.jpg",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Sign in — ${UNIVERSITY_SHORT_NAME}` },
      {
        name: "description",
        content: `Sign in to ${UNIVERSITY_NAME_EN}.`,
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Extract<Role, "student" | "teacher">>("student");
  const [busy, setBusy] = useState(false);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const heroLineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const heroImageRefs = useRef<(HTMLImageElement | null)[]>([]);

  // If already signed in, go to /app
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/app" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!heroCopyRef.current) return;

    const ctx = gsap.context(() => {
      const lines = heroLineRefs.current.filter((line): line is HTMLSpanElement => !!line);
      if (!lines.length) return;

      gsap.set(lines, {
        clipPath: "inset(0 100% 0 0)",
        y: 24,
        opacity: 0,
        backgroundPosition: "0% 50%",
      });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });

      lines.forEach((line, index) => {
        tl.to(
          line,
          {
            clipPath: "inset(0 0% 0 0)",
            y: 0,
            opacity: 1,
            duration: 1.15,
            ease: "power3.out",
          },
          index === 0 ? 0 : "+=0.08",
        ).to(
          line,
          {
            backgroundPosition: "100% 50%",
            duration: 1.4,
            ease: "none",
          },
          "<",
        );
      });

      tl.to(
        lines,
        {
          y: -18,
          opacity: 0,
          clipPath: "inset(0 0% 100% 0)",
          duration: 0.7,
          ease: "power2.in",
          stagger: 0.08,
        },
        "+=1.1",
      );
    }, heroCopyRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const images = heroImageRefs.current.filter((image): image is HTMLImageElement => !!image);
    if (images.length < 2) return;

    const ctx = gsap.context(() => {
      gsap.set(images, { scale: 1.04 });
      gsap.set(images[0], { autoAlpha: 1 });
      gsap.set(images.slice(1), { autoAlpha: 0 });

      const tl = gsap.timeline({ repeat: -1 });

      images.forEach((image, index) => {
        const nextImage = images[(index + 1) % images.length];

        tl.to(
          image,
          {
            scale: 1.1,
            duration: 6,
            ease: "none",
          },
          index === 0 ? 0 : "<",
        )
          .to(
            nextImage,
            {
              autoAlpha: 1,
              duration: 1.4,
              ease: "power2.inOut",
            },
            ">-1.4",
          )
          .set(image, { autoAlpha: 0, scale: 1.04 });
      });
    });

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName || email.split("@")[0], role: selectedRole },
          },
        });
        if (error) throw error;

        const signedUpUser = data.user;
        if (signedUpUser) {
          const { data: existingRoles, error: rolesReadError } = await supabase
            .from("user_roles")
            .select("id")
            .eq("user_id", signedUpUser.id)
            .limit(1);

          if (rolesReadError) throw rolesReadError;

          if (!existingRoles?.length) {
            const { error: roleInsertError } = await supabase
              .from("user_roles")
              .insert({ user_id: signedUpUser.id, role: selectedRole });

            if (roleInsertError) throw roleInsertError;
          }
        }

        toast.success("Account created! Signing you in…");
        // Auto-confirm enabled — session should be live
        await refresh();
        await router.invalidate();
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        await refresh();
        await router.invalidate();
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/app`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        await refresh();
        await router.invalidate();
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex w-1/2 flex-col justify-between overflow-hidden gradient-primary p-12 text-primary-foreground">
        {HERO_IMAGES.map((src, index) => (
          <img
            key={src}
            ref={(el) => {
              heroImageRefs.current[index] = el;
            }}
            src={src}
            alt="Royal University of Law and Economics campus"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-0"
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.28_0.12_262_/_0.42),oklch(0.48_0.16_280_/_0.28))]" />
        <div className="absolute inset-0 bg-grid opacity-[0.04]" />
        <div className="relative flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-soft">
            <img
              src={UNIVERSITY_LOGO_URL}
              alt="University logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold">{UNIVERSITY_SHORT_NAME}</p>
            <p className="text-[10px] tracking-wide opacity-80">{UNIVERSITY_NAME_EN}</p>
          </div>
        </div>

        <motion.div
          ref={heroCopyRef}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="relative space-y-4"
        >
          <h1 className="login-hero-title font-display text-4xl font-bold leading-tight">
            <span
              ref={(el) => {
                heroLineRefs.current[0] = el;
              }}
              className="login-hero-line"
            >
              សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្ត្រ
            </span>
            <span
              ref={(el) => {
                heroLineRefs.current[1] = el;
              }}
              className="login-hero-line"
            >
              និងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.45 }}
            className="max-w-md text-sm opacity-85"
          >
            ប្រព័ន្ធឌីជីថលសម្រាប់គ្រប់គ្រងសាកលវិទ្យាល័យ
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.58 }}
            className="flex flex-wrap gap-2 pt-4"
          >
            {["Students", "Attendance", "Payments", "Exams", "Certificates"].map((c) => (
              <span key={c} className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                {c}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.72 }}
          className="relative grid grid-cols-3 gap-3 text-xs"
        >
          {[
            { k: "12", v: "Modules" },
            { k: "Real-time", v: "Database" },
            { k: "Secure", v: "RLS auth" },
          ].map((s) => (
            <div key={s.v} className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="font-display text-lg font-bold">{s.k}</p>
              <p className="opacity-75">{s.v}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        <button
          onClick={() => setLang(lang === "en" ? "km" : "en")}
          className="absolute right-6 top-6 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-muted"
        >
          {lang === "en" ? "ខ្មែរ" : "EN"}
        </button>

        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-surface p-1.5 shadow-soft ring-1 ring-border/70">
              <img
                src={UNIVERSITY_LOGO_URL}
                alt="University logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{UNIVERSITY_SHORT_NAME}</p>
              <p className="truncate text-xs text-muted-foreground">{UNIVERSITY_FULL_NAME}</p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight">
            {mode === "signin" ? t("welcome_back") : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? t("sign_in_to") : "First account becomes admin automatically."}
          </p>

          <div className="mt-6 inline-flex rounded-xl border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors " +
                (mode === "signin"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors " +
                (mode === "signup"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition-all focus:border-primary focus:shadow-soft"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Account type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "student", label: t("student") },
                      { value: "teacher", label: t("teacher") },
                    ] as const).map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={
                          "rounded-xl border px-4 py-3 text-sm font-semibold transition-all " +
                          (selectedRole === role.value
                            ? "border-primary bg-primary text-primary-foreground shadow-soft"
                            : "border-border bg-surface text-foreground hover:bg-muted")
                        }
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("email")}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3.5 text-sm outline-none transition-all focus:border-primary focus:shadow-soft"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("password")}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3.5 text-sm outline-none transition-all focus:border-primary focus:shadow-soft"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? t("sign_in") : "Create account"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={signInGoogle}
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
