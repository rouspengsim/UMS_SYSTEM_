import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SUBJECT_OPTIONS,
  readDemoSubjects,
  type SubjectRecord,
  writeDemoSubjects,
} from "@/lib/subjects";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/subjects")({
  head: () => ({ meta: [{ title: "Subjects — RULE" }] }),
  component: SubjectsPage,
});

type SubjectFormState = {
  subject_id: string;
  subject_name: string;
  description: string;
};

const emptyForm: SubjectFormState = {
  subject_id: "",
  subject_name: "",
  description: "",
};

function normalizeSubjectId(value: string) {
  return value.trim().replace(/\s+/g, "_");
}

function SubjectsPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SubjectRecord | null>(null);
  const [query, setQuery] = useState("");
  const isAdmin = primaryRole === "admin";

  const queryKey = ["subjects", isDemo ? "demo" : "remote"];
  const { data: subjects = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (isDemo) return readDemoSubjects();

      const { data, error } = await supabase
        .from("subjects")
        .select("id,subject_id,subject_name,description,created_at,updated_at")
        .order("subject_id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SubjectRecord[];
    },
  });

  const filteredSubjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return subjects;
    return subjects.filter((subject) =>
      [subject.subject_id, subject.subject_name, subject.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, subjects]);

  const del = useMutation({
    mutationFn: async (subject: SubjectRecord) => {
      if (isDemo) {
        writeDemoSubjects(readDemoSubjects().filter((item) => item.id !== subject.id));
        return;
      }

      const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["subject-options"] });
      toast.success(t("subject_deleted"));
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader
        title={t("subjects")}
        subtitle={t("subjects_subtitle")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("add_subject")}
            </button>
          )
        }
      />

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block min-w-64 flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("search")}
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search_subjects")}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <p className="text-xs font-medium text-muted-foreground">
            {filteredSubjects.length} {t("subjects").toLowerCase()}
          </p>
        </div>
      </SectionCard>

      <SectionCard>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{t("no_subjects_yet")}</p>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_subject")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-16 py-3 pr-4">{t("id")}</th>
                  <th className="py-3 pr-4">{t("subject_id")}</th>
                  <th className="py-3 pr-4">{t("subject_name")}</th>
                  <th className="py-3 pr-4">{t("description")}</th>
                  {isAdmin && <th className="w-28 py-3 pr-4 text-right">{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((subject, index) => (
                  <tr key={subject.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">
                      {subject.subject_id}
                    </td>
                    <td className="py-3 pr-4 font-semibold">{subject.subject_name}</td>
                    <td className="max-w-md py-3 pr-4 text-xs text-muted-foreground">
                      <span className="line-clamp-2">{subject.description || "-"}</span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditing(subject)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                            aria-label={`${t("edit")} ${subject.subject_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${t("delete")} ${subject.subject_name}?`)) {
                                del.mutate(subject);
                              }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                            aria-label={`${t("delete")} ${subject.subject_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showAdd && (
        <SubjectForm
          isDemo={isDemo}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey });
            qc.invalidateQueries({ queryKey: ["subject-options"] });
          }}
        />
      )}
      {editing && (
        <SubjectForm
          isDemo={isDemo}
          subject={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey });
            qc.invalidateQueries({ queryKey: ["subject-options"] });
          }}
        />
      )}
    </div>
  );
}

function SubjectForm({
  isDemo,
  subject,
  onClose,
  onSaved,
}: {
  isDemo: boolean;
  subject?: SubjectRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!subject;
  const [f, setF] = useState<SubjectFormState>(
    subject
      ? {
          subject_id: subject.subject_id,
          subject_name: subject.subject_name,
          description: subject.description ?? "",
        }
      : emptyForm,
  );

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        subject_id: normalizeSubjectId(f.subject_id),
        subject_name: f.subject_name.trim(),
        description: f.description.trim() || null,
      };

      if (isDemo) {
        const current = readDemoSubjects();
        if (isEdit && subject) {
          writeDemoSubjects(
            current.map((item) => (item.id === subject.id ? { ...item, ...payload } : item)),
          );
          return;
        }

        const exists = current.some((item) => item.subject_id === payload.subject_id);
        if (exists) throw new Error(t("subject_id_exists"));
        writeDemoSubjects([
          {
            id: `demo-subject-${Date.now()}`,
            ...payload,
          },
          ...current,
        ]);
        return;
      }

      if (isEdit && subject) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", subject.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("subjects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      toast.success(isEdit ? t("subject_updated") : t("subject_created"));
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {isEdit ? t("edit_subject") : t("add_subject")}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!normalizeSubjectId(f.subject_id) || !f.subject_name.trim()) {
              return toast.error(`${t("subject_id")} & ${t("subject_name")}`);
            }
            mut.mutate();
          }}
          className="space-y-3"
        >
          <Field label={`${t("subject_id")} *`}>
            <input
              value={f.subject_id}
              onChange={(event) => setF({ ...f, subject_id: event.target.value })}
              placeholder={DEFAULT_SUBJECT_OPTIONS[0]?.code}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={`${t("subject_name")} *`}>
            <input
              value={f.subject_name}
              onChange={(event) => setF({ ...f, subject_name: event.target.value })}
              placeholder={DEFAULT_SUBJECT_OPTIONS[0]?.label}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("description")}>
            <textarea
              value={f.description}
              onChange={(event) => setF({ ...f, description: event.target.value })}
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save_subject")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
