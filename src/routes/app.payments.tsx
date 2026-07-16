import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard, StatusPill } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  UNIVERSITY_LOGO_URL,
  UNIVERSITY_NAME_EN,
  UNIVERSITY_NAME_KM,
  UNIVERSITY_SHORT_NAME,
  pageTitle,
} from "@/lib/brand";
import {
  Loader2,
  X,
  DollarSign,
  Wallet,
  AlertTriangle,
  QrCode,
  ReceiptText,
  CheckCircle2,
  CalendarDays,
  FileText,
  Search,
  UserRound,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tuitionRateForMajor } from "@/lib/tuition";

export const Route = createFileRoute("/app/payments")({
  head: () => ({ meta: [{ title: pageTitle("Payments") }] }),
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
  students: {
    full_name: string;
    full_name_en?: string | null;
    full_name_km?: string | null;
    student_code?: string | null;
    class_name?: string | null;
    major?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    address?: string | null;
    enrollment_year?: number | null;
    study_year?: number | null;
  } | null;
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
  study_year?: number | null;
  pay_year1?: string | null;
  pay_year2?: string | null;
  pay_year3?: string | null;
  pay_year4?: string | null;
  status?: string | null;
};

const DEMO_PAYMENTS_KEY = "studentsphere.demo.payments";
const PAYMENT_ROW_SELECT =
  "id,invoice_number,amount,due_date,paid_date,status,method,description,students(full_name,full_name_en,full_name_km,student_code,class_name,major,phone,date_of_birth,gender,address,enrollment_year,study_year)";

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
      study_year: student.study_year,
      pay_year1: student.pay_year1,
      pay_year2: student.pay_year2,
      pay_year3: student.pay_year3,
      pay_year4: student.pay_year4,
      status: student.status,
    }));
  } catch {
    return [];
  }
}

