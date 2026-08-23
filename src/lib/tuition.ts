export type TuitionRate = {
  semester: number;
  year: number;
};

const BACHELOR_TUITION: TuitionRate = {
  semester: 300,
  year: 580,
};

const MASTER_TUITION: TuitionRate = {
  semester: 600,
  year: 1150,
};

const SCHOLARSHIP_TUITION: TuitionRate = {
  semester: 6.25,
  year: 12.5,
};

export function isMasterProgram(major: string | null | undefined) {
  const value = major ?? "";
  return value.includes("បរិញ្ញាបត្រជាន់ខ្ពស់") || value.toLowerCase().includes("master of");
}

export function isScholarshipStudent(studentType: string | null | undefined) {
  const value = studentType?.trim().toLowerCase() ?? "";
  return value.includes("អាហារូបកណ៍") || value.includes("scholarship");
}

export function tuitionRateForMajor(
  major: string | null | undefined,
  studentType?: string | null | undefined,
) {
  if (isScholarshipStudent(studentType)) return SCHOLARSHIP_TUITION;
  return isMasterProgram(major) ? MASTER_TUITION : BACHELOR_TUITION;
}

function formatTuitionAmount(amount: number) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function tuitionPaymentOptions(
  major: string | null | undefined,
  studentType?: string | null | undefined,
) {
  const rate = tuitionRateForMajor(major, studentType);
  if (isScholarshipStudent(studentType)) {
    return [
      { value: "not_yet", label: "មិនទាន់បង់" },
      { value: "full_year_580", label: `បង់ ១ឆ្នាំ - ${formatTuitionAmount(rate.year)}` },
    ];
  }

  return [
    { value: "not_yet", label: "មិនទាន់បង់" },
    { value: "semester_300", label: `បង់ ១ឆមាស - ${formatTuitionAmount(rate.semester)}` },
    { value: "full_year_580", label: `បង់ ១ឆ្នាំ - ${formatTuitionAmount(rate.year)}` },
  ];
}

export function tuitionPaymentPrice(
  value: string | null | undefined,
  major: string | null | undefined,
  studentType?: string | null | undefined,
) {
  const rate = tuitionRateForMajor(major, studentType);
  if (
    isScholarshipStudent(studentType) &&
    (value === "paid" ||
      value === "semester_300" ||
      value === "semester1_300" ||
      value === "semester2_300" ||
      value === "semester1_2_600" ||
      value === "full_year_580")
  ) {
    return formatTuitionAmount(rate.year);
  }

  if (value === "semester_300" || value === "semester1_300" || value === "semester2_300") {
    return formatTuitionAmount(rate.semester);
  }
  if (value === "full_year_580") return formatTuitionAmount(rate.year);
  if (value === "semester1_2_600") return formatTuitionAmount(rate.semester * 2);
  return "$0";
}

export function tuitionPaymentLabel(
  value: string | null | undefined,
  major: string | null | undefined,
  studentType?: string | null | undefined,
) {
  if (
    isScholarshipStudent(studentType) &&
    (value === "paid" ||
      value === "semester_300" ||
      value === "semester1_300" ||
      value === "semester2_300" ||
      value === "semester1_2_600")
  ) {
    return `បង់ ១ឆ្នាំ - ${tuitionPaymentPrice("full_year_580", major, studentType)}`;
  }

  if (value === "semester1_300") {
    return `បង់ឆមាសទី១ - ${tuitionPaymentPrice(value, major, studentType)}`;
  }
  if (value === "semester2_300") {
    return `បង់ឆមាសទី២ - ${tuitionPaymentPrice(value, major, studentType)}`;
  }
  if (value === "semester1_2_600") {
    return `បង់ឆមាសទី១ + ទី២ - ${tuitionPaymentPrice(value, major, studentType)}`;
  }
  return (
    tuitionPaymentOptions(major, studentType).find((option) => option.value === value)?.label ??
    value ??
    "—"
  );
}
