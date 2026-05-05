import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { Users, Wallet, CalendarCheck, FileBarChart, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — RULE" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [students, classes, payments, attendance] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount,status"),
        supabase.from("attendance").select("status"),
      ]);
      const revenue = (payments.data ?? [])
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalAtt = (attendance.data ?? []).length;
      const present = (attendance.data ?? []).filter(
        (a) => a.status === "present" || a.status === "late",
      ).length;
      const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;
      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        revenue,
        attendanceRate: rate,
      };
    },
  });

  return (
    <div>
      <PageHeader title={t("reports")} subtitle="Aggregate insights from live data" />
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total students"
              value={data?.students ?? 0}
              icon={<Users className="h-5 w-5" />}
              tone="primary"
            />
            <StatCard
              label="Active classes"
              value={data?.classes ?? 0}
              icon={<FileBarChart className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              label="Revenue (paid)"
              value={`$${(data?.revenue ?? 0).toLocaleString()}`}
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Attendance rate"
              value={`${data?.attendanceRate ?? 0}%`}
              icon={<CalendarCheck className="h-5 w-5" />}
              tone="warning"
            />
          </div>
          <SectionCard className="mt-6">
            <p className="py-6 text-center text-sm text-muted-foreground">
              More charts and exports coming soon. Numbers above are computed from your live
              database.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
