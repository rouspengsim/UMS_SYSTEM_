import { CURRICULUM_SUBJECT_OPTIONS } from "./curriculum-subjects";

export type SubjectRecord = {
  id: string;
  subject_id: string;
  subject_name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SubjectOption = {
  code: string;
  label: string;
  description?: string | null;
};

export type SubjectOptionGroup = {
  label: string;
  options: SubjectOption[];
};

export const DEMO_SUBJECTS_KEY = "studentsphere.demo.subjects";
const OTHER_SUBJECT_GROUP = "មុខវិជ្ជាផ្សេងៗ";

export const DEFAULT_SUBJECT_OPTIONS: SubjectOption[] = CURRICULUM_SUBJECT_OPTIONS;

export function defaultSubjectRows(): SubjectRecord[] {
  return DEFAULT_SUBJECT_OPTIONS.map((subject, index) => ({
    id: `default-subject-${index + 1}`,
    subject_id: subject.code,
    subject_name: subject.label,
    description: null,
  }));
}

export function mergeSubjectRows(rows: SubjectRecord[]): SubjectRecord[] {
  const byCode = new Map<string, SubjectRecord>();

  defaultSubjectRows().forEach((subject) => {
    byCode.set(subject.subject_id, subject);
  });
  rows.forEach((subject) => {
    if (!byCode.has(subject.subject_id)) byCode.set(subject.subject_id, subject);
  });

  return Array.from(byCode.values());
}

export function subjectRowsToOptions(rows: SubjectRecord[]): SubjectOption[] {
  return rows.map((row) => ({
    code: row.subject_id,
    label: row.subject_name || row.subject_id,
    description: row.description,
  }));
}

export function mergeSubjectOptions(options: SubjectOption[]): SubjectOption[] {
  const byCode = new Map<string, SubjectOption>();

  DEFAULT_SUBJECT_OPTIONS.forEach((subject) => {
    byCode.set(subject.code, subject);
  });
  options.forEach((subject) => {
    if (!byCode.has(subject.code)) byCode.set(subject.code, subject);
  });

  return Array.from(byCode.values());
}

function curriculumMajorName(major: string | null | undefined) {
  return (major ?? "").split(" - ")[0]?.trim() ?? "";
}

function isCurriculumDescription(description: string | null | undefined) {
  return !!description && description.includes(" / ") && description.includes("បរិញ្ញាបត្រ");
}

export function subjectDescriptionMajorName(description: string | null | undefined) {
  if (!isCurriculumDescription(description)) return "";

  const [, program] =
    description
      ?.split(" / ")
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  return program || "";
}

function subjectMajorGroupLabel(subject: SubjectOption) {
  return subjectDescriptionMajorName(subject.description) || OTHER_SUBJECT_GROUP;
}

export function groupSubjectOptionsByMajor(options: SubjectOption[]): SubjectOptionGroup[] {
  const groups = new Map<string, SubjectOption[]>();

  options.forEach((subject) => {
    const label = subjectMajorGroupLabel(subject);
    groups.set(label, [...(groups.get(label) ?? []), subject]);
  });

  return Array.from(groups.entries()).map(([label, groupedOptions]) => ({
    label,
    options: groupedOptions,
  }));
}

export function shortSubjectDescription(description: string | null | undefined) {
  const text = description?.trim();
  if (!text) return "-";

  const parts = text
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 4) {
    const [, program, year, semester] = parts;
    const yearShort = year.replace("ឆ្នាំទី", "ឆ្នាំ");
    const semesterShort = semester.replace("ឆមាសទី", "ឆមាស");
    return `${program} · ${yearShort} · ${semesterShort}`;
  }

  if (text.length <= 42) return text;
  return `${text.slice(0, 39).trimEnd()}...`;
}

export function shortSubjectName(name: string | null | undefined) {
  const text = name?.trim();
  if (!text) return "-";
  if (text.length <= 32) return text;
  return `${text.slice(0, 29).trimEnd()}...`;
}

export function subjectPlacementLabel(description: string | null | undefined) {
  const text = description?.trim();
  if (!text) return "-";

  const parts = text
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 4) {
    const [, , year, semester] = parts;
    return `${semester} · ${year}`;
  }

  return shortSubjectDescription(text);
}

export function filterSubjectOptionsByMajor(
  options: SubjectOption[],
  major: string | null | undefined,
) {
  const majorName = curriculumMajorName(major);
  if (!majorName || majorName === "all") return options;

  let matchingCurriculumCount = 0;
  const filtered = options.filter((subject) => {
    if (!isCurriculumDescription(subject.description)) return true;
    const matches = subject.description?.includes(majorName) ?? false;
    if (matches) matchingCurriculumCount += 1;
    return matches;
  });

  return matchingCurriculumCount > 0 ? filtered : options;
}

export function readDemoSubjects(): SubjectRecord[] {
  if (typeof window === "undefined") return defaultSubjectRows();
  try {
    const raw = localStorage.getItem(DEMO_SUBJECTS_KEY);
    return raw ? (JSON.parse(raw) as SubjectRecord[]) : defaultSubjectRows();
  } catch {
    return defaultSubjectRows();
  }
}

export function writeDemoSubjects(subjects: SubjectRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_SUBJECTS_KEY, JSON.stringify(subjects));
}
