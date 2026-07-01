import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { UNIVERSITY_NAME_EN, UNIVERSITY_NAME_KM } from "@/lib/brand";

export type Lang = "en" | "km";

type Dict = Record<string, { en: string; km: string }>;

const dict: Dict = {
  app_name: { en: UNIVERSITY_NAME_EN, km: UNIVERSITY_NAME_KM },
  language: { en: "Language", km: "ភាសា" },
  english: { en: "English", km: "អង់គ្លេស" },
  khmer: { en: "Khmer", km: "ខ្មែរ" },
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
  attendance_subtitle: {
    en: "Record attendance by semester and subject",
    km: "កត់ត្រាវត្តមានតាមឆមាស និងមុខវិជ្ជា",
  },
  exams: { en: "Exams & Scores", km: "ការប្រឡង" },
  exams_subtitle: {
    en: "All scheduled exams across classes",
    km: "ការប្រឡងទាំងអស់តាមថ្នាក់",
  },
  exam: { en: "Exam", km: "ការប្រឡង" },
  result_list: { en: "Result List", km: "បញ្ជីលទ្ធផល" },
  exam_type: { en: "Type", km: "ប្រភេទ" },
  date: { en: "Date", km: "កាលបរិច្ឆេទ" },
  max_score: { en: "Max", km: "ពិន្ទុអតិបរមា" },
  rank: { en: "Rank", km: "ចំណាត់ថ្នាក់" },
  average: { en: "Average", km: "មធ្យមភាគ" },
  group: { en: "Group", km: "ក្រុម" },
  timetable: { en: "Timetable", km: "កាលវិភាគ" },
  payments: { en: "Payments", km: "ការទូទាត់" },
  reports: { en: "Reports", km: "របាយការណ៍" },
  notifications: { en: "Notifications", km: "ការជូនដំណឹង" },
  announcements_alerts: { en: "Announcements and alerts", km: "សេចក្ដីជូនដំណឹង និងការព្រមាន" },
  announce: { en: "Announce", km: "ជូនដំណឹង" },
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
  everyone: { en: "Everyone", km: "ទាំងអស់គ្នា" },
  all_majors: { en: "All majors", km: "ជំនាញទាំងអស់" },
  all_classes: { en: "All classes", km: "ថ្នាក់ទាំងអស់" },
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
  subject: { en: "Subject", km: "មុខវិជ្ជា" },
  select_subject: { en: "Select a subject for this class.", km: "ជ្រើសរើសមុខវិជ្ជាសម្រាប់ថ្នាក់នេះ។" },
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
  account_type: { en: "Account type", km: "ប្រភេទគណនី" },
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
  video: { en: "Video", km: "វីដេអូ" },
  upload: { en: "Upload", km: "បង្ហោះ" },
  close: { en: "Close", km: "បិទ" },
  choose_image: { en: "Choose image", km: "ជ្រើសរើសរូបភាព" },
  upload_profile_image: { en: "Upload profile image", km: "បង្ហោះរូបប្រវត្តិរូប" },
  profile_image_updated: { en: "Profile image updated", km: "បានកែរូបប្រវត្តិរូប" },
  image_upload_hint: {
    en: "JPG, PNG or WebP. The image will be compressed automatically.",
    km: "JPG, PNG ឬ WebP។ រូបភាពនឹងត្រូវបង្រួមដោយស្វ័យប្រវត្តិ។",
  },
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
  no_revenue_yet: { en: "No revenue yet", km: "មិនទាន់មានចំណូល" },
  no_attendance_recorded_yet: {
    en: "No attendance recorded yet",
    km: "មិនទាន់មានកំណត់ត្រាវត្តមាន",
  },
  no_schedule_today: { en: "No schedule for today.", km: "ថ្ងៃនេះមិនមានកាលវិភាគទេ។" },
  no_upcoming_exams: { en: "No upcoming exams.", km: "មិនមានការប្រឡងខាងមុខទេ។" },
  no_classes_today: { en: "No assigned classes today.", km: "ថ្ងៃនេះមិនមានថ្នាក់ដែលបានកំណត់ទេ។" },
  no_assigned_classes: { en: "No classes assigned yet.", km: "មិនទាន់មានថ្នាក់ដែលបានកំណត់។" },
  no_student_records: {
    en: "No students yet. Add one from the Students page.",
    km: "មិនទាន់មានសិស្ស។ បន្ថែមពីទំព័រសិស្ស។",
  },
  no_payments_recorded: { en: "No payments recorded yet.", km: "មិនទាន់មានកំណត់ត្រាការទូទាត់។" },
  filter_by_class: { en: "Filter by class", km: "តម្រងតាមថ្នាក់" },
  new_announcement: { en: "New announcement", km: "សេចក្ដីជូនដំណឹងថ្មី" },
  send_to: { en: "Send to", km: "ផ្ញើទៅ" },
  send_media_notice: {
    en: "Send text, an image, or a video to students or teachers.",
    km: "ផ្ញើអត្ថបទ រូបភាព ឬវីដេអូទៅសិស្ស ឬគ្រូ។",
  },
  title: { en: "Title", km: "ចំណងជើង" },
  title_required: { en: "Title required", km: "ត្រូវការចំណងជើង" },
  message: { en: "Message", km: "សារ" },
  image_or_video: { en: "Image or video", km: "រូបភាព ឬវីដេអូ" },
  choose_image_or_video: { en: "Choose image or video", km: "ជ្រើសរើសរូបភាព ឬវីដេអូ" },
  remove_image: { en: "Remove image", km: "ដករូបភាពចេញ" },
  remove_video: { en: "Remove video", km: "ដកវីដេអូចេញ" },
  kind: { en: "Kind", km: "ប្រភេទ" },
  send: { en: "Send", km: "ផ្ញើ" },
  write_description_media: {
    en: "Write the description shown below the image or video...",
    km: "សរសេរការពិពណ៌នាដែលបង្ហាញក្រោមរូបភាព ឬវីដេអូ...",
  },
  announcement: { en: "Announcement", km: "សេចក្ដីជូនដំណឹង" },
  info: { en: "Info", km: "ព័ត៌មាន" },
  warning: { en: "Warning", km: "ការព្រមាន" },
  success: { en: "Success", km: "ជោគជ័យ" },
  sent: { en: "Sent", km: "បានផ្ញើ" },
  demo_announcement_added: {
    en: "Demo announcement added",
    km: "បានបន្ថែមសេចក្ដីជូនដំណឹង Demo",
  },
  media_size_limit: {
    en: "Image or video must be smaller than 25 MB.",
    km: "រូបភាព ឬវីដេអូ ត្រូវតែតូចជាង 25 MB។",
  },
  session_expired_login: {
    en: "Your session expired. Please log in again.",
    km: "Session របស់អ្នកផុតកំណត់។ សូមចូលម្តងទៀត។",
  },
  admin_session_expired_login: {
    en: "Your admin session expired. Please log in again.",
    km: "Session អ្នកគ្រប់គ្រងផុតកំណត់។ សូមចូលម្តងទៀត។",
  },
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
  cancelled: { en: "Cancelled", km: "បានបោះបង់" },
  graduated: { en: "Graduated", km: "បានបញ្ចប់ការសិក្សា" },
  suspended: { en: "Suspended", km: "បានផ្អាក" },
  present: { en: "Present", km: "មាន" },
  absent: { en: "Absent", km: "អវត្តមាន" },
  late: { en: "Late", km: "យឺត" },
  excused: { en: "Excused", km: "មានច្បាប់" },

  // Login
  welcome_back: { en: "Welcome back", km: "សូមស្វាគមន៍" },
  sign_in_to: { en: "Sign in to your account", km: "ចូលគណនីរបស់អ្នក" },
  email: { en: "Email", km: "អ៊ីមែល" },
  password: { en: "Password", km: "ពាក្យសម្ងាត់" },
  sign_in: { en: "Sign in", km: "ចូល" },
  admin_sign_in: { en: "Admin sign in", km: "ចូលជាអ្នកគ្រប់គ្រង" },
  create_your_account: { en: "Create your account", km: "បង្កើតគណនីរបស់អ្នក" },
  admin_restricted_access: {
    en: "Restricted access for authorized administrators.",
    km: "សម្រាប់អ្នកគ្រប់គ្រងដែលមានសិទ្ធិប៉ុណ្ណោះ។",
  },
  use_issued_account: {
    en: "Use the real ID and password issued by the admin.",
    km: "ប្រើលេខសម្គាល់ និងពាក្យសម្ងាត់ដែលអ្នកគ្រប់គ្រងបានផ្ដល់។",
  },
  first_account_admin: {
    en: "First account becomes admin automatically.",
    km: "គណនីដំបូងនឹងក្លាយជាអ្នកគ្រប់គ្រងដោយស្វ័យប្រវត្តិ។",
  },
  continue_as: { en: "Or quick sign in as", km: "ឬចូលរហ័សជា" },
  admin: { en: "Admin", km: "អ្នកគ្រប់គ្រង" },
  teacher: { en: "Teacher", km: "គ្រូ" },
  student: { en: "Student", km: "សិស្ស" },
  sign_out: { en: "Sign out", km: "ចាកចេញ" },

  // Dashboard
  good_morning: { en: "Good morning", km: "អរុណសួស្តី" },
  welcome: { en: "Welcome", km: "សូមស្វាគមន៍" },
  hello: { en: "Hello", km: "សួស្ដី" },
  signed_in_as: { en: "Signed in as", km: "បានចូលជា" },
  total_students: { en: "Total Students", km: "សិស្សសរុប" },
  total_teachers: { en: "Total Teachers", km: "គ្រូសរុប" },
  active_classes: { en: "Active Classes", km: "ថ្នាក់សកម្ម" },
  revenue: { en: "Revenue", km: "ចំណូល" },
  subjects_mix: { en: "Subjects mix", km: "សមាមាត្រមុខវិជ្ជា" },
  new_students: { en: "New students", km: "សិស្សថ្មី" },
  latest_payments: { en: "Latest payments", km: "ការទូទាត់ថ្មីៗ" },
  quick_start: { en: "Quick start", km: "ចាប់ផ្តើមរហ័ស" },
  demo_mode_active: {
    en: "Demo mode is active. Test the full workflow:",
    km: "Demo mode កំពុងដំណើរការ។ សាកល្បងដំណើរការពេញលេញ៖",
  },
  database_live_start: {
    en: "Your database is live. Start by:",
    km: "Database របស់អ្នកកំពុងដំណើរការ។ ចាប់ផ្តើមដោយ៖",
  },
  add_teachers_step: { en: "Add teachers", km: "បន្ថែមគ្រូ" },
  create_classes_step: { en: "Create classes", km: "បង្កើតថ្នាក់" },
  enroll_students_step: { en: "Enroll students", km: "ចុះឈ្មោះសិស្ស" },
  record_attendance_payments_step: {
    en: "Record attendance & payments",
    km: "កត់ត្រាវត្តមាន និងការទូទាត់",
  },
  attendance_today: { en: "Attendance today", km: "វត្តមានថ្ងៃនេះ" },
  recent_activity: { en: "Recent activity", km: "សកម្មភាពថ្មីៗ" },
  upcoming: { en: "Upcoming", km: "ជិតមកដល់" },
  student_portal: { en: "Student portal", km: "ផតថលសិស្ស" },
  my_information: { en: "My information", km: "ព័ត៌មានខ្ញុំ" },
  view_student_profile: { en: "View student profile", km: "មើលប្រវត្តិសិស្ស" },
  student_portal_subtitle: { en: "Student portal", km: "ផតថលសិស្ស" },
  total_subjects: { en: "Total subjects", km: "មុខវិជ្ជាសរុប" },
  average_score: { en: "Average score", km: "ពិន្ទុមធ្យម" },
  gpa_out_of_4: { en: "GPA / 4.00", km: "GPA / 4.00" },
  attendance_rate: { en: "Attendance rate", km: "អត្រាវត្តមាន" },
  current_fee_status: { en: "Current fee status", km: "ស្ថានភាពបង់ប្រាក់បច្ចុប្បន្ន" },
  today_schedule: { en: "Today's schedule", km: "កាលវិភាគថ្ងៃនេះ" },
  todays_classes_rooms: { en: "Today's classes and rooms", km: "ថ្នាក់ និងបន្ទប់ថ្ងៃនេះ" },
  academic_status: { en: "Academic status", km: "ស្ថានភាពសិក្សា" },
  current_semester_overview: {
    en: "Current semester overview",
    km: "ទិដ្ឋភាពទូទៅនៃឆមាសបច្ចុប្បន្ន",
  },
  view_attendance_history: { en: "View attendance history", km: "មើលប្រវត្តិវត្តមាន" },
  view_payments: { en: "View payments", km: "មើលការបង់ប្រាក់" },
  upcoming_exams: { en: "Upcoming exams", km: "ការប្រឡងខាងមុខ" },
  recent_school_announcements: {
    en: "Recent school announcements",
    km: "សេចក្ដីជូនដំណឹងថ្មីៗពីសាលា",
  },
  teacher_portal: { en: "Teacher portal", km: "ផតថលគ្រូ" },
  focused_teaching_workspace: {
    en: "Focused teaching workspace",
    km: "កន្លែងធ្វើការសម្រាប់ការបង្រៀន",
  },
  assigned_classes: { en: "Assigned classes", km: "ថ្នាក់ដែលបានកំណត់" },
  todays_teaching_schedule: {
    en: "Today's teaching schedule",
    km: "កាលវិភាគបង្រៀនថ្ងៃនេះ",
  },
  my_classes: { en: "My classes", km: "ថ្នាក់របស់ខ្ញុំ" },
  teacher_actions: { en: "Teacher actions", km: "សកម្មភាពគ្រូ" },
  view_assigned_classes: { en: "View assigned classes", km: "មើលថ្នាក់ដែលបានកំណត់" },
  record_attendance: { en: "Record attendance", km: "កត់ត្រាវត្តមាន" },
  manage_exams_scores: { en: "Manage exams and scores", km: "គ្រប់គ្រងការប្រឡង និងពិន្ទុ" },
  view_timetable: { en: "View timetable", km: "មើលកាលវិភាគ" },
  announcements: { en: "Announcements", km: "សេចក្ដីជូនដំណឹង" },
  lecturer_tba: { en: "Lecturer TBA", km: "មិនទាន់កំណត់គ្រូ" },
  room_tba: { en: "Room TBA", km: "មិនទាន់កំណត់បន្ទប់" },
  date_tba: { en: "Date TBA", km: "មិនទាន់កំណត់ថ្ងៃ" },
  tba: { en: "TBA", km: "មិនទាន់កំណត់" },
  pending: { en: "Pending", km: "កំពុងរង់ចាំ" },
  no_invoice: { en: "No invoice", km: "មិនទាន់មានវិក្កយបត្រ" },
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
