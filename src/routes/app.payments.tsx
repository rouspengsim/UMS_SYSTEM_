import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard, StatusPill } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { UNIVERSITY_FULL_NAME, UNIVERSITY_SHORT_NAME } from "@/lib/brand";
import {
  Plus,
  Loader2,
  X,
  DollarSign,
  Wallet,
  AlertTriangle,
  QrCode,
  ReceiptText,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/payments")({
  head: () => ({ meta: [{ title: "Payments — RULE" }] }),
  component: PaymentsPage,
});

type PaymentRow = {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  method: string | null;
  description: string | null;
  students: { full_name: string } | null;
};

type PaymentStudent = {
  id: string;
  student_code: string;
  full_name: string;
  full_name_en?: string | null;
  full_name_km?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  major?: string | null;
  class_name?: string | null;
  shift?: string | null;
  enrollment_year?: number | null;
  status?: string | null;
};

const DEMO_PAYMENTS_KEY = "studentsphere.demo.payments";

function readDemoPayments(): PaymentRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_PAYMENTS_KEY);
    return raw ? (JSON.parse(raw) as PaymentRow[]) : [];
  } catch {
    return [];
  }
}

function writeDemoPayments(payments: PaymentRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(payments));
}

function readDemoStudentsMin(): PaymentStudent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("studentsphere.demo.students");
    const students = raw ? (JSON.parse(raw) as PaymentStudent[]) : [];
    return students.map((student) => ({
      id: student.id,
      student_code: student.student_code,
      full_name: student.full_name_en || student.full_name,
      full_name_en: student.full_name_en,
      full_name_km: student.full_name_km,
      email: student.email,
      phone: student.phone,
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      address: student.address,
      major: student.major,
      class_name: student.class_name,
      shift: student.shift,
      enrollment_year: student.enrollment_year,
      status: student.status,
    }));
  } catch {
    return [];
  }
}

function PaymentsPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [qrPayment, setQrPayment] = useState<PaymentRow | null>(null);
  const isAdmin = primaryRole === "admin";

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoPayments();

      const { data, error } = await supabase
        .from("payments")
        .select(
          "id,invoice_number,amount,due_date,paid_date,status,method,description,students(full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
  });

  const stats = useMemo(() => {
    const paid = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pending = payments
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + Number(p.amount), 0);
    const overdue = payments
      .filter((p) => p.status === "overdue")
      .reduce((s, p) => s + Number(p.amount), 0);
    return { paid, pending, overdue };
  }, [payments]);

  const markPaid = useMutation({
    mutationFn: async ({ id, method }: { id: string; method?: "cash" | "mobile" }) => {
      if (isDemo) {
        writeDemoPayments(
          readDemoPayments().map((payment) =>
            payment.id === id
              ? {
                  ...payment,
                  status: "paid",
                  method: method ?? payment.method,
                  paid_date: new Date().toISOString().slice(0, 10),
                }
              : payment,
          ),
        );
        return;
      }

      const { error } = await supabase
        .from("payments")
        .update({
          status: "paid",
          method: method ?? "cash",
          paid_date: new Date().toISOString().slice(0, 10),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["payments", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recent-payments"] });
      const paidPayment = payments.find((payment) => payment.id === variables.id);
      toast.success("Marked paid");
      setQrPayment(null);
      if (paidPayment) {
        printReceipt({
          ...paidPayment,
          status: "paid",
          method: variables.method ?? paidPayment.method ?? "cash",
          paid_date: new Date().toISOString().slice(0, 10),
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("payments")}
        subtitle="Invoices, dues and revenue tracking"
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> Create invoice
            </button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Paid"
          value={`$${stats.paid.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Pending"
          value={`$${stats.pending.toLocaleString()}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Overdue"
          value={`$${stats.overdue.toLocaleString()}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="info"
        />
      </div>
      <StudentPaymentPanel
        isDemo={isDemo}
        onCreated={(payment) => {
          qc.invalidateQueries({ queryKey: ["payments", isDemo ? "demo" : "remote"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          setQrPayment(payment);
        }}
      />
      <SectionCard className="mt-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No payments yet.</p>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-semibold text-info-foreground"
              >
                <QrCode className="h-3.5 w-3.5" /> Create KH QR invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">Invoice</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Due</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Payment option</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-3 pr-4 font-mono text-xs">{p.invoice_number}</td>
                    <td className="py-3 pr-4 font-medium">{p.students?.full_name ?? "—"}</td>
                    <td className="py-3 pr-4 font-semibold">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{p.due_date ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {p.status === "paid" && (
                          <button
                            onClick={() => printReceipt(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                          >
                            <ReceiptText className="h-3.5 w-3.5" /> Receipt
                          </button>
                        )}
                        {p.status !== "paid" && (
                          <button
                            onClick={() => setQrPayment(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-semibold text-info-foreground shadow-soft hover:bg-info/90"
                          >
                            <QrCode className="h-3.5 w-3.5" /> Pay KH QR
                          </button>
                        )}
                        {isAdmin && p.status !== "paid" && (
                          <button
                            onClick={() => markPaid.mutate({ id: p.id, method: "cash" })}
                            className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/20"
                          >
                            Mark paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      {showAdd && <AddPayment isDemo={isDemo} onClose={() => setShowAdd(false)} />}
      {qrPayment && (
        <KhQrPaymentModal
          payment={qrPayment}
          isConfirming={markPaid.isPending}
          onClose={() => setQrPayment(null)}
          onConfirm={() => markPaid.mutate({ id: qrPayment.id, method: "mobile" })}
        />
      )}
    </div>
  );
}

function formatUsd(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function khQrPayload(payment: PaymentRow) {
  return [
    "KHQR",
    UNIVERSITY_SHORT_NAME,
    payment.invoice_number,
    formatUsd(payment.amount),
    payment.students?.full_name ?? "Student",
  ].join("|");
}

function KhQrCode({ payment, className = "" }: { payment: PaymentRow; className?: string }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(khQrPayload(payment), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl("");
      });

    return () => {
      active = false;
    };
  }, [payment]);

  return (
    <div
      aria-label={`KH QR for ${payment.invoice_number}`}
      className={`flex aspect-square items-center justify-center bg-white p-3 ${className}`}
    >
      {qrUrl ? (
        <img src={qrUrl} alt={`KH QR for invoice ${payment.invoice_number}`} className="h-full w-full" />
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

function printReceipt(payment: PaymentRow) {
  const printWindow = window.open("", "_blank", "width=720,height=900");
  if (!printWindow) {
    toast.error("Allow pop-ups to create the receipt PDF.");
    return;
  }

  const studentName = escapeHtml(payment.students?.full_name ?? "Student");
  const description = escapeHtml(payment.description ?? "Tuition payment");
  const method = payment.method === "mobile" ? "KH QR" : payment.method ?? "Cash";
  const paidDate = payment.paid_date ?? new Date().toISOString().slice(0, 10);

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receipt ${escapeHtml(payment.invoice_number)}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          .receipt { border: 1px solid #d1d5db; padding: 28px; }
          .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
          h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
          .school { margin-top: 6px; font-size: 13px; color: #4b5563; }
          .badge { display: inline-block; border: 1px solid #16a34a; color: #15803d; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
          .meta { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .box { border: 1px solid #e5e7eb; padding: 14px; min-height: 72px; }
          .label { margin-bottom: 6px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
          .value { font-size: 15px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th { text-align: left; background: #f3f4f6; font-size: 12px; color: #374151; }
          th, td { padding: 12px; border: 1px solid #e5e7eb; }
          .total { margin-top: 18px; display: flex; justify-content: flex-end; }
          .total-box { min-width: 240px; border: 1px solid #111827; padding: 14px; }
          .amount { font-size: 26px; font-weight: 800; text-align: right; }
          .footer { margin-top: 36px; display: flex; justify-content: space-between; gap: 32px; color: #6b7280; font-size: 12px; }
          .sign { width: 220px; border-top: 1px solid #111827; padding-top: 8px; text-align: center; color: #111827; }
          .no-print { margin-bottom: 16px; display: flex; justify-content: flex-end; }
          button { border: 0; background: #111827; color: #fff; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print"><button onclick="window.print()">Save as PDF / Print</button></div>
        <main class="receipt">
          <section class="top">
            <div>
              <h1>Payment Receipt</h1>
              <div class="school">${escapeHtml(UNIVERSITY_FULL_NAME)}</div>
            </div>
            <div>
              <div class="badge">PAID</div>
              <div class="school">Receipt: ${escapeHtml(payment.invoice_number)}</div>
            </div>
          </section>
          <section class="meta">
            <div class="box"><div class="label">Student</div><div class="value">${studentName}</div></div>
            <div class="box"><div class="label">Paid Date</div><div class="value">${escapeHtml(paidDate)}</div></div>
            <div class="box"><div class="label">Payment Method</div><div class="value">${escapeHtml(method)}</div></div>
            <div class="box"><div class="label">Invoice</div><div class="value">${escapeHtml(payment.invoice_number)}</div></div>
          </section>
          <table>
            <thead><tr><th>Description</th><th style="width: 160px; text-align: right;">Amount</th></tr></thead>
            <tbody><tr><td>${description}</td><td style="text-align: right; font-weight: 700;">${formatUsd(payment.amount)}</td></tr></tbody>
          </table>
          <section class="total">
            <div class="total-box">
              <div class="label">Total Paid</div>
              <div class="amount">${formatUsd(payment.amount)}</div>
            </div>
          </section>
          <section class="footer">
            <div>Generated on ${escapeHtml(new Date().toLocaleString())}</div>
            <div class="sign">Authorized Signature</div>
          </section>
        </main>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function KhQrPaymentModal({
  payment,
  isConfirming,
  onClose,
  onConfirm,
}: {
  payment: PaymentRow;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">Pay by KH QR</h3>
            <p className="mt-1 text-xs text-muted-foreground">{payment.invoice_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">KHQR</div>
            <KhQrCode payment={payment} />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pay to</p>
              <p className="mt-1 font-semibold">{UNIVERSITY_SHORT_NAME}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</p>
              <p className="mt-1 font-semibold">{payment.students?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="mt-1 text-2xl font-bold">{formatUsd(payment.amount)}</p>
            </div>
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
              Scan this KH QR in your banking app. After the transfer is complete, confirm payment
              to mark the invoice paid and create the receipt PDF.
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-success-foreground disabled:opacity-60"
          >
            {isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Paid, create receipt
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentInfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{label}: </span>
      <span>{value || "-"}</span>
    </div>
  );
}

function StudentPaymentPanel({
  isDemo,
  onCreated,
}: {
  isDemo: boolean;
  onCreated: (payment: PaymentRow) => void;
}) {
  const [studentCode, setStudentCode] = useState("");
  const [form, setForm] = useState({ amount: 0, due_date: "", description: "" });
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-payment-lookup", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoStudentsMin();

      const { data } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_en,full_name_km,email,phone,date_of_birth,gender,address,major,class_name,shift,enrollment_year,status",
        )
        .order("student_code");
      return (data ?? []) as PaymentStudent[];
    },
  });
  const selectedStudent = useMemo(() => {
    const normalized = studentCode.trim().toLowerCase();
    if (!normalized) return null;
    return students.find((student) => student.student_code.toLowerCase() === normalized) ?? null;
  }, [studentCode, students]);
  const showMissingStudent = studentCode.trim().length > 0 && !selectedStudent && !isLoading;

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error("Enter a valid Student ID");
      if (!form.amount) throw new Error("Amount required");

      const invoiceNumber = `INV-${Date.now().toString().slice(-7)}`;
      const payment: PaymentRow = {
        id: `demo-payment-${Date.now()}`,
        invoice_number: invoiceNumber,
        amount: Number(form.amount),
        due_date: form.due_date || null,
        paid_date: null,
        status: "pending",
        method: null,
        description: form.description || null,
        students: { full_name: selectedStudent.full_name_en || selectedStudent.full_name },
      };

      if (isDemo) {
        writeDemoPayments([payment, ...readDemoPayments()]);
        return payment;
      }

      const { data, error } = await supabase
        .from("payments")
        .insert({
          student_id: selectedStudent.id,
          invoice_number: invoiceNumber,
          amount: Number(form.amount),
          due_date: form.due_date || null,
          description: form.description || null,
          status: "pending",
        })
        .select("id,invoice_number,amount,due_date,paid_date,status,method,description,students(full_name)")
        .single();
      if (error) throw error;
      return data as unknown as PaymentRow;
    },
    onSuccess: (payment) => {
      toast.success(isDemo ? "Demo KH QR ready" : "KH QR ready");
      onCreated(payment);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SectionCard className="mt-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(360px,1.2fr)_minmax(300px,1fr)]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Student ID
          </label>
          <input
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            placeholder="RULE-007"
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-primary"
          />
          {isLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading students
            </div>
          )}
          {showMissingStudent && (
            <p className="mt-2 text-xs font-medium text-destructive">
              No student found for {studentCode.trim()}.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          {selectedStudent ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-info">
                    {selectedStudent.student_code}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">
                    {selectedStudent.full_name_en || selectedStudent.full_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.full_name_km || "Khmer name not set"}
                  </p>
                </div>
                {selectedStudent.status && <StatusPill status={selectedStudent.status} />}
              </div>
              <div className="mt-4 grid gap-x-4 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
                <StudentInfoLine label="Class" value={selectedStudent.class_name} />
                <StudentInfoLine label="Major" value={selectedStudent.major} />
                <StudentInfoLine label="Shift" value={selectedStudent.shift} />
                <StudentInfoLine label="Gender" value={selectedStudent.gender} />
                <StudentInfoLine label="Date of birth" value={selectedStudent.date_of_birth} />
                <StudentInfoLine label="Year" value={selectedStudent.enrollment_year?.toString()} />
                <StudentInfoLine label="Phone" value={selectedStudent.phone} />
                <StudentInfoLine label="Email" value={selectedStudent.email} />
                <div className="sm:col-span-2">
                  <StudentInfoLine label="Address" value={selectedStudent.address} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              Enter Student ID
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPayment.mutate();
          }}
          className="rounded-xl border border-info/30 bg-info/10 p-4"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment form
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Due date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={createPayment.isPending || !selectedStudent}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-info text-sm font-semibold text-info-foreground shadow-soft disabled:opacity-50"
            >
              {createPayment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              Pay by KH QR
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

function AddPayment({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ student_code: "", amount: 0, due_date: "", description: "" });
  const { data: students = [] } = useQuery({
    queryKey: ["students-min", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoStudentsMin();

      const { data } = await supabase
        .from("students")
        .select("id,student_code,full_name,full_name_en,full_name_km,email,phone,major,class_name,shift,status")
        .order("student_code");
      return (data ?? []) as PaymentStudent[];
    },
  });
  const selectedStudent = useMemo(() => {
    const code = f.student_code.trim().toLowerCase();
    if (!code) return null;
    return students.find((student) => student.student_code.toLowerCase() === code) ?? null;
  }, [f.student_code, students]);
  const showMissingStudent = f.student_code.trim().length > 0 && !selectedStudent;
  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const newPayment: PaymentRow = {
          id: `demo-payment-${Date.now()}`,
          invoice_number: `INV-${Date.now().toString().slice(-7)}`,
          amount: Number(f.amount),
          due_date: f.due_date || null,
          paid_date: null,
          status: "pending",
          method: null,
          description: f.description || null,
          students: selectedStudent ? { full_name: selectedStudent.full_name } : null,
        };
        writeDemoPayments([newPayment, ...readDemoPayments()]);
        return;
      }

      const { error } = await supabase
        .from("payments")
        .insert({
          student_id: selectedStudent!.id,
          invoice_number: `INV-${Date.now().toString().slice(-7)}`,
          amount: Number(f.amount),
          due_date: f.due_date || null,
          description: f.description || null,
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(isDemo ? "Demo invoice created" : "Invoice created");
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
          <h3 className="font-display text-lg font-bold">Create invoice</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedStudent) return toast.error("Enter a valid Student ID");
            if (!f.amount) return toast.error("Amount required");
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Student ID *
            </label>
            <input
              value={f.student_code}
              onChange={(e) => setF({ ...f, student_code: e.target.value })}
              placeholder="RULE-007"
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            {showMissingStudent && (
              <p className="mt-1 text-xs font-medium text-destructive">
                No student found for {f.student_code.trim()}.
              </p>
            )}
          </div>
          {selectedStudent && (
            <div className="rounded-xl border border-info/30 bg-info/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-info">
                    {selectedStudent.student_code}
                  </p>
                  <p className="mt-1 text-base font-bold">
                    {selectedStudent.full_name_en || selectedStudent.full_name}
                  </p>
                  {selectedStudent.full_name_km && (
                    <p className="text-sm text-muted-foreground">{selectedStudent.full_name_km}</p>
                  )}
                </div>
                {selectedStudent.status && <StatusPill status={selectedStudent.status} />}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <StudentInfoLine label="Class" value={selectedStudent.class_name} />
                <StudentInfoLine label="Major" value={selectedStudent.major} />
                <StudentInfoLine label="Shift" value={selectedStudent.shift} />
                <StudentInfoLine label="Phone" value={selectedStudent.phone} />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Due date
            </label>
            <input
              type="date"
              value={f.due_date}
              onChange={(e) => setF({ ...f, due_date: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invoice"}
          </button>
        </form>
      </div>
    </div>
  );
}