function PaymentsPage() {
  const { t } = useI18n();
  const { user, primaryRole, roles, isDemo } = useAuth();
  const qc = useQueryClient();
  const [qrPayment, setQrPayment] = useState<PaymentRow | null>(null);
  const isAdmin = roles.includes("admin");
  const isStudent = primaryRole === "student";
  type MarkPaidVariables = {
    id: string;
    method?: "cash" | "mobile";
    receiptWindow?: Window | null;
  };

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const rows = readDemoPayments();
        if (!isStudent) return rows;
        const students = readDemoStudentsMin();
        const ownStudent = students[0];
        return ownStudent
          ? rows.filter((payment) => payment.students?.student_code === ownStudent.student_code)
          : [];
      }

      const { data, error } = await supabase
        .from("payments")
        .select(PAYMENT_ROW_SELECT)
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
    mutationFn: async ({ id, method }: MarkPaidVariables) => {
      const paidDate = new Date().toISOString().slice(0, 10);
      if (isDemo) {
        const updatedPayments = readDemoPayments().map((payment) =>
          payment.id === id
            ? {
                ...payment,
                status: "paid" as const,
                method: method ?? payment.method,
                paid_date: paidDate,
              }
            : payment,
        );
        writeDemoPayments(updatedPayments);
        return updatedPayments.find((payment) => payment.id === id) ?? null;
      }

      const { data, error } = await supabase
        .from("payments")
        .update({
          status: "paid",
          method: method ?? "cash",
          paid_date: paidDate,
        })
        .eq("id", id)
        .select(PAYMENT_ROW_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as PaymentRow;
    },
    onSuccess: (paidPayment, variables) => {
      const fallbackPayment =
        payments.find((payment) => payment.id === variables.id) ??
        (qrPayment?.id === variables.id ? qrPayment : null);
      const receiptPayment = paidPayment ?? fallbackPayment;

      if (receiptPayment) {
        const normalizedPayment: PaymentRow = {
          ...receiptPayment,
          status: "paid",
          method: variables.method ?? receiptPayment.method ?? "cash",
          paid_date: receiptPayment.paid_date ?? new Date().toISOString().slice(0, 10),
        };
        qc.setQueriesData<PaymentRow[]>({ queryKey: ["payments"] }, (oldPayments) =>
          oldPayments
            ? oldPayments.some((payment) => payment.id === normalizedPayment.id)
              ? oldPayments.map((payment) =>
                  payment.id === normalizedPayment.id ? normalizedPayment : payment,
                )
              : [normalizedPayment, ...oldPayments]
            : oldPayments,
        );
        printReceipt(normalizedPayment, variables.receiptWindow);
      } else if (variables.receiptWindow) {
        variables.receiptWindow.document.body.innerHTML =
          '<p style="font-family: Arial, sans-serif; padding: 24px;">Could not load this invoice. Please close this tab and try again.</p>';
      }

      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recent-payments"] });
      toast.success("Marked paid");
      setQrPayment(null);
    },
    onError: (e, variables) => {
      const message = e.message || "Payment was not marked paid.";
      if (variables.receiptWindow) {
        variables.receiptWindow.document.body.innerHTML = `<p style="font-family: Arial, sans-serif; padding: 24px;">Payment was not marked paid: ${escapeHtml(message)}. Please close this tab and try again.</p>`;
      }
      toast.error(message);
    },
  });

  return (
    <div>
      <PageHeader title={t("payments")} subtitle={t("payments_subtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("paid")}
          value={`$${stats.paid.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t("pending")}
          value={`$${stats.pending.toLocaleString()}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label={t("overdue")}
          value={`$${stats.overdue.toLocaleString()}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="info"
        />
      </div>
      {isAdmin && (
        <StudentPaymentPanel
          isDemo={isDemo}
          isStudent={false}
          userId={user?.id}
          payments={payments}
          onCreated={(payment) => {
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
            setQrPayment(payment);
          }}
        />
      )}
      {isStudent && (
        <StudentPaymentPanel
          isDemo={isDemo}
          isStudent
          userId={user?.id}
          payments={payments}
          onCreated={(payment) => {
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
            setQrPayment(payment);
          }}
        />
      )}
      <SectionCard className="mt-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("no_payments_yet")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">{t("invoice")}</th>
                  <th className="py-3 pr-4">{t("student")}</th>
                  <th className="py-3 pr-4">{t("amount")}</th>
                  <th className="py-3 pr-4">{t("due")}</th>
                  <th className="py-3 pr-4">{t("status")}</th>
                  <th className="py-3 text-right">{t("payment_option")}</th>
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
                            onClick={() =>
                              markPaid.mutate({
                                id: p.id,
                                method: "cash",
                                receiptWindow: openReceiptWindow(),
                              })
                            }
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
      {qrPayment && (
        <KhQrPaymentModal
          payment={qrPayment}
          canConfirm={isAdmin}
          isConfirming={markPaid.isPending}
          onClose={() => setQrPayment(null)}
          onConfirm={() =>
            markPaid.mutate({
              id: qrPayment.id,
              method: "mobile",
              receiptWindow: openReceiptWindow(),
            })
          }
        />
      )}
    </div>
  );
}

function formatUsd(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}

const KHMER_NUMBER_WORDS = [
  "សូន្យ",
  "មួយ",
  "ពីរ",
  "បី",
  "បួន",
  "ប្រាំ",
  "ប្រាំមួយ",
  "ប្រាំពីរ",
  "ប្រាំបី",
  "ប្រាំបួន",
] as const;

const KHMER_TENS_WORDS: Record<number, string> = {
  10: "ដប់",
  20: "ម្ភៃ",
  30: "សាមសិប",
  40: "សែសិប",
  50: "ហាសិប",
  60: "ហុកសិប",
  70: "ចិតសិប",
  80: "ប៉ែតសិប",
  90: "កៅសិប",
};

function khmerNumberBelowThousand(value: number) {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds) parts.push(`${KHMER_NUMBER_WORDS[hundreds]}រយ`);
  if (remainder) {
    if (remainder < 10) {
      parts.push(KHMER_NUMBER_WORDS[remainder]);
    } else {
      const tens = Math.floor(remainder / 10) * 10;
      const ones = remainder % 10;
      parts.push(
        ones ? `${KHMER_TENS_WORDS[tens]}${KHMER_NUMBER_WORDS[ones]}` : KHMER_TENS_WORDS[tens],
      );
    }
  }

  return parts.join("");
}

function khmerIntegerWords(value: number): string {
  if (value === 0) return KHMER_NUMBER_WORDS[0];

  const groups = [
    { value: 1_000_000, label: "លាន" },
    { value: 1_000, label: "ពាន់" },
  ];
  let remaining = value;
  const parts: string[] = [];

  groups.forEach((group) => {
    const count = Math.floor(remaining / group.value);
    if (count) {
      parts.push(`${khmerIntegerWords(count)}${group.label}`);
      remaining %= group.value;
    }
  });

  if (remaining) parts.push(khmerNumberBelowThousand(remaining));
  return parts.join("");
}

function khmerMoneyWords(amount: number) {
  const normalized = Math.max(0, Number(amount) || 0);
  const dollars = Math.floor(normalized);
  const cents = Math.round((normalized - dollars) * 100);
  const dollarWords = `${khmerIntegerWords(dollars)} ដុល្លារ`;
  return cents ? `${dollarWords} និង ${khmerIntegerWords(cents)} សេន` : dollarWords;
}

function formatReceiptDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value ?? "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function receiptNumber(invoiceNumber: string) {
  return invoiceNumber.startsWith("RV/")
    ? invoiceNumber
    : `RV/${invoiceNumber.replace(/^INV-/, "")}`;
}

function receiptSerial(invoiceNumber: string) {
  const digits = invoiceNumber.replace(/\D/g, "").padStart(10, "0").slice(-10);
  return `K02-${digits}`;
}

function academicYear(value: number | null | undefined) {
  const year = value || new Date().getFullYear();
  return `${year}-${year + 1}`;
}

function khmerStudyYear(value: number | null | undefined) {
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1) return "ឆ្នាំទី-";
  return `ឆ្នាំទី${KHMER_NUMBER_WORDS[Math.min(Math.trunc(year), 9)] ?? Math.trunc(year)}`;
}

function khmerGender(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "-";
  if (["male", "m", "ប្រុស"].includes(normalized)) return "ប្រុស";
  if (["female", "f", "ស្រី"].includes(normalized)) return "ស្រី";
  return value ?? "-";
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
        <img
          src={qrUrl}
          alt={`KH QR for invoice ${payment.invoice_number}`}
          className="h-full w-full"
        />
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

function openReceiptWindow() {
  const printWindow = window.open("", "_blank", "width=980,height=700");
  if (!printWindow) {
    toast.error("Allow pop-ups to create the receipt PDF.");
    return null;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head><title>Preparing receipt</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">Preparing receipt...</body>
    </html>
  `);
  printWindow.document.close();
  return printWindow;
}

function printReceipt(payment: PaymentRow, existingWindow?: Window | null) {
  const printWindow = existingWindow ?? openReceiptWindow();
  if (!printWindow) {
    return;
  }

  const student = payment.students;
  const studentName = escapeHtml(student?.full_name_en || student?.full_name || "Student");
  const studentNameKm = escapeHtml(student?.full_name_km || student?.full_name || "Student");
  const studentCode = escapeHtml(student?.student_code ?? "-");
  const className = escapeHtml(student?.class_name ?? "-");
  const major = escapeHtml(student?.major ?? "-");
  const phone = escapeHtml(student?.phone ?? "-");
  const dateOfBirth = escapeHtml(student?.date_of_birth ?? "-");
  const gender = escapeHtml(khmerGender(student?.gender));
  const address = escapeHtml(student?.address ?? "-");
  const year = escapeHtml(academicYear(student?.enrollment_year));
  const paidForYear = escapeHtml(khmerStudyYear(student?.study_year));
  const description = escapeHtml(payment.description ?? "Tuition payment");
  const amountWords = escapeHtml(khmerMoneyWords(payment.amount));
  const method = payment.method === "mobile" ? "KH QR" : (payment.method ?? "Cash");
  const paidDate = payment.paid_date ?? new Date().toISOString().slice(0, 10);
  const receiptId = escapeHtml(receiptNumber(payment.invoice_number));
  const serial = escapeHtml(receiptSerial(payment.invoice_number));
  const issueDate = escapeHtml(formatReceiptDate(paidDate));

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receipt ${escapeHtml(payment.invoice_number)}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Battambang:wght@400;700;900&family=Moul&display=swap");
          @page { size: A5 landscape; margin: 5mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Battambang", "Khmer OS Battambang", "Noto Sans Khmer", Arial, sans-serif;
            color: #111827;
            background: #f5f5f5;
          }
          html, body { width: 210mm; min-height: 148mm; }
          .sheet { padding: 0; }
          .receipt {
            position: relative;
            width: 200mm;
            height: 138mm;
            margin: 0 auto;
            overflow: hidden;
            border: 1px solid #c7c7c7;
            background:
              repeating-linear-gradient(0deg, rgba(30, 64, 175, 0.028) 0 11px, transparent 11px 22px),
              repeating-linear-gradient(90deg, rgba(30, 64, 175, 0.018) 0 60px, transparent 60px 120px),
              #ffffff;
            padding: 7mm 8mm 6mm;
          }
          .receipt::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image: url("${escapeHtml(UNIVERSITY_LOGO_URL)}");
            background-repeat: no-repeat;
            background-position: center 57%;
            background-size: 255px;
            opacity: 0.075;
            pointer-events: none;
          }
          .content { position: relative; z-index: 1; }
          .header {
            display: grid;
            grid-template-columns: 30mm 1fr 30mm;
            align-items: center;
            gap: 8px;
            border-bottom: 2px solid #111827;
            padding-bottom: 6px;
          }
          .logo { width: 26mm; height: 26mm; object-fit: contain; }
          .school { text-align: center; color: #102f73; font-weight: 900; line-height: 1.18; }
          .school-km {
            font-family: "Moul", "Khmer OS Muol Light", "Khmer OS Muol", serif;
            font-size: 18px;
            font-weight: 400;
            letter-spacing: 0;
          }
          .school-en { margin-top: 4px; font-size: 17px; letter-spacing: 0.5px; text-transform: uppercase; }
          .school-meta { margin-top: 6px; font-size: 12px; color: #102f73; font-weight: 900; }
          .copy { text-align: right; font-size: 10px; color: transparent; }
          .title { margin: 4px 0 5px; text-align: center; }
          .title h1 {
            margin: 0;
            font-family: "Moul", "Khmer OS Muol Light", "Khmer OS Muol", serif;
            font-size: 20px;
            line-height: 1.15;
            text-decoration: underline;
            font-weight: 400;
          }
          .title p { margin: 0; font-size: 14px; font-weight: 900; }
          .details {
            display: grid;
            grid-template-columns: 1fr 0.92fr;
            gap: 14mm;
            padding: 0 13mm 0 17mm;
            font-size: 15.5px;
            line-height: 1.5;
          }
          .row { display: flex; align-items: baseline; gap: 7px; white-space: nowrap; }
          .label {
            font-family: "Khmer OS Battambang", "Battambang", "Noto Sans Khmer", Arial, sans-serif;
            font-weight: 900;
            color: #111827;
          }
          .value { font-weight: 900; color: #111827; }
          .muol-value {
            font-family: "Moul", "Khmer OS Muol Light", "Khmer OS Muol", serif;
            font-size: 14px;
            font-weight: 400;
            letter-spacing: 0;
          }
          .words { white-space: normal; line-height: 1.35; }
          .amount { font-size: 18px; font-weight: 950; }
          .notes {
            margin-top: 6mm;
            padding-left: 17mm;
            max-width: 112mm;
            font-size: 14.5px;
            font-weight: 800;
            line-height: 1.38;
          }
          .notes h2 { margin: 0 0 2px; font-size: 16px; font-weight: 950; }
          .footer { position: relative; min-height: 23mm; }
          .stamp-wrap {
            position: absolute;
            left: 108mm;
            bottom: -2mm;
            width: 50mm;
            text-align: center;
          }
          .stamp {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36mm;
            height: 15mm;
            border: 3px solid #102f73;
            color: #102f73;
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 2px;
            transform: rotate(-6deg);
            opacity: 0.92;
          }
          .stamp-date { margin-top: -5px; font-size: 12px; color: #102f73; font-weight: 900; }
          .signature {
            position: absolute;
            right: 4mm;
            bottom: 5mm;
            width: 32mm;
            text-align: center;
            font-size: 14px;
            font-weight: 950;
          }
          .signature-mark {
            height: 13mm;
            border-bottom: 2px solid #111827;
            transform: skew(-10deg) rotate(-5deg);
          }
          .no-print { margin-bottom: 16px; display: flex; justify-content: flex-end; }
          button { border: 0; background: #111827; color: #fff; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
          @media print {
            body { background: #fff; }
            .sheet { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="no-print"><button onclick="window.print()">Save as PDF / Print</button></div>
          <main class="receipt">
            <div class="content">
              <section class="header">
                <img class="logo" src="${escapeHtml(UNIVERSITY_LOGO_URL)}" alt="Logo" />
                <div class="school">
                  <div class="school-km">${escapeHtml(UNIVERSITY_NAME_KM)}</div>
                  <div class="school-en">${escapeHtml(UNIVERSITY_NAME_EN)}</div>
                  <div class="school-meta">មហាវិថីព្រះមុនីវង្ស សង្កាត់បឹងត្របែក ខណ្ឌចំការមន រាជធានីភ្នំពេញ ទូរស័ព្ទលេខ : ០២៣ ២២២ ១៧៨</div>
                </div>
                <div class="copy">Student copy</div>
              </section>

              <section class="title">
                <h1>បង្កាន់ដៃបង់ប្រាក់</h1>
                <p>លេខ : ${serial}</p>
              </section>

              <section class="details">
                <div>
                  <div class="row"><span class="label">បានទទួលពីនិស្សិតឈ្មោះ :</span><span class="value muol-value">${studentNameKm}</span></div>
                  <div class="row"><span class="label">ឈ្មោះជាអក្សរឡាតាំង :</span><span class="value">${studentName}</span></div>
                  <div class="row"><span class="label">ថ្ងៃខែឆ្នាំកំណើត :</span><span class="value">${dateOfBirth}</span></div>
                  <div class="row"><span class="label">ភេទ :</span><span class="value">${gender}</span><span class="label">ក្រុម :</span><span class="value">${className}</span></div>
                  <div class="row"><span class="label">ប្រភេទនិស្សិតបង់ :</span><span class="value">${description}</span></div>
                  <div class="row"><span class="label">ជាអក្សរ :</span><span class="value words">${amountWords}</span></div>
                  <div class="row"><span class="label">បរិយាយ :</span><span class="value">${address}</span></div>
                </div>
                <div>
                  <div class="row"><span class="label">បង្កាន់ដៃលេខ :</span><span class="value">${receiptId}</span></div>
                  <div class="row"><span class="label">អត្តលេខ :</span><span class="value">${studentCode}</span></div>
                  <div class="row"><span class="label">ឆ្នាំសិក្សា :</span><span class="value">${year}</span></div>
                  <div class="row"><span class="label">បង់ប្រាក់ :</span><span class="value">${escapeHtml(method)}</span></div>
                  <div class="row"><span class="label">ចំនួនទឹកប្រាក់ :</span><span class="value amount">${formatUsd(payment.amount)}</span></div>
                  <div class="row"><span class="label">បង់សម្រាប់ :</span><span class="value">${paidForYear}</span></div>
                  <div class="row"><span class="label">កាលបរិច្ឆេទបង់ប្រាក់ :</span><span class="value">${issueDate}</span></div>
                </div>
              </section>

              <div class="notes">
                <h2>សម្គាល់ :</h2>
                <div>- សូមរក្សាទុកបង្កាន់ដៃនេះ សម្រាប់ការផ្ទៀងផ្ទាត់នៅពេលក្រោយ</div>
                <div>- លេខទូរស័ព្ទនិស្សិត: ${phone}</div>
              </div>

              <section class="footer">
                <div class="stamp-wrap">
                  <div class="stamp">PAID</div>
                  <div class="stamp-date">${issueDate}</div>
                </div>
                <div class="signature">
                  <div class="signature-mark"></div>
                  <div>អ្នកទទួលប្រាក់</div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function KhQrPaymentModal({
  payment,
  canConfirm,
  isConfirming,
  onClose,
  onConfirm,
}: {
  payment: PaymentRow;
  canConfirm: boolean;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
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
            <h3 className="font-display text-lg font-bold">{t("pay_by_khqr")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{payment.invoice_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">
              KHQR
            </div>
            <KhQrCode payment={payment} />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pay_to")}
              </p>
              <p className="mt-1 font-semibold">{UNIVERSITY_SHORT_NAME}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("student")}
              </p>
              <p className="mt-1 font-semibold">{payment.students?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("amount")}
              </p>
              <p className="mt-1 text-2xl font-bold">{formatUsd(payment.amount)}</p>
            </div>
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
              {canConfirm ? t("scan_khqr_admin_notice") : t("scan_khqr_student_notice")}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            {t("cancel")}
          </button>
          {canConfirm && (
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
              {t("paid_create_receipt")}
            </button>
          )}
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

function studentSearchText(student: PaymentStudent) {
  return [
    student.student_code,
    student.full_name,
    student.full_name_en,
    student.full_name_km,
    student.phone,
    student.class_name,
    student.major,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function studentSuggestions(students: PaymentStudent[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return students
    .filter((student) => studentSearchText(student).includes(normalized))
    .sort((a, b) => {
      const aCode = a.student_code.toLowerCase();
      const bCode = b.student_code.toLowerCase();
      const aStarts = aCode.startsWith(normalized);
      const bStarts = bCode.startsWith(normalized);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aCode.localeCompare(bCode);
    })
    .slice(0, 6);
}

function StudentSearchSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: PaymentStudent[];
  onSelect: (student: PaymentStudent) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {suggestions.map((student) => (
        <button
          key={student.id}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(student)}
          className="flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted"
        >
          <div className="min-w-0">
            <p className="font-mono font-semibold text-info">{student.student_code}</p>
            <p className="truncate font-semibold text-foreground">
              {student.full_name_en || student.full_name}
            </p>
            {student.full_name_km && (
              <p className="truncate text-muted-foreground">{student.full_name_km}</p>
            )}
          </div>
          <div className="shrink-0 text-right text-muted-foreground">
            <p>{student.class_name || "-"}</p>
            <p>{student.phone || "-"}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

const PAYMENT_YEARS = [1, 2, 3, 4] as const;
const PAYMENT_SEMESTERS = [1, 2] as const;
type PaymentPlan = "semester" | "year";

function paymentTermLabel(year: number, semester: number) {
  return `ឆ្នាំទី${year} ឆមាសទី${semester}`;
}

function paymentPlanLabel(plan: PaymentPlan) {
  return plan === "year" ? "បង់ ១ឆ្នាំ" : "បង់ ១ឆមាស";
}

function paymentDescriptionLabel(year: number, semester: number, plan: PaymentPlan) {
  return plan === "year" ? `ឆ្នាំទី${year} ១ឆ្នាំ` : paymentTermLabel(year, semester);
}

function paymentYearStatus(student: PaymentStudent | null, year: number) {
  const value = student?.[`pay_year${year}` as keyof PaymentStudent];
  return typeof value === "string" ? value : null;
}

function studentPaidAmountForYear(
  student: PaymentStudent | null,
  year: number,
  annualPrice: number,
  semesterPrice: number,
) {
  const status = paymentYearStatus(student, year);
  if (status === "paid" || status === "full_year_580" || status === "semester1_2_600")
    return annualPrice;
  if (status === "semester_300" || status === "semester1_300" || status === "semester2_300")
    return semesterPrice;
  return 0;
}

function paymentDescription(payment: PaymentRow) {
  return payment.description?.toLowerCase() ?? "";
}

function paymentMatchesYear(payment: PaymentRow, year: number) {
  const description = paymentDescription(payment);
  return description.includes(`ឆ្នាំទី${year}`) || description.includes(`year ${year}`);
}

function paymentIsFullYear(payment: PaymentRow) {
  const description = paymentDescription(payment);
  return (
    description.includes("១ឆ្នាំ") ||
    description.includes("1 year") ||
    description.includes("full year") ||
    description.includes("annual")
  );
}

function paymentMatchesTerm(payment: PaymentRow, year: number, semester: number) {
  const description = paymentDescription(payment);
  return (
    paymentMatchesYear(payment, year) &&
    (description.includes(`ឆមាសទី${semester}`) ||
      description.includes(`semester ${semester}`) ||
      paymentIsFullYear(payment))
  );
}

function activePayment(payment: PaymentRow) {
  return payment.status === "pending" || payment.status === "overdue" || payment.status === "paid";
}

function studentHasPaidTerm(student: PaymentStudent | null, year: number, semester: number) {
  const yearStatus = paymentYearStatus(student, year);
  return (
    yearStatus === "paid" ||
    yearStatus === "full_year_580" ||
    yearStatus === "semester1_2_600" ||
    yearStatus === "semester_300" ||
    (semester === 1 && yearStatus === "semester1_300") ||
    (semester === 2 && yearStatus === "semester2_300")
  );
}

function existingPaymentForTerm(
  student: PaymentStudent | null,
  payments: PaymentRow[],
  year: number,
  semester: number,
) {
  if (studentHasPaidTerm(student, year, semester)) return "student_record";
  return (
    payments.find(
      (payment) => activePayment(payment) && paymentMatchesTerm(payment, year, semester),
    ) ?? null
  );
}

function existingPaymentForSelection(
  student: PaymentStudent | null,
  payments: PaymentRow[],
  year: number,
  semester: number,
  plan: PaymentPlan,
) {
  if (plan === "semester") {
    return existingPaymentForTerm(student, payments, year, semester);
  }

  const semester1 = existingPaymentForTerm(student, payments, year, 1);
  if (semester1) return semester1;
  const semester2 = existingPaymentForTerm(student, payments, year, 2);
  if (semester2) return semester2;
  return (
    payments.find((payment) => activePayment(payment) && paymentMatchesYear(payment, year)) ?? null
  );
}

function paymentTermStatus(
  student: PaymentStudent | null,
  payments: PaymentRow[],
  year: number,
  semester: number,
) {
  const yearStatus = paymentYearStatus(student, year);
  if (yearStatus === "paid" || yearStatus === "full_year_580" || yearStatus === "semester1_2_600") {
    return "paid";
  }
  if (
    yearStatus === "semester_300" ||
    (semester === 1 && yearStatus === "semester1_300") ||
    (semester === 2 && yearStatus === "semester2_300")
  ) {
    return "paid";
  }

  const matching = payments.find((payment) => {
    return paymentMatchesTerm(payment, year, semester);
  });

  return matching?.status ?? "unpaid";
}

function paymentBalanceForYear(
  student: PaymentStudent | null,
  payments: PaymentRow[],
  year: number,
  annualPrice: number,
  semesterPrice: number,
) {
  const yearPayments = payments.filter((payment) => paymentMatchesYear(payment, year));
  const paidFromPayments = yearPayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pending = yearPayments
    .filter((payment) => payment.status === "pending" || payment.status === "overdue")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paidFromStudent = yearPayments.length
    ? 0
    : studentPaidAmountForYear(student, year, annualPrice, semesterPrice);
  const paid = Math.min(annualPrice, paidFromPayments + paidFromStudent);

  return {
    total: annualPrice,
    paid,
    pending,
    left: Math.max(annualPrice - paid, 0),
  };
}

function PaymentTermBadge({
  status,
}: {
  status: "pending" | "paid" | "overdue" | "cancelled" | "unpaid";
}) {
  const { t } = useI18n();
  const label =
    status === "paid"
      ? t("paid")
      : status === "pending"
        ? t("pending")
        : status === "overdue"
          ? t("overdue")
          : status === "cancelled"
            ? t("cancelled")
            : t("unpaid");
  const className =
    status === "paid"
      ? "bg-success/15 text-success"
      : status === "pending"
        ? "bg-warning/15 text-warning"
        : status === "overdue"
          ? "bg-destructive/15 text-destructive"
          : status === "cancelled"
            ? "bg-muted text-muted-foreground"
            : "bg-card text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function StudentPaymentPanel({
  isDemo,
  isStudent,
  userId,
  payments,
  onCreated,
}: {
  isDemo: boolean;
  isStudent: boolean;
  userId?: string;
  payments: PaymentRow[];
  onCreated: (payment: PaymentRow) => void;
}) {
  const { t } = useI18n();
  const [studentCode, setStudentCode] = useState("");
  const [form, setForm] = useState({
    amount: "",
    due_date: "",
    description: "",
    targetYear: 1,
    targetSemester: 1,
    paymentPlan: "semester" as PaymentPlan,
  });
  const { data: students = [], isLoading } = useQuery({
    queryKey: [
      "students-payment-lookup",
      isStudent ? "student" : "admin",
      userId,
      isDemo ? "demo" : "remote",
    ],
    queryFn: async () => {
      if (isDemo) {
        const students = readDemoStudentsMin();
        return isStudent ? students.slice(0, 1) : students;
      }

      const query = supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_en,full_name_km,email,phone,date_of_birth,gender,address,major,class_name,shift,enrollment_year,study_year,pay_year1,pay_year2,pay_year3,pay_year4,status,user_id",
        );

      const { data, error } = isStudent
        ? await query.eq("user_id", userId ?? "").limit(1)
        : await query.order("student_code");
      if (error) throw error;
      return (data ?? []) as PaymentStudent[];
    },
  });

  useEffect(() => {
    if (isStudent && students[0]?.student_code && studentCode !== students[0].student_code) {
      setStudentCode(students[0].student_code);
    }
  }, [isStudent, studentCode, students]);

  const selectedStudent = useMemo(() => {
    if (isStudent) return students[0] ?? null;
    const normalized = studentCode.trim().toLowerCase();
    if (!normalized) return null;
    return students.find((student) => student.student_code.toLowerCase() === normalized) ?? null;
  }, [isStudent, studentCode, students]);
  const searchSuggestions = useMemo(
    () => (!isStudent && !selectedStudent ? studentSuggestions(students, studentCode) : []),
    [isStudent, selectedStudent, studentCode, students],
  );
  const showMissingStudent =
    !isStudent && studentCode.trim().length > 0 && !selectedStudent && !isLoading;
  const selectedStudentPayments = useMemo(
    () =>
      selectedStudent
        ? payments.filter(
            (payment) => payment.students?.student_code === selectedStudent.student_code,
          )
        : [],
    [payments, selectedStudent],
  );
  const amountValue = Number(form.amount);
  const canCreatePayment = Boolean(selectedStudent && amountValue > 0);
  const selectedTuitionRate = tuitionRateForMajor(selectedStudent?.major);
  const selectedTerm = paymentDescriptionLabel(
    form.targetYear,
    form.targetSemester,
    form.paymentPlan,
  );
  const autoAmount =
    form.paymentPlan === "year" ? selectedTuitionRate.year : selectedTuitionRate.semester;
  const selectedYearBalance = paymentBalanceForYear(
    selectedStudent,
    selectedStudentPayments,
    form.targetYear,
    selectedTuitionRate.year,
    selectedTuitionRate.semester,
  );
  const duplicatePayment = existingPaymentForSelection(
    selectedStudent,
    selectedStudentPayments,
    form.targetYear,
    form.targetSemester,
    form.paymentPlan,
  );
  const duplicatePaymentMessage =
    duplicatePayment && typeof duplicatePayment === "object"
      ? t("payment_already_exists_invoice", { invoice: duplicatePayment.invoice_number })
      : duplicatePayment
        ? t("payment_already_exists")
        : "";
  const canCreateSelectedPayment = canCreatePayment && !duplicatePayment;

  useEffect(() => {
    if (!selectedStudent) return;
    setForm((current) => ({
      ...current,
      amount: autoAmount.toString(),
      description: current.description || selectedTerm,
    }));
  }, [autoAmount, selectedStudent, selectedTerm]);

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error(t("valid_student_id_required"));
      if (!amountValue || amountValue <= 0) throw new Error(t("valid_amount_required"));
      const duplicate = existingPaymentForSelection(
        selectedStudent,
        selectedStudentPayments,
        form.targetYear,
        form.targetSemester,
        form.paymentPlan,
      );
      if (duplicate) {
        throw new Error(
          typeof duplicate === "object"
            ? t("payment_already_exists_invoice", { invoice: duplicate.invoice_number })
            : t("payment_already_exists"),
        );
      }

      const invoiceNumber = `INV-${Date.now().toString().slice(-7)}`;
      const payment: PaymentRow = {
        id: `demo-payment-${Date.now()}`,
        invoice_number: invoiceNumber,
        amount: amountValue,
        due_date: form.due_date || null,
        paid_date: null,
        status: "pending",
        method: null,
        description: form.description || selectedTerm,
        students: {
          full_name: selectedStudent.full_name,
          full_name_en: selectedStudent.full_name_en,
          full_name_km: selectedStudent.full_name_km,
          student_code: selectedStudent.student_code,
          class_name: selectedStudent.class_name,
          major: selectedStudent.major,
          phone: selectedStudent.phone,
          date_of_birth: selectedStudent.date_of_birth,
          gender: selectedStudent.gender,
          address: selectedStudent.address,
          enrollment_year: selectedStudent.enrollment_year,
          study_year: form.targetYear,
        },
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
          amount: amountValue,
          due_date: form.due_date || null,
          description: form.description || selectedTerm,
          status: "pending",
        })
        .select(PAYMENT_ROW_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as PaymentRow;
    },
    onSuccess: (payment) => {
      toast.success(isDemo ? t("demo_khqr_ready") : t("khqr_ready"));
      onCreated(payment);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SectionCard className="mt-6 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(300px,360px)]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isStudent ? t("your_student_information") : t("student_lookup")}
            </p>
            {!isStudent && (
              <div className="relative mt-2">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder={t("student_id")}
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <StudentSearchSuggestions
                  suggestions={searchSuggestions}
                  onSelect={(student) => setStudentCode(student.student_code)}
                />
              </div>
            )}
          </div>
          {isLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("loading_students")}
            </div>
          )}
          {showMissingStudent && (
            <p className="mt-2 text-xs font-medium text-destructive">
              {t("no_student_found_for", { id: studentCode.trim() })}
            </p>
          )}
          <div className="rounded-xl border border-border bg-surface p-3">
            {selectedStudent ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-info">
                      {selectedStudent.student_code}
                    </p>
                    <h3 className="mt-0.5 text-base font-bold">
                      {selectedStudent.full_name_en || selectedStudent.full_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedStudent.full_name_km || t("khmer_name_not_set")}
                    </p>
                  </div>
                  {selectedStudent.status && <StatusPill status={selectedStudent.status} />}
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                  <StudentInfoLine label={t("class")} value={selectedStudent.class_name} />
                  <StudentInfoLine label={t("major")} value={selectedStudent.major} />
                  <StudentInfoLine label={t("shift")} value={selectedStudent.shift} />
                  <StudentInfoLine label={t("phone")} value={selectedStudent.phone} />
                </div>
                <div className="mt-3 rounded-xl border border-border bg-card p-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("payment_status")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PAYMENT_YEARS.flatMap((year) =>
                      PAYMENT_SEMESTERS.map((semester) => {
                        const status = paymentTermStatus(
                          selectedStudent,
                          selectedStudentPayments,
                          year,
                          semester,
                        );
                        const isSelected =
                          form.targetYear === year && form.targetSemester === semester;
                        return (
                          <button
                            key={`${year}-${semester}`}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                targetYear: year,
                                targetSemester: semester,
                                paymentPlan: "semester",
                                description: paymentDescriptionLabel(year, semester, "semester"),
                                amount: selectedTuitionRate.semester.toString(),
                              })
                            }
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                              isSelected
                                ? "border-info bg-info/10 text-foreground"
                                : "border-border bg-surface hover:bg-muted"
                            }`}
                          >
                            <span className="font-semibold">
                              {paymentTermLabel(year, semester)}
                            </span>
                            <PaymentTermBadge status={status} />
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                <span>{isStudent ? t("no_student_linked") : t("enter_student_id")}</span>
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPayment.mutate();
          }}
          className="rounded-xl border border-info/30 bg-info/10 p-3"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("payment_form")}
              </p>
              <h3 className="mt-0.5 font-display text-base font-bold">
                {isStudent ? t("pay_by_khqr") : t("create_khqr_invoice")}
              </h3>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info text-info-foreground">
              <QrCode className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pay_for")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.paymentPlan}
                  onChange={(e) => {
                    const paymentPlan = e.target.value as PaymentPlan;
                    const amount =
                      paymentPlan === "year"
                        ? selectedTuitionRate.year
                        : selectedTuitionRate.semester;
                    setForm({
                      ...form,
                      paymentPlan,
                      amount: amount.toString(),
                      description: paymentDescriptionLabel(
                        form.targetYear,
                        form.targetSemester,
                        paymentPlan,
                      ),
                    });
                  }}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="semester">{t("pay_one_semester")}</option>
                  <option value="year">{t("pay_one_year")}</option>
                </select>
                <select
                  value={form.targetYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      targetYear: Number(e.target.value),
                      description: paymentDescriptionLabel(
                        Number(e.target.value),
                        form.targetSemester,
                        form.paymentPlan,
                      ),
                      amount: autoAmount.toString(),
                    })
                  }
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                >
                  {PAYMENT_YEARS.map((year) => (
                    <option key={year} value={year}>
                      ឆ្នាំទី{year}
                    </option>
                  ))}
                </select>
                {form.paymentPlan === "semester" && (
                  <select
                    value={form.targetSemester}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetSemester: Number(e.target.value),
                        description: paymentDescriptionLabel(
                          form.targetYear,
                          Number(e.target.value),
                          form.paymentPlan,
                        ),
                        amount: autoAmount.toString(),
                      })
                    }
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  >
                    {PAYMENT_SEMESTERS.map((semester) => (
                      <option key={semester} value={semester}>
                        ឆមាសទី{semester}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("amount_usd")}
              </label>
              <div className="flex h-10 items-center rounded-xl border border-border bg-card px-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  readOnly
                  placeholder="0.00"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold outline-none"
                />
              </div>
              <div className="mt-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                {paymentPlanLabel(form.paymentPlan)}:{" "}
                <span className="font-semibold text-foreground">{formatUsd(autoAmount)}</span>
              </div>
              {duplicatePaymentMessage && (
                <p className="mt-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {duplicatePaymentMessage}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("due_date")}
              </label>
              <div className="flex h-10 items-center rounded-xl border border-border bg-card px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("description")}
              </label>
              <div className="flex rounded-xl border border-border bg-card px-3 py-1.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={1}
                  placeholder={selectedTerm}
                  className="min-w-0 flex-1 resize-none bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("student")}</span>
                <span className="truncate font-medium text-foreground">
                  {selectedStudent?.full_name_en || selectedStudent?.full_name || "-"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("pay_for")}</span>
                <span className="font-medium text-foreground">{selectedTerm}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("annual_tuition")}</span>
                <span className="font-medium text-foreground">
                  {formatUsd(selectedYearBalance.total)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("paid_amount")}</span>
                <span className="font-medium text-success">
                  {formatUsd(selectedYearBalance.paid)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("pending_amount")}</span>
                <span className="font-medium text-warning">
                  {formatUsd(selectedYearBalance.pending)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("payment_left")}</span>
                <span className="font-display text-base font-bold text-destructive">
                  {formatUsd(selectedYearBalance.left)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("total_due")}</span>
                <span className="font-display text-base font-bold text-foreground">
                  {amountValue > 0 ? formatUsd(amountValue) : "$0.00"}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={!canCreateSelectedPayment || createPayment.isPending}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-info text-sm font-semibold text-info-foreground shadow-soft disabled:opacity-50"
            >
              {createPayment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {t("pay_by_khqr")}
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

function AddPayment({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ student_code: "", amount: "", due_date: "", description: "" });
  const { data: students = [] } = useQuery({
    queryKey: ["students-min", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoStudentsMin();

      const { data } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_en,full_name_km,email,phone,major,class_name,shift,enrollment_year,study_year,status",
        )
        .order("student_code");
      return (data ?? []) as PaymentStudent[];
    },
  });
  const selectedStudent = useMemo(() => {
    const code = f.student_code.trim().toLowerCase();
    if (!code) return null;
    return students.find((student) => student.student_code.toLowerCase() === code) ?? null;
  }, [f.student_code, students]);
  const searchSuggestions = useMemo(
    () => (!selectedStudent ? studentSuggestions(students, f.student_code) : []),
    [f.student_code, selectedStudent, students],
  );
  const showMissingStudent = f.student_code.trim().length > 0 && !selectedStudent;
  const amountValue = Number(f.amount);
  const canSubmit = Boolean(selectedStudent && amountValue > 0);
  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const newPayment: PaymentRow = {
          id: `demo-payment-${Date.now()}`,
          invoice_number: `INV-${Date.now().toString().slice(-7)}`,
          amount: amountValue,
          due_date: f.due_date || null,
          paid_date: null,
          status: "pending",
          method: null,
          description: f.description || null,
          students: selectedStudent
            ? {
                full_name: selectedStudent.full_name,
                full_name_en: selectedStudent.full_name_en,
                full_name_km: selectedStudent.full_name_km,
                student_code: selectedStudent.student_code,
                class_name: selectedStudent.class_name,
                major: selectedStudent.major,
                phone: selectedStudent.phone,
                date_of_birth: selectedStudent.date_of_birth,
                gender: selectedStudent.gender,
                address: selectedStudent.address,
                enrollment_year: selectedStudent.enrollment_year,
                study_year: selectedStudent.study_year,
              }
            : null,
        };
        writeDemoPayments([newPayment, ...readDemoPayments()]);
        return;
      }

      const { error } = await supabase.from("payments").insert({
        student_id: selectedStudent!.id,
        invoice_number: `INV-${Date.now().toString().slice(-7)}`,
        amount: amountValue,
        due_date: f.due_date || null,
        description: f.description || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
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
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{t("create_invoice")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("prepare_khqr_invoice")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedStudent) return toast.error(t("valid_student_id_required"));
            if (!amountValue || amountValue <= 0) return toast.error(t("valid_amount_required"));
            mut.mutate();
          }}
          className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("student_id")} *
              </label>
              <div className="relative">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={f.student_code}
                    onChange={(e) => setF({ ...f, student_code: e.target.value })}
                    placeholder={t("student_id")}
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
                  />
                </div>
                <StudentSearchSuggestions
                  suggestions={searchSuggestions}
                  onSelect={(student) => setF({ ...f, student_code: student.student_code })}
                />
              </div>
              {showMissingStudent && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  {t("no_student_found_for", { id: f.student_code.trim() })}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              {selectedStudent ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-info">
                        {selectedStudent.student_code}
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {selectedStudent.full_name_en || selectedStudent.full_name}
                      </p>
                      {selectedStudent.full_name_km && (
                        <p className="text-xs text-muted-foreground">
                          {selectedStudent.full_name_km}
                        </p>
                      )}
                    </div>
                    {selectedStudent.status && <StatusPill status={selectedStudent.status} />}
                  </div>
                  <div className="mt-2 grid gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <StudentInfoLine label={t("class")} value={selectedStudent.class_name} />
                    <StudentInfoLine label={t("major")} value={selectedStudent.major} />
                    <StudentInfoLine label={t("shift")} value={selectedStudent.shift} />
                    <StudentInfoLine label={t("phone")} value={selectedStudent.phone} />
                  </div>
                </>
              ) : (
                <div className="flex min-h-24 items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  {t("enter_student_id")}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2.5 rounded-xl border border-info/30 bg-info/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("invoice_details")}
              </p>
              <QrCode className="h-4 w-4 text-info" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("amount_usd")} *
              </label>
              <div className="flex h-10 items-center rounded-xl border border-border bg-card px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.amount}
                  onChange={(e) => setF({ ...f, amount: e.target.value })}
                  placeholder="0.00"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("due_date")}
              </label>
              <div className="flex h-10 items-center rounded-xl border border-border bg-card px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={f.due_date}
                  onChange={(e) => setF({ ...f, due_date: e.target.value })}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("description")}
              </label>
              <div className="flex rounded-xl border border-border bg-card px-3 py-1.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <textarea
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                  rows={1}
                  placeholder={t("tuition_fee_placeholder")}
                  className="min-w-0 flex-1 resize-none bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t("total_due")}</span>
                <span className="font-display text-base font-bold text-foreground">
                  {amountValue > 0 ? formatUsd(amountValue) : "$0.00"}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={!canSubmit || mut.isPending}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {t("create_khqr_invoice")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
