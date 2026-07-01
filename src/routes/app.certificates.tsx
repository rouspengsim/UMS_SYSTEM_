import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Award, Plus, Loader2, X, QrCode, Printer } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  pageTitle,
  UNIVERSITY_LOGO_URL,
  UNIVERSITY_NAME_EN,
  UNIVERSITY_NAME_KM,
} from "@/lib/brand";

export const Route = createFileRoute("/app/certificates")({
  head: () => ({ meta: [{ title: pageTitle("Certificates") }] }),
  component: CertificatesPage,
});

type CertificateRow = {
  id: string;
  kind: string;
  title: string;
  issue_date: string;
  verification_code: string;
  status: string;
  students: {
    full_name: string;
    full_name_km: string | null;
    avatar_url: string | null;
    date_of_birth: string | null;
    major: string | null;
  } | null;
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCertificateDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatKhmerCertificateDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const months = [
    "មករា",
    "កុម្ភៈ",
    "មីនា",
    "មេសា",
    "ឧសភា",
    "មិថុនា",
    "កក្កដា",
    "សីហា",
    "កញ្ញា",
    "តុលា",
    "វិច្ឆិកា",
    "ធ្នូ",
  ];
  const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  const toKhmerNumber = (input: number) =>
    String(input)
      .split("")
      .map((digit) => khmerDigits[Number(digit)] ?? digit)
      .join("");

  return `ថ្ងៃទី ${toKhmerNumber(date.getDate())} ខែ ${months[date.getMonth()]} ឆ្នាំ ${toKhmerNumber(date.getFullYear())}`;
}

function certificateKindLabel(kind: string) {
  if (kind === "graduation") return "Certificate of Graduation";
  if (kind === "award") return "Certificate of Achievement";
  if (kind === "participation") return "Certificate of Participation";
  return "Certificate of Completion";
}

