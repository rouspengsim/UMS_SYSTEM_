import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import type { LoginRole } from "@/lib/account-ids";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight, GraduationCap, IdCard, Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import {
  authErrorMessage,
  roleDisplayName,
  signInWithRoleCredentials,
  verifySignedInRole,
} from "@/lib/login-auth";
import {
  UNIVERSITY_FULL_NAME,
  UNIVERSITY_HERO_IMAGES,
  UNIVERSITY_HERO_SUBTITLE,
  UNIVERSITY_LOGO_URL,
  UNIVERSITY_NAME_EN,
  UNIVERSITY_SHORT_NAME,
} from "@/lib/brand";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  component: PublicLoginPage,
});

function PublicLoginPage() {
  return <LoginPage portal="public" />;
}

export function LoginPage({ portal }: { portal: "public" | "admin" }) {
  const { t, lang, setLang } = useI18n();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isAdminPortal = portal === "admin";
  const [loginRole, setLoginRole] = useState<LoginRole>(isAdminPortal ? "admin" : "student");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Extract<Role, "student" | "teacher">>("student");
  const [busy, setBusy] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const heroLineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const heroImageRefs = useRef<(HTMLImageElement | null)[]>([]);

  const fieldClass =
    "h-11 w-full rounded-md border border-border bg-white/90 px-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:bg-white focus:shadow-[0_0_0_3px_oklch(0.86_0.14_88_/_0.24)]";
  const iconFieldClass =
    "h-11 w-full rounded-md border border-border bg-white/90 pl-9 pr-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:bg-white focus:shadow-[0_0_0_3px_oklch(0.86_0.14_88_/_0.24)]";

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
    if (Date.now() < lockedUntil) {
      const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${seconds} seconds.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const signupName = fullName || email.split("@")[0];
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: signupName, role: selectedRole },
          },
        });
        if (error) {
          throw error;
        }

        if (!data.session) {
          toast.success("Account created. Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }

        toast.success("Account created! Signing you in…");
        await refresh();
        await router.invalidate();
        navigate({ to: "/app" });
      } else {
        const expectedRole: LoginRole = isAdminPortal ? "admin" : loginRole;
        const { data, error } = await signInWithRoleCredentials(
          expectedRole,
          loginId,
          email,
          password,
        );
        if (error) {
          throw error;
        }
        if (!data.user?.id) {
          throw new Error("Signed in, but no user account was returned.");
        }

        await verifySignedInRole(data.user, expectedRole);

        setFailedAttempts(0);
        setLockedUntil(0);
        toast.success(`Welcome back, ${roleDisplayName(expectedRole)}!`);
        await refresh();
        await router.invalidate();
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      toast.error(authErrorMessage(err));
      if (mode === "signin") {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockedUntil(Date.now() + 60_000);
          setFailedAttempts(0);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex w-1/2 flex-col justify-between overflow-hidden gradient-primary p-12 text-primary-foreground">
        {UNIVERSITY_HERO_IMAGES.map((src, index) => (
          <img
            key={src}
            ref={(el) => {
              heroImageRefs.current[index] = el;
            }}
            src={src}
            alt={`${UNIVERSITY_NAME_EN} campus`}
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
            {UNIVERSITY_HERO_SUBTITLE}
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
      <div className="login-form-side relative flex w-full items-center justify-center p-5 sm:p-6 lg:w-1/2">
        <button
          onClick={() => setLang(lang === "en" ? "km" : "en")}
          className="absolute right-5 top-5 rounded-md border border-primary/15 bg-white/85 px-3 py-1 text-xs font-semibold text-primary shadow-soft backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground sm:right-6 sm:top-6"
        >
          {lang === "en" ? "ខ្មែរ" : "EN"}
        </button>

        <div className="login-form-shell w-full max-w-[460px] rounded-lg border border-primary/10 p-5 shadow-card sm:p-7">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-white p-1.5 shadow-soft ring-1 ring-accent/45">
              <img
                src={UNIVERSITY_LOGO_URL}
                alt="University logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold text-primary">{UNIVERSITY_SHORT_NAME}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {UNIVERSITY_FULL_NAME}
              </p>
            </div>
          </div>

          <div className="border-l-4 border-accent pl-4">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              {isAdminPortal ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <GraduationCap className="h-3.5 w-3.5" />
              )}
              {isAdminPortal ? "Administrator" : "Student Portal"}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {isAdminPortal
                ? t("admin_sign_in")
                : mode === "signin"
                  ? t("welcome_back")
                  : t("create_your_account")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {isAdminPortal
                ? t("admin_restricted_access")
                : mode === "signin"
                  ? t("use_issued_account")
                  : t("first_account_admin")}
            </p>
          </div>

          {!isAdminPortal && (
            <div className="mt-6 inline-flex rounded-md border border-primary/10 bg-white/80 p-1 shadow-soft">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={
                  "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors " +
                  (mode === "signin"
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t("sign_in")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signin" && !isAdminPortal && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("account_type")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "student", label: t("student") },
                      { value: "teacher", label: t("teacher") },
                    ] as const
                  ).map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setLoginRole(role.value)}
                      className={
                        "rounded-md border px-3 py-2.5 text-xs font-semibold transition-all " +
                        (loginRole === role.value
                          ? "border-primary bg-primary text-primary-foreground shadow-soft"
                          : "border-primary/10 bg-white/80 text-foreground hover:border-accent hover:bg-accent/10")
                      }
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Account type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: "student", label: t("student") },
                        { value: "teacher", label: t("teacher") },
                      ] as const
                    ).map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={
                          "rounded-md border px-4 py-3 text-sm font-semibold transition-all " +
                          (selectedRole === role.value
                            ? "border-primary bg-primary text-primary-foreground shadow-soft"
                            : "border-primary/10 bg-white/80 text-foreground hover:border-accent hover:bg-accent/10")
                        }
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {mode === "signin" && !isAdminPortal ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {loginRole === "student" ? t("student_id") : "Teacher ID"}
                </label>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setLoginId(nextValue.includes("@") ? nextValue : nextValue.toUpperCase());
                    }}
                    required
                    autoComplete="username"
                    className={iconFieldClass}
                  />
                </div>
              </div>
            ) : (
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
                    className={iconFieldClass}
                  />
                </div>
              </div>
            )}
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
                  className={iconFieldClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || Date.now() < lockedUntil}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-soft ring-1 ring-primary/20 transition-all hover:bg-primary/95 hover:shadow-glow disabled:opacity-60"
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

          <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">
            {isAdminPortal ? (
              <a href="/" className="font-semibold text-primary hover:underline">
                Return to student and teacher login
              </a>
            ) : (
              "Student and teacher accounts must be created by an admin before they can sign in."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
