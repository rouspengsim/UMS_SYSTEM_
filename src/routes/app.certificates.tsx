import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { t as translate, useI18n } from "@/lib/i18n";
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
import { DEFAULT_SUBJECT_OPTIONS, readDemoSubjects, subjectRowsToOptions } from "@/lib/subjects";

export const Route = createFileRoute("/app/certificates")({
  head: () => ({ meta: [{ title: pageTitle("Certificates") }] }),
  component: CertificatesPage,
});

type CertificateRow = {
  id: string;
  student_id?: string | null;
  kind: string;
  title: string;
  issue_date: string;
  verification_code: string;
  status: string;
  students: {
    id?: string | null;
    student_code?: string | null;
    full_name: string;
    full_name_km: string | null;
    avatar_url: string | null;
    date_of_birth: string | null;
    gender?: string | null;
    major: string | null;
    class_name?: string | null;
  } | null;
};

type TranscriptScoreRow = {
  subject_code: string;
  subject_name: string;
  score: number | null;
  max_score: number;
  semester: string;
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

const FALLBACK_TRANSCRIPT_SUBJECTS = [
  { code: "GCS111", name: "វប្បធម៌ទូទៅ" },
  { code: "MAT113", name: "គណិតវិទ្យា" },
  { code: "MSO114", name: "ម៉ៃក្រូសូហ្វអូហ្វីស" },
  { code: "ENG115", name: "ភាសាអង់គ្លេស" },
  { code: "ECO122", name: "សេដ្ឋកិច្ចនយោបាយ" },
  { code: "STA123", name: "ស្ថិតិ" },
  { code: "MMD124", name: "ម៉ាល់ធីមេឌៀ និងឌីហ្សាញ ២" },
  { code: "ENG125", name: "ភាសាអង់គ្លេស" },
  { code: "MMD112", name: "ម៉ាល់ធីមេឌៀ និងឌីហ្សាញ ១" },
  { code: "CPP121", name: "កម្មវិធីភាសា C/C++" },
];

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}

function semesterKhLabel(value: string, fallbackIndex: number) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/\d+/);
  const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  const semesterNumber = match?.[0] ?? String(fallbackIndex + 1);
  const khmerNumber = semesterNumber
    .split("")
    .map((digit) => khmerDigits[Number(digit)] ?? digit)
    .join("");
  return `ឆមាស${khmerNumber}`;
}

function scorePercent(row: TranscriptScoreRow) {
  if (row.score === null) return null;
  if (!row.max_score || row.max_score === 100) return row.score;
  return (row.score / row.max_score) * 100;
}

function fallbackTranscriptRows(): TranscriptScoreRow[] {
  return FALLBACK_TRANSCRIPT_SUBJECTS.map((subject, index) => ({
    subject_code: subject.code,
    subject_name: subject.name,
    score: null,
    max_score: 100,
    semester: index < 4 ? "Semester 1" : "Semester 2",
  }));
}

async function loadTranscriptRows(
  certificate: CertificateRow,
  isDemo: boolean,
): Promise<TranscriptScoreRow[]> {
  const studentId = certificate.student_id || certificate.students?.id;
  if (!studentId) return fallbackTranscriptRows();

  if (isDemo) {
    const subjectNames = new Map(
      subjectRowsToOptions(readDemoSubjects()).map((subject) => [subject.code, subject.label]),
    );
    const rows = readDemoList<{
      student_id: string;
      subject_code: string;
      score: number | null;
      max_score?: number | null;
      semester?: string | null;
    }>("studentsphere.demo.subject_scores")
      .filter((row) => row.student_id === studentId)
      .map((row) => ({
        subject_code: row.subject_code,
        subject_name: subjectNames.get(row.subject_code) || row.subject_code,
        score: row.score,
        max_score: row.max_score ?? 100,
        semester: row.semester || "Semester 1",
      }));
    return rows.length > 0 ? rows : fallbackTranscriptRows();
  }

  const { data, error } = await supabase
    .from("subject_scores")
    .select("subject_code,score,max_score,semester")
    .eq("student_id", studentId)
    .order("semester", { ascending: true })
    .order("subject_code", { ascending: true });
  if (error) throw error;

  const scoreRows = (data ?? []) as Array<{
    subject_code: string;
    score: number | null;
    max_score: number | null;
    semester: string | null;
  }>;
  if (scoreRows.length === 0) return fallbackTranscriptRows();

  const subjectCodes = Array.from(
    new Set(scoreRows.map((row) => row.subject_code).filter(Boolean)),
  );
  const subjectNames = new Map(
    DEFAULT_SUBJECT_OPTIONS.map((subject) => [subject.code, subject.label]),
  );
  if (subjectCodes.length > 0) {
    const { data: subjects } = await supabase
      .from("subjects")
      .select("subject_id,subject_name")
      .in("subject_id", subjectCodes);
    (subjects ?? []).forEach((subject) => {
      subjectNames.set(subject.subject_id, subject.subject_name || subject.subject_id);
    });
  }

  return scoreRows.map((row) => ({
    subject_code: row.subject_code,
    subject_name: subjectNames.get(row.subject_code) || row.subject_code,
    score: row.score,
    max_score: row.max_score ?? 100,
    semester: row.semester || "Semester 1",
  }));
}