function printCertificate(certificate: CertificateRow) {
  const printWindow = window.open("", "_blank", "width=1200,height=850");
  if (!printWindow) {
    toast.error("Allow pop-ups to create the certificate PDF.");
    return;
  }

  const studentName = escapeHtml(certificate.students?.full_name || "Student");
  const studentNameKm = escapeHtml(
    certificate.students?.full_name_km || certificate.students?.full_name || "និស្សិត",
  );
  const studentPhoto = certificate.students?.avatar_url
    ? `<img src="${escapeHtml(certificate.students.avatar_url)}" alt="${studentName}" />`
    : `<span>Photo</span>`;
  const certificateTitle = escapeHtml(certificate.title || certificateKindLabel(certificate.kind));
  const kindLabel = escapeHtml(certificateKindLabel(certificate.kind));
  const issueDate = escapeHtml(formatCertificateDate(certificate.issue_date));
  const issueDateKh = escapeHtml(formatKhmerCertificateDate(certificate.issue_date));
  const dateOfBirthKh = certificate.students?.date_of_birth
    ? escapeHtml(formatKhmerCertificateDate(certificate.students.date_of_birth))
    : "—";
  const programKh = escapeHtml(
    certificate.students?.major || certificate.title || "កម្មវិធីសិក្សា",
  );
  const verificationCode = escapeHtml(certificate.verification_code);
  const serial = escapeHtml(certificate.verification_code.slice(0, 18).toUpperCase());
  const degreeName = certificate.kind === "graduation" ? "Bachelor Degree" : kindLabel;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${certificateTitle} - ${studentName}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Battambang:wght@400;700;900&family=Moul&family=Sora:wght@500;700;800;900&display=swap");
          @page { size: A4 landscape; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            width: 297mm;
            min-height: 210mm;
            margin: 0;
            background: #ececec;
            color: #111;
            font-family: "Battambang", "Khmer OS Battambang", Arial, sans-serif;
          }
          .sheet {
            width: 297mm;
            min-height: 210mm;
            padding: 2mm;
          }
          .certificate {
            position: relative;
            width: 293mm;
            height: 206mm;
            overflow: hidden;
            background:
              linear-gradient(#fff, #fff) padding-box,
              linear-gradient(135deg, #102f73, #d6a931 48%, #102f73) border-box;
            border: 1.5mm solid transparent;
            padding: 27mm 25mm 18mm;
          }
          .certificate::before {
            content: "";
            position: absolute;
            inset: 8mm;
            border: 0.45mm solid #102f73;
            box-shadow: inset 0 0 0 1.1mm #fff, inset 0 0 0 1.45mm #d6a931;
            pointer-events: none;
          }
          .certificate::after {
            content: "";
            position: absolute;
            inset: 12mm;
            background:
              linear-gradient(90deg, #d6a931 0 25mm, transparent 25mm calc(100% - 25mm), #d6a931 calc(100% - 25mm)) top / 100% 0.55mm no-repeat,
              linear-gradient(90deg, #d6a931 0 25mm, transparent 25mm calc(100% - 25mm), #d6a931 calc(100% - 25mm)) bottom / 100% 0.55mm no-repeat,
              linear-gradient(#d6a931 0 25mm, transparent 25mm calc(100% - 25mm), #d6a931 calc(100% - 25mm)) left / 0.55mm 100% no-repeat,
              linear-gradient(#d6a931 0 25mm, transparent 25mm calc(100% - 25mm), #d6a931 calc(100% - 25mm)) right / 0.55mm 100% no-repeat;
            pointer-events: none;
          }
          .corner {
            position: absolute;
            z-index: 1;
            width: 17mm;
            height: 17mm;
            border-color: #102f73;
            opacity: 0.95;
            pointer-events: none;
          }
          .corner-tl { left: 12mm; top: 12mm; border-left: 1.2mm solid; border-top: 1.2mm solid; }
          .corner-tr { right: 12mm; top: 12mm; border-right: 1.2mm solid; border-top: 1.2mm solid; }
          .corner-bl { left: 12mm; bottom: 12mm; border-left: 1.2mm solid; border-bottom: 1.2mm solid; }
          .corner-br { right: 12mm; bottom: 12mm; border-right: 1.2mm solid; border-bottom: 1.2mm solid; }
          .watermark {
            position: absolute;
            inset: 0;
            background-image: url("${escapeHtml(UNIVERSITY_LOGO_URL)}");
            background-repeat: no-repeat;
            background-position: center 50%;
            background-size: 70mm;
            opacity: 0.045;
            pointer-events: none;
          }
          .content {
            position: relative;
            z-index: 1;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .no-print { margin-bottom: 12px; display: flex; justify-content: flex-end; }
          .no-print button {
            border: 0;
            background: #111;
            color: white;
            border-radius: 8px;
            padding: 10px 14px;
            font-weight: 800;
            cursor: pointer;
          }
          .header {
            display: grid;
            grid-template-columns: 1fr 62mm 1fr;
            align-items: start;
            min-height: 33mm;
          }
          .top-block {
            text-align: center;
            font-family: "Sora", "Battambang", Arial, sans-serif;
            font-size: 11px;
            font-weight: 900;
            line-height: 1.35;
            text-transform: uppercase;
            color: #102f73;
          }
          .top-block .km {
            font-family: "Moul", "Battambang", serif;
            font-size: 14px;
            font-weight: 400;
            text-transform: none;
          }
          .center-logo { text-align: center; }
          .logo { width: 23mm; height: 23mm; object-fit: contain; opacity: 0.96; }
          .serial {
            position: absolute;
            left: 25mm;
            bottom: 23mm;
            font-family: "Sora", Arial, sans-serif;
            font-size: 10px;
            color: #333;
            font-weight: 800;
          }
          .title {
            margin-top: -10mm;
            text-align: center;
            line-height: 1.12;
          }
          .title-kh {
            margin: 0;
            font-family: "Moul", "Battambang", serif;
            font-size: 24px;
            font-weight: 400;
            color: #102f73;
          }
          .title-en {
            margin-top: 2mm;
            font-family: "Sora", Arial, sans-serif;
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            color: #102f73;
          }
          .university {
            margin-top: 4mm;
            text-align: center;
            font-family: "Moul", "Battambang", serif;
            font-size: 13px;
            line-height: 1.5;
            color: #102f73;
          }
          .university-en {
            display: block;
            font-family: "Sora", Arial, sans-serif;
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .body {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18mm;
            margin-top: 9mm;
            font-size: 13px;
            line-height: 1.55;
          }
          .body h2 {
            margin: 0 0 3mm;
            font-family: "Sora", "Battambang", Arial, sans-serif;
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            color: #102f73;
          }
          .kh h2 {
            font-family: "Moul", "Battambang", serif;
            font-size: 14px;
            font-weight: 400;
            text-transform: none;
          }
          .line {
            display: flex;
            align-items: baseline;
            gap: 3mm;
            min-height: 7mm;
          }
          .label { white-space: nowrap; }
          .value {
            font-weight: 900;
            border-bottom: 0.25mm solid #102f73;
            min-width: 38mm;
            padding: 0 2mm;
          }
          .footer {
            display: grid;
            grid-template-columns: 1fr 28mm 1fr;
            align-items: end;
            gap: 18mm;
            margin-top: auto;
            min-height: 43mm;
          }
          .sign {
            position: relative;
            min-height: 35mm;
            text-align: center;
            font-size: 12px;
            font-weight: 900;
          }
          .sign .date { margin-bottom: 3mm; }
          .stamp-space {
            height: 30mm;
            margin: 0 auto 1mm;
            width: 42mm;
          }
          .photo {
            align-self: end;
            justify-self: center;
            width: 24mm;
            height: 32mm;
            border: 0.45mm solid #102f73;
            background:
              linear-gradient(#bde7ff, #eaf7ff 48%, #f7f7f7 48%),
              #eee;
            display: flex;
            align-items: end;
            justify-content: center;
            color: #555;
            font-size: 8px;
            font-weight: 800;
            overflow: hidden;
          }
          .photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .photo span {
            padding-bottom: 2mm;
          }
          .verify {
            position: absolute;
            right: 25mm;
            bottom: 16mm;
            font-family: "Sora", Arial, sans-serif;
            font-size: 8.5px;
            color: #333;
            text-align: right;
            max-width: 82mm;
          }
          @media print {
            body { background: white; }
            .sheet { padding: 0; }
            .certificate { width: 297mm; height: 210mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="no-print"><button onclick="window.print()">Save as PDF / Print</button></div>
          <main class="certificate">
            <div class="corner corner-tl"></div>
            <div class="corner corner-tr"></div>
            <div class="corner corner-bl"></div>
            <div class="corner corner-br"></div>
            <div class="watermark"></div>
            <div class="content">
              <section class="header">
                <div class="top-block">
                  <div class="km">ក្រសួងអប់រំ យុវជន និង កីឡា</div>
                  <div>Ministry of Education, Youth and Sports</div>
                </div>
                <div class="center-logo">
                  <img class="logo" src="${escapeHtml(UNIVERSITY_LOGO_URL)}" alt="University logo" />
                </div>
                <div class="top-block">
                  <div class="km">ព្រះរាជាណាចក្រកម្ពុជា</div>
                  <div>Kingdom of Cambodia</div>
                </div>
              </section>

              <section class="title">
                <h1 class="title-kh">បរិញ្ញាបត្រ</h1>
                <div class="title-en">${escapeHtml(degreeName)}</div>
                <div class="university">
                  ${escapeHtml(UNIVERSITY_NAME_KM)}
                  <span class="university-en">${escapeHtml(UNIVERSITY_NAME_EN)}</span>
                </div>
              </section>

              <section class="body">
                <div class="en">
                  <h2>The Minister of Education, Youth and Sports</h2>
                  <p>
                    certifies that the student named below has satisfied the requirements
                    of the university and is awarded this official certificate.
                  </p>
                  <div class="line"><span class="label">Name</span><span class="value">${studentName}</span></div>
                  <div class="line"><span class="label">Award</span><span class="value">${certificateTitle}</span></div>
                  <div class="line"><span class="label">Issued on</span><span class="value">${issueDate}</span></div>
                  <p>This certificate is presented with all rights and privileges thereto pertaining.</p>
                </div>
                <div class="kh">
                  <h2>រដ្ឋមន្ត្រីក្រសួងអប់រំ យុវជន និង កីឡា</h2>
                  <p>
                    សូមបញ្ជាក់ថា និស្សិតមានឈ្មោះដូចខាងក្រោម បានបំពេញលក្ខខណ្ឌរបស់សាកលវិទ្យាល័យ
                    និងត្រូវបានប្រគល់វិញ្ញាបនបត្រនេះ។
                  </p>
                  <div class="line"><span class="label">ឈ្មោះ</span><span class="value">${studentNameKm}</span></div>
                  <div class="line"><span class="label">ថ្ងៃខែឆ្នាំកំណើត</span><span class="value">${dateOfBirthKh}</span></div>
                  <div class="line"><span class="label">ជំនាញ/កម្មវិធី</span><span class="value">${programKh}</span></div>
                  <div class="line"><span class="label">កាលបរិច្ឆេទ</span><span class="value">${issueDateKh}</span></div>
                  <p>វិញ្ញាបនបត្រនេះត្រូវបានផ្តល់ជូនជាផ្លូវការ ដោយមានសិទ្ធិ និងអត្ថប្រយោជន៍ពាក់ព័ន្ធ។</p>
                </div>
              </section>

              <section class="footer">
                <div class="sign">
                  <div class="date">Phnom Penh, ${issueDate}</div>
                  <div class="stamp-space"></div>
                </div>
                <div class="photo">${studentPhoto}</div>
                <div class="sign">
                  <div class="date">Phnom Penh, ${issueDate}</div>
                  <div class="stamp-space"></div>
                </div>
              </section>
              <div class="serial">No: ${serial}</div>
              <div class="verify">Verification code: ${verificationCode}</div>
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
        .select(
          "id,kind,title,issue_date,verification_code,status,students(full_name,full_name_km,avatar_url,date_of_birth,major)",
        )
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
              <button
                type="button"
                onClick={() => printCertificate(c)}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Printer className="h-3.5 w-3.5" />
                Print certificate
              </button>
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
          full_name_km?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          major?: string | null;
        }>("studentsphere.demo.students").map((s) => ({
          id: s.id,
          full_name: s.full_name_en || s.full_name,
          full_name_km: s.full_name_km ?? null,
          avatar_url: s.avatar_url ?? null,
          date_of_birth: s.date_of_birth ?? null,
          major: s.major ?? null,
        }));
      }

      const { data } = await supabase
        .from("students")
        .select("id,full_name,full_name_km,avatar_url,date_of_birth,major")
        .order("full_name");
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
            students: student
              ? {
                  full_name: student.full_name,
                  full_name_km: student.full_name_km ?? null,
                  avatar_url: student.avatar_url ?? null,
                  date_of_birth: student.date_of_birth ?? null,
                  major: student.major ?? null,
                }
              : null,
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
