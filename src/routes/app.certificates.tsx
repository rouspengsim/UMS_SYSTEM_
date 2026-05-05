import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Award, Plus, Loader2, X, QrCode } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RULE" }] }),
  component: CertificatesPage,
});

type CertificateRow = {
  id: string;
  kind: string;
  title: string;
  issue_date: string;
  verification_code: string;
  status: string;
  students: { full_name: string } | null;
};

const DEMO_CERTIFICATES_KEY = "studentsphere.demo.certificates";

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemoCertificates(certs: CertificateRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_CERTIFICATES_KEY, JSON.stringify(certs));
}

function CertificatesPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const isAdmin = primaryRole === "admin";

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoList<CertificateRow>(DEMO_CERTIFICATES_KEY);

      const { data } = await supabase
        .from("certificates")
        .select("id,kind,title,issue_date,verification_code,status,students(full_name)")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as CertificateRow[];
    },
  });

  return (
    <div>
      <PageHeader
        title={t("certificates")}
        subtitle="Issued and verifiable"
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> Issue certificate
            </button>
          )
        }
      />
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : certs.length === 0 ? (
        <SectionCard>
          <div className="py-10 text-center">
            <Award className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No certificates issued yet.</p>
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success capitalize">
                  {c.status}
                </span>
              </div>
              <p className="mt-4 font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.students?.full_name ?? "—"}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <QrCode className="h-3 w-3" />
                <span className="truncate font-mono">{c.verification_code.slice(0, 16)}…</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Issued {c.issue_date}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <IssueCert
          isDemo={isDemo}
          onClose={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["certificates", isDemo ? "demo" : "remote"] });
          }}
        />
      )}
    </div>
  );
}

function IssueCert({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    student_id: "",
    title: "",
    kind: "completion" as "completion" | "graduation" | "award" | "participation",
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-min-certificates", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<{
          id: string;
          full_name: string;
          full_name_en?: string | null;
        }>("studentsphere.demo.students").map((s) => ({
          id: s.id,
          full_name: s.full_name_en || s.full_name,
        }));
      }

      const { data } = await supabase.from("students").select("id,full_name").order("full_name");
      return data ?? [];
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const student = students.find((s) => s.id === f.student_id);
        writeDemoCertificates([
          {
            id: `demo-cert-${Date.now()}`,
            kind: f.kind,
            title: f.title,
            issue_date: new Date().toISOString().slice(0, 10),
            verification_code: `DEMO-${Date.now()}`,
            status: "issued",
            students: student ? { full_name: student.full_name } : null,
          },
          ...readDemoList<CertificateRow>(DEMO_CERTIFICATES_KEY),
        ]);
        return;
      }

      const { error } = await supabase
        .from("certificates")
        .insert({ student_id: f.student_id, title: f.title, kind: f.kind });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isDemo ? "Demo certificate issued" : "Certificate issued");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Issue certificate</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.student_id || !f.title) return toast.error("All fields required");
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Student *
            </label>
            <select
              value={f.student_id}
              onChange={(e) => setF({ ...f, student_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">— Select —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title *
            </label>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="e.g. Course Completion: Mathematics 101"
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </label>
            <select
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="completion">Completion</option>
              <option value="graduation">Graduation</option>
              <option value="award">Award</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue"}
          </button>
        </form>
      </div>
    </div>
  );
}