async function printCertificate(certificate: CertificateRow, isDemo: boolean) {
  let rows: TranscriptScoreRow[];
  try {
    rows = await loadTranscriptRows(certificate, isDemo);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : translate("unknown_error"));
    rows = fallbackTranscriptRows();
  }

  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    toast.error(translate("allow_popups_certificate"));
    return;
  }

  const studentName = escapeHtml(certificate.students?.full_name || "Student");
  const studentNameKm = escapeHtml(
    certificate.students?.full_name_km || certificate.students?.full_name || "និស្សិត",
  );
  const studentPhoto = certificate.students?.avatar_url
    ? `<img src="${escapeHtml(certificate.students.avatar_url)}" alt="${studentName}" />`
    : `<span>${escapeHtml(translate("photo"))}</span>`;
  const certificateTitle = escapeHtml(certificate.title || certificateKindLabel(certificate.kind));
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
  const className = escapeHtml(
    certificate.students?.class_name || certificate.students?.major || "—",
  );
  const gender = escapeHtml(certificate.students?.gender || "—");
  const studentCode = escapeHtml(certificate.students?.student_code || serial);
  const displayRows = rows.slice(0, 12);
  const scoredRows = displayRows
    .map(scorePercent)
    .filter((score): score is number => score !== null);
  const averageScore =
    scoredRows.length > 0
      ? scoredRows.reduce((sum, score) => sum + score, 0) / scoredRows.length
      : null;
  const firstSemesterValue = displayRows[0]?.semester || "Semester 1";
  const secondSemesterStartIndex = displayRows.findIndex(
    (row) => row.semester !== firstSemesterValue,
  );
  const averageRowIndex = secondSemesterStartIndex >= 0 ? secondSemesterStartIndex : 0;
  let lastSemester = "";
  let semesterIndex = -1;
  const resultRows = displayRows
    .map((row, index) => {
      const percent = scorePercent(row);
      const currentSemester = row.semester || "Semester 1";
      const showSemester = currentSemester !== lastSemester;
      if (showSemester) {
        lastSemester = currentSemester;
        semesterIndex += 1;
      }
      return `
        ${
          showSemester
            ? `<tr class="semester"><td colspan="6">${escapeHtml(semesterKhLabel(currentSemester, semesterIndex))}</td></tr>`
            : ""
        }
        <tr>
          <td class="center">${index + 1}</td>
          <td class="code">${escapeHtml(row.subject_code)}</td>
          <td>${escapeHtml(row.subject_name)}</td>
          <td class="center">3.00</td>
          <td class="center">${formatScore(percent)}</td>
          <td class="center avg">${index === averageRowIndex ? formatScore(averageScore) : ""}</td>
        </tr>
      `;
    })
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${certificateTitle} - ${studentName}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Battambang:wght@400;700;900&family=Moul&family=Sora:wght@500;700;800;900&display=swap");
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            background: #f0f0f0;
            color: #1b1b1b;
            font-family: "Battambang", "Khmer OS Battambang", Arial, sans-serif;
          }
          .sheet { width: 210mm; min-height: 297mm; padding: 2mm; }
          .transcript {
            position: relative;
            width: 206mm;
            min-height: 293mm;
            overflow: hidden;
            background:
              radial-gradient(circle at 50% 42%, rgba(202,158,54,0.12), transparent 40%),
              linear-gradient(180deg, #fbfaf3, #f6f2e7);
            border: 0.8mm solid #151f55;
            box-shadow: inset 0 0 0 1.2mm rgba(255,255,255,0.75), inset 0 0 0 1.55mm rgba(202,158,54,0.85);
            padding: 8mm 9mm 7mm;
          }
          .transcript::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
              repeating-linear-gradient(0deg, rgba(28,40,96,0.045) 0 2px, transparent 2px 15px),
              repeating-linear-gradient(90deg, rgba(202,158,54,0.035) 0 1px, transparent 1px 19px),
              url("${escapeHtml(UNIVERSITY_LOGO_URL)}");
            background-repeat: repeat, no-repeat;
            background-position: center, center 52%;
            background-size: auto, auto, 110mm;
            opacity: 0.62;
            pointer-events: none;
          }
          .transcript::after {
            content: "";
            position: absolute;
            inset: 5mm;
            border: 0.28mm solid rgba(28,40,96,0.55);
            pointer-events: none;
          }
          .content { position: relative; z-index: 1; }
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
          .top {
            text-align: center;
            color: #151f55;
            line-height: 1.45;
          }
          .top::after {
            content: "";
            display: block;
            width: 28mm;
            height: 0.5mm;
            margin: 2mm auto 0;
            background: linear-gradient(90deg, transparent, #b68a2f, transparent);
          }
          .kingdom {
            font-family: "Moul", "Battambang", serif;
            font-size: 13px;
          }
          .motto {
            font-family: "Moul", "Battambang", serif;
            font-size: 11px;
          }
          .profile-grid {
            display: grid;
            grid-template-columns: 62mm 1fr 38mm;
            gap: 8mm;
            align-items: start;
            margin-top: 6mm;
          }
          .left-brand {
            text-align: center;
            color: #151f55;
          }
          .logo { width: 27mm; height: 27mm; object-fit: contain; }
          .university-kh {
            margin-top: 3mm;
            font-family: "Moul", "Battambang", serif;
            font-size: 10.5px;
            line-height: 1.65;
          }
          .serial {
            margin-top: 4mm;
            font-size: 12px;
            text-align: left;
          }
          .doc-title {
            text-align: center;
            margin-top: 26mm;
            color: #1b1b1b;
          }
          .doc-title h1 {
            margin: 0;
            font-family: "Moul", "Battambang", serif;
            font-size: 26px;
            font-weight: 400;
          }
          .doc-title::after {
            content: "";
            display: block;
            width: 34mm;
            height: 0.25mm;
            margin: 2mm auto 0;
            background: #1b1b1b;
            box-shadow: 0 1.2mm 0 -0.95mm #b68a2f;
          }
          .photo {
            width: 36mm;
            height: 45mm;
            border: 0.5mm solid #ffffff;
            outline: 0.25mm solid #b5b5b5;
            background: #0e75bc;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 10px;
          }
          .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .student-block {
            display: grid;
            grid-template-columns: 1fr 72mm;
            gap: 10mm;
            margin-top: 6mm;
            font-size: 13px;
            line-height: 1.75;
          }
          .info-row {
            display: grid;
            grid-template-columns: 34mm 1fr;
            gap: 3mm;
          }
          .label { font-weight: 700; }
          .value { font-weight: 900; }
          .right-note {
            padding-top: 13mm;
            font-size: 12.5px;
            line-height: 1.8;
          }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .scores {
            margin-top: 4mm;
            font-size: 11px;
            background: rgba(255,255,255,0.5);
          }
          th, td {
            border: 0.3mm solid #252525;
            padding: 1.2mm 1.5mm;
            vertical-align: middle;
          }
          th { font-size: 11px; font-weight: 900; text-align: center; }
          thead th { background: rgba(255,255,255,0.7); }
          .center { text-align: center; }
          .code {
            text-align: center;
            font-family: "Times New Roman", serif;
            font-size: 13px;
          }
          .semester td, tr.semester td {
            background: rgba(28,40,96,0.08);
            font-weight: 900;
            text-align: left;
          }
          .bottom {
            display: grid;
            grid-template-columns: 1fr 78mm;
            gap: 8mm;
            margin-top: 4mm;
            align-items: start;
          }
          .grading {
            font-family: "Times New Roman", "Battambang", serif;
            font-size: 10.5px;
            background: rgba(255,255,255,0.35);
          }
          .grading caption {
            caption-side: top;
            border: 0.3mm solid #252525;
            border-bottom: 0;
            font-size: 14px;
            font-weight: 900;
            padding: 1mm;
          }
          .sign-area {
            min-height: 58mm;
            text-align: center;
            font-size: 13px;
            font-weight: 900;
            padding-top: 7mm;
          }
          .stamp {
            width: 38mm;
            height: 38mm;
            margin: 8mm auto 0;
            border: 1mm solid rgba(190, 0, 0, 0.65);
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: rgba(190, 0, 0, 0.72);
            font-family: "Moul", "Battambang", serif;
            font-size: 8px;
            transform: rotate(-8deg);
            box-shadow: inset 0 0 0 1mm rgba(190,0,0,0.18);
          }
          .footer-note {
            margin-top: 4mm;
            border-top: 0.25mm solid rgba(28,40,96,0.55);
            padding-top: 2mm;
            text-align: center;
            color: #1c2860;
            font-size: 10.5px;
          }
          .verify {
            margin-top: 1mm;
            font-family: "Sora", Arial, sans-serif;
            font-size: 7.5px;
            color: #394150;
          }
          @media print {
            body { background: white; }
            .sheet { padding: 0; }
            .transcript { width: 210mm; min-height: 297mm; border-width: 0.6mm; box-shadow: inset 0 0 0 1.1mm rgba(255,255,255,0.75), inset 0 0 0 1.45mm rgba(202,158,54,0.85); }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="no-print"><button onclick="window.print()">${escapeHtml(translate("print_save_pdf"))}</button></div>
          <main class="transcript">
            <div class="content">
              <section class="top">
                <div class="kingdom">ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div class="motto">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </section>

              <section class="profile-grid">
                <div class="left-brand">
                  <img class="logo" src="${escapeHtml(UNIVERSITY_LOGO_URL)}" alt="University logo" />
                  <div class="university-kh">
                    ${escapeHtml(UNIVERSITY_NAME_KM)}<br />
                    និងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច
                  </div>
                  <div class="serial">លេខៈ ${serial}</div>
                </div>
                <div class="doc-title">
                  <h1>ព្រឹត្តិបត្រពិន្ទុ</h1>
                </div>
                <div class="photo">${studentPhoto}</div>
              </section>

              <section class="student-block">
                <div>
                  <div class="info-row"><span class="label">គោត្តនាម និង នាម</span><span class="value">: ${studentNameKm}</span></div>
                  <div class="info-row"><span class="label">ភេទ</span><span class="value">: ${gender}</span></div>
                  <div class="info-row"><span class="label">សញ្ជាតិ</span><span class="value">: ខ្មែរ</span></div>
                  <div class="info-row"><span class="label">អត្តលេខ</span><span class="value">: ${studentCode}</span></div>
                  <div class="info-row"><span class="label">ថ្ងៃខែឆ្នាំកំណើត</span><span class="value">: ${dateOfBirthKh}</span></div>
                  <div class="info-row"><span class="label">ទីកន្លែងកំណើត</span><span class="value">: —</span></div>
                </div>
                <div class="right-note">
                  <div>ដែលកំពុងបន្តការសិក្សាលើមុខជំនាញ</div>
                  <div>ជំនាញ៖ <strong>${programKh}</strong></div>
                  <div>ថ្នាក់៖ <strong>${className}</strong></div>
                  <div>ឆ្នាំសិក្សា៖ <strong>${certificateTitle}</strong></div>
                </div>
              </section>

              <table class="scores">
                <thead>
                  <tr>
                    <th style="width: 17mm">ល.រ</th>
                    <th style="width: 27mm">លេខកូដ</th>
                    <th>មុខវិជ្ជាសិក្សា</th>
                    <th style="width: 30mm">ក្រេឌីត</th>
                    <th style="width: 23mm">ពិន្ទុ</th>
                    <th style="width: 29mm">មធ្យមភាគ</th>
                  </tr>
                </thead>
                <tbody>${resultRows}</tbody>
              </table>

              <section class="bottom">
                <table class="grading">
                  <caption>Grading Systems</caption>
                  <thead><tr><th>Grade</th><th>Marks</th><th>Grade Point</th><th>Meaning</th></tr></thead>
                  <tbody>
                    <tr><td>A</td><td>85%-100%</td><td>4.00</td><td>Excellent</td></tr>
                    <tr><td>B+</td><td>80%-84%</td><td>3.50</td><td>Very Good</td></tr>
                    <tr><td>B</td><td>70%-79%</td><td>3.00</td><td>Good</td></tr>
                    <tr><td>C+</td><td>65%-69%</td><td>2.50</td><td>Fairly Good</td></tr>
                    <tr><td>C</td><td>50%-64%</td><td>2.00</td><td>Fair</td></tr>
                    <tr><td>D</td><td>45%-49%</td><td>1.50</td><td>Poor</td></tr>
                    <tr><td>E</td><td>40%-44%</td><td>1.00</td><td>Very Poor</td></tr>
                    <tr><td>F</td><td>&lt;40%</td><td>0.00</td><td>Failure</td></tr>
                  </tbody>
                </table>
                <div class="sign-area">
                  <div>រាជធានីភ្នំពេញ, ${issueDateKh}</div>
                  <div>ខ.សាកលវិទ្យាធិការ</div>
                  <div>សាកលវិទ្យាធិការរង</div>
                  <div class="stamp">${escapeHtml(UNIVERSITY_NAME_KM)}</div>
                </div>
              </section>
              <div class="footer-note">
                អាសយដ្ឋាន៖ មហាវិថីព្រះមុនីវង្ស រាជធានីភ្នំពេញ &nbsp; Email: rector@rule.edu.kh &nbsp; Website: www.rule.edu.kh
                <div class="verify">Verification code: ${verificationCode} · ${escapeHtml(UNIVERSITY_NAME_EN)} · ${issueDate}</div>
              </div>
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
          "id,student_id,kind,title,issue_date,verification_code,status,students(id,student_code,full_name,full_name_km,avatar_url,date_of_birth,gender,major,class_name)",
        )
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as CertificateRow[];
    },
  });

  return (
    <div>
      <PageHeader
        title={t("certificates")}
        subtitle={t("certificates_subtitle")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("issue_certificate")}
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
            <p className="mt-2 text-sm text-muted-foreground">{t("no_certificates_yet")}</p>
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t("issued")} {c.issue_date}
              </p>
              <button
                type="button"
                onClick={() => void printCertificate(c, isDemo)}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Printer className="h-3.5 w-3.5" />
                {t("print_certificate")}
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
  const { t } = useI18n();
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
          student_code?: string | null;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          major?: string | null;
          class_name?: string | null;
        }>("studentsphere.demo.students").map((s) => ({
          id: s.id,
          student_code: s.student_code ?? null,
          full_name: s.full_name_en || s.full_name,
          full_name_km: s.full_name_km ?? null,
          avatar_url: s.avatar_url ?? null,
          date_of_birth: s.date_of_birth ?? null,
          gender: s.gender ?? null,
          major: s.major ?? null,
          class_name: s.class_name ?? null,
        }));
      }

      const { data } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_km,avatar_url,date_of_birth,gender,major,class_name",
        )
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
            student_id: f.student_id,
            kind: f.kind,
            title: f.title,
            issue_date: new Date().toISOString().slice(0, 10),
            verification_code: `DEMO-${Date.now()}`,
            status: "issued",
            students: student
              ? {
                  id: student.id,
                  student_code: student.student_code ?? null,
                  full_name: student.full_name,
                  full_name_km: student.full_name_km ?? null,
                  avatar_url: student.avatar_url ?? null,
                  date_of_birth: student.date_of_birth ?? null,
                  gender: student.gender ?? null,
                  major: student.major ?? null,
                  class_name: student.class_name ?? null,
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
      toast.success(isDemo ? t("demo_certificate_issued") : t("certificate_issued"));
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
          <h3 className="font-display text-lg font-bold">{t("issue_certificate")}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.student_id || !f.title) return toast.error(t("all_fields_required"));
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("student")} *
            </label>
            <select
              value={f.student_id}
              onChange={(e) => setF({ ...f, student_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">— {t("select")} —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("title")} *
            </label>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder={t("certificate_title_placeholder")}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("type")}
            </label>
            <select
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="completion">{t("completion")}</option>
              <option value="graduation">{t("graduation")}</option>
              <option value="award">{t("award")}</option>
              <option value="participation">{t("participation")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("issue")}
          </button>
        </form>
      </div>
    </div>
  );
}
