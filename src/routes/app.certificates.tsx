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
import {
  DEFAULT_SUBJECT_OPTIONS,
  filterSubjectOptionsByScope,
  readDemoSubjects,
  subjectDescriptionSemesterNumber,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { normalizeMajorLabel } from "@/lib/academic-options";
import { formatDateDisplay } from "@/lib/utils";

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
    enrollment_year?: number | null;
    study_year?: number | null;
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
  return formatDateDisplay(value);
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

function khmerGenderLabel(gender: string | null | undefined) {
  const normalized = gender?.trim().toLowerCase() ?? "";
  if (["male", "m", "ប្រុស"].includes(normalized)) return "ប្រុស";
  if (["female", "f", "ស្រី"].includes(normalized)) return "ស្រី";
  return gender || "—";
}

function academicYearLabel(enrollmentYear: number | null | undefined, issueDate: string) {
  const issueYear = new Date(`${issueDate}T00:00:00`).getFullYear();
  const year =
    Number(enrollmentYear) || (Number.isFinite(issueYear) ? issueYear : new Date().getFullYear());
  return `${year}-${year + 1}`;
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

const TRANSCRIPT_SUBJECT_LIMIT = 12;

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}

function shortSubjectCode(code: string) {
  const normalized = code.trim();
  const curriculumMatch = normalized.match(/^CURR_SUBJECT_(\d+)$/i);
  if (curriculumMatch) return `S${curriculumMatch[1]}`;
  if (normalized.length <= 8) return normalized;
  return normalized
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
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

function curriculumTranscriptRows(certificate: CertificateRow): TranscriptScoreRow[] {
  const subjects = filterSubjectOptionsByScope(DEFAULT_SUBJECT_OPTIONS, {
    major: certificate.students?.major,
    studyYear: certificate.students?.study_year,
  }).slice(0, TRANSCRIPT_SUBJECT_LIMIT);

  if (subjects.length < 4) return fallbackTranscriptRows();

  return subjects.map((subject, index) => {
    const semester = subjectDescriptionSemesterNumber(subject.description);
    return {
      subject_code: subject.code,
      subject_name: subject.label,
      score: null,
      max_score: 100,
      semester: semester ? `Semester ${semester}` : index < 6 ? "Semester 1" : "Semester 2",
    };
  });
}

function mergeTranscriptRowsWithScores(
  baseRows: TranscriptScoreRow[],
  scoreRows: TranscriptScoreRow[],
) {
  const scoresByCode = new Map(scoreRows.map((row) => [row.subject_code, row]));
  return baseRows.map((row) => {
    const scoreRow = scoresByCode.get(row.subject_code);
    if (!scoreRow) return row;
    return {
      ...row,
      score: scoreRow.score,
      max_score: scoreRow.max_score,
      semester: scoreRow.semester || row.semester,
    };
  });
}

async function loadTranscriptRows(
  certificate: CertificateRow,
  isDemo: boolean,
): Promise<TranscriptScoreRow[]> {
  const studentId = certificate.student_id || certificate.students?.id;
  const curriculumRows = curriculumTranscriptRows(certificate);
  if (!studentId) return curriculumRows;

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
    return mergeTranscriptRowsWithScores(curriculumRows, rows);
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

  const rows = scoreRows.map((row) => ({
    subject_code: row.subject_code,
    subject_name: subjectNames.get(row.subject_code) || row.subject_code,
    score: row.score,
    max_score: row.max_score ?? 100,
    semester: row.semester || "Semester 1",
  }));

  return mergeTranscriptRowsWithScores(curriculumRows, rows);
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
  const issueDateKh = escapeHtml(formatDateDisplay(certificate.issue_date));
  const dateOfBirthKh = certificate.students?.date_of_birth
    ? escapeHtml(formatDateDisplay(certificate.students.date_of_birth))
    : "—";
  const programKh = escapeHtml(
    normalizeMajorLabel(certificate.students?.major) || certificate.title || "កម្មវិធីសិក្សា",
  );
  const verificationCode = escapeHtml(certificate.verification_code);
  const serial = escapeHtml(certificate.verification_code.slice(0, 18).toUpperCase());
  const className = escapeHtml(
    certificate.students?.class_name || normalizeMajorLabel(certificate.students?.major) || "—",
  );
  const gender = escapeHtml(khmerGenderLabel(certificate.students?.gender));
  const academicYear = escapeHtml(
    academicYearLabel(certificate.students?.enrollment_year, certificate.issue_date),
  );
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
          <td class="code">${escapeHtml(shortSubjectCode(row.subject_code))}</td>
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
            background: #e9e9e9;
            color: #111111;
            font-family: "Battambang", "Khmer OS Battambang", Arial, sans-serif;
          }
          .sheet { width: 210mm; min-height: 297mm; padding: 1.5mm; }
          .transcript {
            position: relative;
            width: 207mm;
            min-height: 294mm;
            overflow: hidden;
            background: #ffffff;
            border: 0.7mm solid #121b55;
            box-shadow:
              inset 0 0 0 1.1mm #ffffff,
              inset 0 0 0 1.45mm rgba(18, 27, 85, 0.72),
              inset 0 0 0 2.15mm #ffffff,
              inset 0 0 0 2.35mm rgba(182, 182, 182, 0.95);
            padding: 8mm 9mm 6mm;
          }
          .transcript::before {
            content: "";
            position: absolute;
            inset: 5mm;
            border: 0.28mm solid rgba(178, 178, 178, 0.95);
            background: none;
            background-image: none;
            pointer-events: none;
          }
          .transcript::after {
            content: none;
            background: none;
            background-image: none;
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
            color: #121b55;
            line-height: 1.35;
            min-height: 18mm;
          }
          .top::after { content: none; }
          .kingdom {
            font-family: "Moul", "Battambang", serif;
            font-size: 12.5px;
          }
          .motto {
            font-family: "Moul", "Battambang", serif;
            font-size: 10.5px;
          }
          .profile-grid {
            display: grid;
            grid-template-columns: 60mm 1fr 39mm;
            gap: 7mm;
            align-items: start;
            margin-top: 2mm;
          }
          .left-brand {
            text-align: center;
            color: #121b55;
          }
          .logo { width: 24mm; height: 24mm; object-fit: contain; }
          .university-kh {
            margin-top: 2.5mm;
            font-family: "Moul", "Battambang", serif;
            font-size: 9.5px;
            line-height: 1.7;
          }
          .serial {
            margin-top: 7mm;
            font-size: 10.5px;
            text-align: left;
            color: #121b55;
          }
          .doc-title {
            text-align: center;
            margin-top: 25mm;
            color: #111111;
          }
          .doc-title h1 {
            margin: 0;
            font-family: "Moul", "Battambang", serif;
            font-size: 25px;
            font-weight: 400;
          }
          .doc-title::after {
            content: "";
            display: block;
            width: 31mm;
            height: 0.2mm;
            margin: 1.5mm auto 0;
            background: #111111;
          }
          .photo {
            width: 36mm;
            height: 45mm;
            justify-self: end;
            border: 0.45mm solid #d8d8d8;
            background: #f5f5f5;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #777777;
            font-weight: 700;
            font-size: 10px;
          }
          .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .student-block {
            display: grid;
            grid-template-columns: 1fr 78mm;
            gap: 9mm;
            margin-top: 5mm;
            font-size: 11.5px;
            line-height: 1.72;
          }
          .info-row {
            display: grid;
            grid-template-columns: 36mm 1fr;
            gap: 2mm;
          }
          .label { font-weight: 700; }
          .value { font-weight: 900; }
          .right-note {
            padding-top: 12mm;
            font-size: 11.5px;
            line-height: 1.85;
          }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .scores {
            margin-top: 5mm;
            font-size: 10.4px;
            background: #ffffff;
          }
          th, td {
            border: 0.28mm solid #282828;
            padding: 1.15mm 1.45mm;
            vertical-align: middle;
          }
          th { font-size: 10.6px; font-weight: 900; text-align: center; }
          thead th { background: #ffffff; }
          .center { text-align: center; }
          .code {
            text-align: center;
            font-family: "Times New Roman", serif;
            font-size: 11.5px;
            font-weight: 700;
          }
          .semester td, tr.semester td {
            background: #ffffff;
            font-weight: 900;
            text-align: left;
            padding: 0.9mm 1.45mm;
          }
          .bottom {
            display: grid;
            grid-template-columns: 104mm 1fr;
            gap: 10mm;
            margin-top: 4.5mm;
            align-items: start;
          }
          .grading {
            font-family: "Times New Roman", "Battambang", serif;
            font-size: 9.2px;
            background: #ffffff;
          }
          .grading caption {
            caption-side: top;
            border: 0.28mm solid #282828;
            border-bottom: 0;
            font-size: 12.5px;
            font-weight: 900;
            padding: 0.85mm;
          }
          .sign-area {
            min-height: 54mm;
            text-align: center;
            font-size: 11.5px;
            font-weight: 900;
            padding-top: 8mm;
          }
          .stamp {
            width: 36mm;
            height: 36mm;
            margin: 8.5mm auto 0;
            border: 0.9mm solid rgba(204, 20, 30, 0.55);
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: rgba(204, 20, 30, 0.68);
            font-family: "Moul", "Battambang", serif;
            font-size: 7px;
            transform: rotate(-8deg);
            box-shadow: inset 0 0 0 0.9mm rgba(204, 20, 30, 0.12);
          }
          .footer-note {
            margin-top: 3mm;
            border-top: 0.22mm solid rgba(18, 27, 85, 0.48);
            padding-top: 1.8mm;
            text-align: center;
            color: #121b55;
            font-size: 9px;
          }
          .verify {
            margin-top: 1mm;
            font-family: "Sora", Arial, sans-serif;
            font-size: 7px;
            color: #394150;
          }
          @media print {
            body { background: white; }
            .sheet { padding: 0; }
            .transcript {
              width: 210mm;
              min-height: 297mm;
              border-width: 0.7mm;
            }
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
                    ${escapeHtml(UNIVERSITY_NAME_KM)}
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
                  <div>ឆ្នាំសិក្សា៖ <strong>${academicYear}</strong></div>
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
          "id,student_id,kind,title,issue_date,verification_code,status,students(id,student_code,full_name,full_name_km,avatar_url,date_of_birth,gender,enrollment_year,study_year,major,class_name)",
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
                {t("issued")} {formatDateDisplay(c.issue_date)}
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
          enrollment_year?: number | null;
          study_year?: number | null;
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
          enrollment_year: s.enrollment_year ?? null,
          study_year: s.study_year ?? null,
          major: s.major ?? null,
          class_name: s.class_name ?? null,
        }));
      }

      const { data } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_km,avatar_url,date_of_birth,gender,enrollment_year,study_year,major,class_name",
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
                  enrollment_year: student.enrollment_year ?? null,
                  study_year: student.study_year ?? null,
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
