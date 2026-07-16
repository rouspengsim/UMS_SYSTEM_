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

export function isMasterProgram(major: string | null | undefined) {
  const value = major ?? "";
  return value.includes("បរិញ្ញាបត្រជាន់ខ្ពស់") || value.toLowerCase().includes("master of");
}

export function tuitionRateForMajor(major: string | null | undefined) {
  return isMasterProgram(major) ? MASTER_TUITION : BACHELOR_TUITION;
}

export function tuitionPaymentOptions(major: string | null | undefined) {
  const rate = tuitionRateForMajor(major);
  return [
    { value: "not_yet", label: "មិនទាន់បង់" },
    { value: "semester_300", label: `បង់ ១ឆមាស - $${rate.semester}` },
    { value: "full_year_580", label: `បង់ ១ឆ្នាំ - $${rate.year}` },
  ];
}

export function tuitionPaymentPrice(
  value: string | null | undefined,
  major: string | null | undefined,
) {
  const rate = tuitionRateForMajor(major);
  if (value === "semester_300" || value === "semester1_300" || value === "semester2_300") {
    return `$${rate.semester}`;
  }
  if (value === "full_year_580") return `$${rate.year}`;
  if (value === "semester1_2_600") return `$${rate.semester * 2}`;
  return "$0";
}

export function tuitionPaymentLabel(
  value: string | null | undefined,
  major: string | null | undefined,
) {
  if (value === "semester1_300") return `បង់ឆមាសទី១ - ${tuitionPaymentPrice(value, major)}`;
  if (value === "semester2_300") return `បង់ឆមាសទី២ - ${tuitionPaymentPrice(value, major)}`;
  if (value === "semester1_2_600") return `បង់ឆមាសទី១ + ទី២ - ${tuitionPaymentPrice(value, major)}`;
  return (
    tuitionPaymentOptions(major).find((option) => option.value === value)?.label ?? value ?? "—"
  );
}
