function envText(key: string, fallback: string) {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function envList(key: string, fallback: string[]) {
  const value = import.meta.env[key];
  if (typeof value !== "string") return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

export const UNIVERSITY_LOGO_URL = envText(
  "VITE_INSTITUTION_LOGO_URL",
  "https://ddprule.org/wp-content/uploads/2024/08/416-4168713_logo-of-rule-cambodia-royal-university-of-law.png",
);
export const UNIVERSITY_NAME_EN = envText(
  "VITE_INSTITUTION_NAME_EN",
  "Royal University of Law and Economics",
);
export const UNIVERSITY_NAME_KM = envText(
  "VITE_INSTITUTION_NAME_KM",
  "សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្ត្រ និងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច",
);
export const UNIVERSITY_SHORT_NAME = envText("VITE_INSTITUTION_SHORT_NAME", "RULE");
export const UNIVERSITY_FULL_NAME = envText(
  "VITE_INSTITUTION_FULL_NAME",
  `${UNIVERSITY_NAME_KM} (${UNIVERSITY_NAME_EN})`,
);
export const UNIVERSITY_SYSTEM_NAME = envText(
  "VITE_SYSTEM_NAME",
  "University Management System",
);
export const UNIVERSITY_HERO_SUBTITLE = envText(
  "VITE_HERO_SUBTITLE",
  "ប្រព័ន្ធឌីជីថលសម្រាប់គ្រប់គ្រងសាកលវិទ្យាល័យ",
);
export const UNIVERSITY_ACCOUNT_DOMAIN = envText(
  "VITE_ACCOUNT_EMAIL_DOMAIN",
  "studentsphere.local",
);
export const UNIVERSITY_HERO_IMAGES = envList("VITE_HERO_IMAGE_URLS", [
  "https://ddprule.org/wp-content/uploads/2023/07/AB6A0964-scaled.jpg",
  "https://ddprule.org/wp-content/uploads/2020/06/law1-1.jpg",
]);

export function pageTitle(title: string) {
  return `${title} — ${UNIVERSITY_SHORT_NAME}`;
}
