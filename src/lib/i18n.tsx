import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { UNIVERSITY_NAME_EN, UNIVERSITY_NAME_KM } from "@/lib/brand";

export type Lang = "en" | "km";

type Dict = Record<string, { en: string; km: string }>;

const dict: Dict = {
  app_name: { en: UNIVERSITY_NAME_EN, km: UNIVERSITY_NAME_KM },
  search_placeholder: {
    en: "Search students, classes, payments…",
    km: "ស្វែងរកសិស្ស ថ្នាក់ ការទូទាត់…",
  },

  // Nav
  dashboard: { en: "Dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
  students: { en: "Students", km: "សិស្ស" },
  teachers: { en: "Teachers", km: "គ្រូបង្រៀន" },
  classes: { en: "Classes", km: "ថ្នាក់រៀន" },
  subjects: { en: "Subjects", km: "មុខវិជ្ជា" },
  attendance: { en: "Attendance", km: "វត្តមាន" },
  exams: { en: "Exams & Scores", km: "ការប្រឡង" },
  timetable: { en: "Timetable", km: "កាលវិភាគ" },
  payments: { en: "Payments", km: "ការទូទាត់" },
  reports: { en: "Reports", km: "របាយការណ៍" },
  notifications: { en: "Notifications", km: "ការជូនដំណឹង" },
  roles: { en: "Roles", km: "តួនាទី" },
  certificates: { en: "Certificates", km: "សញ្ញាបត្រ" },
  settings: { en: "Settings", km: "ការកំណត់" },

  // Common
  add: { en: "Add", km: "បន្ថែម" },
  add_student: { en: "Add student", km: "បន្ថែមសិស្ស" },
  add_teacher: { en: "Add teacher", km: "បន្ថែមគ្រូ" },
  add_class: { en: "Add class", km: "បន្ថែមថ្នាក់" },
  add_subject: { en: "Add subject", km: "បន្ថែមមុខវិជ្ជា" },
  add_time_shift: { en: "Add time shift", km: "បន្ថែមវេនសិក្សា" },
  edit: { en: "Edit", km: "កែប្រែ" },
  edit_subject: { en: "Edit subject", km: "កែប្រែមុខវិជ្ជា" },
  delete: { en: "Delete", km: "លុប" },
  view: { en: "View", km: "មើល" },
  view_all: { en: "View all", km: "មើលទាំងអស់" },
  save: { en: "Save", km: "រក្សាទុក" },
  save_student: { en: "Save student", km: "រក្សាទុកសិស្ស" },
  save_class: { en: "Save class", km: "រក្សាទុកថ្នាក់" },
  save_subject: { en: "Save subject", km: "រក្សាទុកមុខវិជ្ជា" },
  save_time_shift: { en: "Save time shift", km: "រក្សាទុកវេនសិក្សា" },
  cancel: { en: "Cancel", km: "បោះបង់" },
  export: { en: "Export", km: "នាំចេញ" },
  filter: { en: "Filter", km: "តម្រង" },
  all: { en: "All", km: "ទាំងអស់" },
  all_majors: { en: "All majors", km: "ជំនាញទាំងអស់" },
  all_shifts: { en: "All shifts", km: "វេនទាំងអស់" },
  total: { en: "Total", km: "សរុប" },
  male: { en: "Male", km: "ប្រុស" },
  female: { en: "Female", km: "ស្រី" },
  other: { en: "Other", km: "ផ្សេងៗ" },
  morning: { en: "Morning", km: "ព្រឹក" },
  afternoon: { en: "Afternoon", km: "រសៀល" },
  evening: { en: "Evening", km: "ល្ងាច" },
  custom: { en: "Custom", km: "កំណត់ផ្ទាល់ខ្លួន" },
  id: { en: "ID", km: "ល.រ" },
  action: { en: "Action", km: "សកម្មភាព" },
  description: { en: "Description", km: "ការពិពណ៌នា" },
  search: { en: "Search", km: "ស្វែងរក" },
  major: { en: "Major", km: "ជំនាញ" },
  shift: { en: "Shift", km: "វេន" },
  class: { en: "Class", km: "ថ្នាក់" },
  class_name: { en: "Class name", km: "ឈ្មោះថ្នាក់" },
  subject_id: { en: "Subject ID", km: "លេខសម្គាល់មុខវិជ្ជា" },
  subject_name: { en: "Subject name", km: "ឈ្មោះមុខវិជ្ជា" },
  subject_code: { en: "Subject code", km: "លេខកូដមុខវិជ្ជា" },
  room: { en: "Room", km: "បន្ទប់" },
  capacity: { en: "Capacity", km: "ចំនួនអាចទទួល" },
  semester: { en: "Semester", km: "ឆមាស" },
  unassigned: { en: "Unassigned", km: "មិនទាន់កំណត់" },
  select_class: { en: "Select class", km: "ជ្រើសរើសថ្នាក់" },
  day: { en: "Day", km: "ថ្ងៃ" },
  start_time: { en: "Start time", km: "ម៉ោងចាប់ផ្តើម" },
  end_time: { en: "End time", km: "ម៉ោងបញ្ចប់" },
  address: { en: "Address", km: "អាសយដ្ឋាន" },
  status: { en: "Status", km: "ស្ថានភាព" },
  name: { en: "Name", km: "ឈ្មោះ" },
  english_name: { en: "English name", km: "ឈ្មោះអង់គ្លេស" },
  khmer_name: { en: "Khmer name", km: "ឈ្មោះខ្មែរ" },
  name_in_english: { en: "Name in English", km: "ឈ្មោះជាភាសាអង់គ្លេស" },
  name_in_khmer: { en: "Name in Khmer", km: "ឈ្មោះជាភាសាខ្មែរ" },
  name_in_latin: { en: "Name in Latin", km: "ឈ្មោះជាអក្សរឡាតាំង" },
  student_information: { en: "Student Information", km: "ព័ត៌មាននិស្សិត" },
  gender: { en: "Gender", km: "ភេទ" },
  nationality: { en: "Nationality", km: "សញ្ជាតិ" },
  dob: { en: "DOB", km: "ថ្ងៃខែឆ្នាំកំណើត" },
  place_of_birth: { en: "Place of Birth", km: "ទីកន្លែងកំណើត" },
  father_name: { en: "Father Name", km: "ឈ្មោះឪពុក" },
  father_job: { en: "Father Job", km: "មុខរបរឪពុក" },
  mother_name: { en: "Mother Name", km: "ឈ្មោះម្តាយ" },
  mother_job: { en: "Mother Job", km: "មុខរបរម្តាយ" },
  academic: { en: "Academic", km: "មហាវិទ្យាល័យ" },
  type_of_student: { en: "Type of Student", km: "ប្រភេទនិស្សិត" },
  pay_year1: { en: "PayYear1", km: "បង់ឆ្នាំទី១" },
  pay_year2: { en: "PayYear2", km: "បង់ឆ្នាំទី២" },
  pay_year3: { en: "PayYear3", km: "បង់ឆ្នាំទី៣" },
  pay_year4: { en: "PayYear4", km: "បង់ឆ្នាំទី៤" },
  image: { en: "Image", km: "រូបភាព" },
  year: { en: "Year", km: "ឆ្នាំសិក្សា" },
  phone: { en: "Phone", km: "លេខទូរស័ព្ទ" },
  student_id: { en: "Student ID", km: "លេខសម្គាល់សិស្ស" },
  students_in_class: { en: "Students in", km: "សិស្សក្នុងថ្នាក់" },
  total_students_in_class: { en: "total students", km: "សិស្សសរុប" },
  enrolled: { en: "Enrolled", km: "បានចុះឈ្មោះ" },
  no_students_yet: { en: "No students yet.", km: "មិនទាន់មានសិស្ស។" },
  no_classes_yet: {
    en: "No classes match this filter yet.",
    km: "មិនទាន់មានថ្នាក់ត្រូវនឹងតម្រងនេះ។",
  },
  no_subjects_yet: { en: "No subjects yet.", km: "មិនទាន់មានមុខវិជ្ជា។" },
  no_timetable_yet: { en: "No timetable slots yet.", km: "មិនទាន់មានកាលវិភាគ។" },
  no_notifications_yet: { en: "No notifications yet", km: "មិនទាន់មានការជូនដំណឹង" },
  search_students: {
    en: "Search by ID, name, major, or class…",
    km: "ស្វែងរកតាមលេខសម្គាល់ ឈ្មោះ ជំនាញ ឬថ្នាក់…",
  },
  search_subjects: {
    en: "Search by subject ID, name, or description…",
    km: "ស្វែងរកតាមលេខសម្គាល់ ឈ្មោះ ឬការពិពណ៌នា…",
  },
  sort_filter_major: { en: "Sort / filter by major", km: "តម្រៀប / តម្រងតាមជំនាញ" },
  showing: { en: "Showing", km: "កំពុងបង្ហាញ" },
  of: { en: "of", km: "នៃ" },
  quick_add: { en: "Quick Add", km: "បន្ថែមរហ័ស" },
  create_student_profile: { en: "Create a new student profile", km: "បង្កើតប្រវត្តិសិស្សថ្មី" },
  add_faculty_member: { en: "Add a faculty member", km: "បន្ថែមគ្រូបង្រៀន" },
  create_class_assign_teacher: {
    en: "Create a class and assign a teacher",
    km: "បង្កើតថ្នាក់ និងកំណត់គ្រូ",
  },
  add_timetable_slot: { en: "Add a timetable slot", km: "បន្ថែមម៉ោងកាលវិភាគ" },
  light_mode: { en: "Light", km: "ភ្លឺ" },
  dark_mode: { en: "Dark", km: "ងងឹត" },
  open: { en: "Open", km: "បើក" },
  customize_workspace: {
    en: "Customize your workspace, themes, and roles.",
    km: "កំណត់កន្លែងធ្វើការ រូបរាង និងតួនាទី។",
  },
  active: { en: "Active", km: "សកម្ម" },
  inactive: { en: "Inactive", km: "អសកម្ម" },
  paid: { en: "Paid", km: "បានបង់" },
  unpaid: { en: "Unpaid", km: "មិនទាន់បង់" },
  overdue: { en: "Overdue", km: "ហួសកាល" },
  present: { en: "Present", km: "មាន" },
  absent: { en: "Absent", km: "អវត្តមាន" },
  late: { en: "Late", km: "យឺត" },

  // Login
  welcome_back: { en: "Welcome back", km: "សូមស្វាគមន៍" },
  sign_in_to: { en: "Sign in to your account", km: "ចូលគណនីរបស់អ្នក" },
  email: { en: "Email", km: "អ៊ីមែល" },
  password: { en: "Password", km: "ពាក្យសម្ងាត់" },
  sign_in: { en: "Sign in", km: "ចូល" },
  continue_as: { en: "Or quick sign in as", km: "ឬចូលរហ័សជា" },
  admin: { en: "Admin", km: "អ្នកគ្រប់គ្រង" },
  teacher: { en: "Teacher", km: "គ្រូ" },
  student: { en: "Student", km: "សិស្ស" },
  sign_out: { en: "Sign out", km: "ចាកចេញ" },

  // Dashboard
  good_morning: { en: "Good morning", km: "អរុណសួស្តី" },
  total_students: { en: "Total Students", km: "សិស្សសរុប" },
  total_teachers: { en: "Total Teachers", km: "គ្រូសរុប" },
  active_classes: { en: "Active Classes", km: "ថ្នាក់សកម្ម" },
  revenue: { en: "Revenue", km: "ចំណូល" },
  attendance_today: { en: "Attendance today", km: "វត្តមានថ្ងៃនេះ" },
  recent_activity: { en: "Recent activity", km: "សកម្មភាពថ្មីៗ" },
  upcoming: { en: "Upcoming", km: "ជិតមកដល់" },
  students_subtitle: {
    en: "Manage enrollment, profiles, and history",
    km: "គ្រប់គ្រងការចុះឈ្មោះ ប្រវត្តិ និងព័ត៌មានសិស្ស",
  },
  classes_subtitle: {
    en: "Subjects, rooms, and assigned teachers",
    km: "មុខវិជ្ជា បន្ទប់ និងគ្រូដែលបានកំណត់",
  },
  subjects_subtitle: {
    en: "Create and manage the subject list used across classes and attendance",
    km: "បង្កើត និងគ្រប់គ្រងបញ្ជីមុខវិជ្ជាសម្រាប់ថ្នាក់ និងវត្តមាន",
  },
  subject_created: { en: "Subject created", km: "បានបង្កើតមុខវិជ្ជា" },
  subject_updated: { en: "Subject updated", km: "បានកែប្រែមុខវិជ្ជា" },
  subject_deleted: { en: "Subject deleted", km: "បានលុបមុខវិជ្ជា" },
  subject_id_exists: { en: "Subject ID already exists", km: "លេខសម្គាល់មុខវិជ្ជាមានរួចហើយ" },
  timetable_subtitle: {
    en: "Weekly schedule across all classes",
    km: "កាលវិភាគប្រចាំសប្តាហ៍សម្រាប់ថ្នាក់ទាំងអស់",
  },
};

export function t(key: keyof typeof dict | string, lang: Lang): string {
  const entry = dict[key as keyof typeof dict];
  if (!entry) return key;
  return entry[lang];
}

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const Ctx = createContext<LangCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" &&
      localStorage.getItem("ums.lang")) as Lang | null;
    if (saved === "en" || saved === "km") setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ums.lang", l);
  };

  return <Ctx.Provider value={{ lang, setLang, t: (k) => t(k, lang) }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
