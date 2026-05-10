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

export const DEMO_SUBJECTS_KEY = "studentsphere.demo.subjects";

export const DEFAULT_SUBJECT_OPTIONS: SubjectOption[] = [
  { code: "General_Culture", label: "General Culture" },
  { code: "C_Programming", label: "C Programming" },
  { code: "Multimedia_and_Design_1", label: "Multimedia and Design 1" },
  { code: "Political_Economics", label: "Political Economics" },
  { code: "Mathematics", label: "Mathematics" },
  { code: "Statistics", label: "Statistics" },
  { code: "Microsoft_Office", label: "Microsoft Office" },
  { code: "Multimedia_and_Design_2", label: "Multimedia and Design 2" },
  { code: "English_1", label: "English 1" },
  { code: "English_2", label: "English 2" },
];

export function defaultSubjectRows(): SubjectRecord[] {
  return DEFAULT_SUBJECT_OPTIONS.map((subject, index) => ({
    id: `default-subject-${index + 1}`,
    subject_id: subject.code,
    subject_name: subject.label,
    description: null,
  }));
}

export function subjectRowsToOptions(rows: SubjectRecord[]): SubjectOption[] {
  return rows.map((row) => ({
    code: row.subject_id,
    label: row.subject_name || row.subject_id,
    description: row.description,
  }));
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
