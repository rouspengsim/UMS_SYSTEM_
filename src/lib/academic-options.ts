export const MAJOR_OPTIONS = [
  {
    group: "១. មហាវិទ្យាល័យនីតិសាស្ត្រ - Faculty of Law (LAW)",
    options: [
      {
        value: "បរិញ្ញាបត្រនីតិសាស្ត្រ - Bachelor of Law (LLB)",
        label: "បរិញ្ញាបត្រនីតិសាស្ត្រ - Bachelor of Law (LLB)",
      },
    ],
  },
  {
    group: "២. មហាវិទ្យាល័យរដ្ឋបាលសាធារណៈ - Faculty of Public Administration (PA)",
    options: [
      {
        value: "បរិញ្ញាបត្ររដ្ឋបាលសាធារណៈ - Bachelor of Public Administration (BPA)",
        label: "បរិញ្ញាបត្ររដ្ឋបាលសាធារណៈ - Bachelor of Public Administration (BPA)",
      },
    ],
  },
  {
    group:
      "៣. មហាវិទ្យាល័យវិទ្យាសាស្ត្រសេដ្ឋកិច្ច និងគ្រប់គ្រង - Faculty of Economics and Management (FEM)",
    options: [
      {
        value: "បរិញ្ញាបត្រធនាគារ និងហិរញ្ញវត្ថុ - Banking and Finance (BF)",
        label: "៣.១ បរិញ្ញាបត្រធនាគារ និងហិរញ្ញវត្ថុ - Banking and Finance (BF)",
      },
      {
        value: "បរិញ្ញាបត្រគណនេយ្យ - Accounting (ACC)",
        label: "៣.២ បរិញ្ញាបត្រគណនេយ្យ - Accounting (ACC)",
      },
      {
        value: "បរិញ្ញាបត្រគ្រប់គ្រងធុរកិច្ច - Business Administration (BA)",
        label: "៣.៣ បរិញ្ញាបត្រគ្រប់គ្រងធុរកិច្ច - Business Administration (BA)",
      },
      {
        value: "បរិញ្ញាបត្រសេដ្ឋកិច្ចអភិវឌ្ឍន៍ - Development Economics (DE)",
        label: "៣.៤ បរិញ្ញាបត្រសេដ្ឋកិច្ចអភិវឌ្ឍន៍ - Development Economics (DE)",
      },
      {
        value:
          "បរិញ្ញាបត្រគ្រប់គ្រងទេសចរណ៍ និងបដិសណ្ឋារកិច្ច - Tourism and Hospitality Management (THM)",
        label:
          "៣.៥ បរិញ្ញាបត្រគ្រប់គ្រងទេសចរណ៍ និងបដិសណ្ឋារកិច្ច - Tourism and Hospitality Management (THM)",
      },
    ],
  },
  {
    group: "៤. មហាវិទ្យាល័យសេដ្ឋកិច្ចព័ត៌មានវិទ្យា - Faculty of Economics Informatics (FEI)",
    options: [
      {
        value: "បរិញ្ញាបត្រសេដ្ឋកិច្ចព័ត៌មានវិទ្យា - Economics Informatics (EI)",
        label: "៤.១ បរិញ្ញាបត្រសេដ្ឋកិច្ចព័ត៌មានវិទ្យា - Economics Informatics (EI)",
      },
      {
        value: "បរិញ្ញាបត្រព័ត៌មានវិទ្យា - Information Technology (IT)",
        label: "៤.២ បរិញ្ញាបត្រព័ត៌មានវិទ្យា - Information Technology (IT)",
      },
    ],
  },
  {
    group: "៥. សាលាក្រោយបរិញ្ញាបត្រ - Graduate School (GS)",
    options: [
      {
        value: "បរិញ្ញាបត្រជាន់ខ្ពស់នីតិសាស្ត្រ ឯកទេសនីតិឯកជន - Master of Private Law (MPL)",
        label: "បរិញ្ញាបត្រជាន់ខ្ពស់នីតិសាស្ត្រ ឯកទេសនីតិឯកជន - Master of Private Law (MPL)",
      },
      {
        value:
          "បរិញ្ញាបត្រជាន់ខ្ពស់នីតិសាស្ត្រ ឯកទេសរដ្ឋបាលសាធារណៈ - Master of Public Administration Law (MPAL)",
        label:
          "បរិញ្ញាបត្រជាន់ខ្ពស់នីតិសាស្ត្រ ឯកទេសរដ្ឋបាលសាធារណៈ - Master of Public Administration Law (MPAL)",
      },
      {
        value: "បរិញ្ញាបត្រជាន់ខ្ពស់ធុរកិច្ច ឯកទេសគ្រប់គ្រង - Master of Business Management (MBM)",
        label: "បរិញ្ញាបត្រជាន់ខ្ពស់ធុរកិច្ច ឯកទេសគ្រប់គ្រង - Master of Business Management (MBM)",
      },
      {
        value: "បរិញ្ញាបត្រជាន់ខ្ពស់ធុរកិច្ច ឯកទេសហិរញ្ញវត្ថុ - Master of Business Finance (MBF)",
        label: "បរិញ្ញាបត្រជាន់ខ្ពស់ធុរកិច្ច ឯកទេសហិរញ្ញវត្ថុ - Master of Business Finance (MBF)",
      },
    ],
  },
];

export const FLAT_MAJOR_OPTIONS = MAJOR_OPTIONS.flatMap((group) => group.options);

export function majorCode(major: string | null | undefined) {
  const matches = Array.from((major ?? "").matchAll(/\(([A-Z]{2,5})\)/g));
  return matches.at(-1)?.[1] ?? "GEN";
}

export function shiftCode(shift: string | null | undefined) {
  if (shift === "afternoon") return "B";
  if (shift === "evening") return "C";
  return "A";
}

export function generateClassName(
  major: string | null | undefined,
  studyYear: number | string | null | undefined,
  shift: string | null | undefined,
  classNumber: number | string = 1,
) {
  const year = Math.max(1, Number(studyYear) || 1);
  const number = String(Math.max(1, Number(classNumber) || 1)).padStart(2, "0");
  return `${majorCode(major)}${year}${shiftCode(shift)}${number}`;
}

export const ADDRESS_OPTIONS = [
  "រាជធានីភ្នំពេញ (Phnom Penh)",
  "ខេត្តកណ្តាល (Kandal)",
  "ខេត្តកែប (Kep)",
  "ខេត្តកំពត (Kampot)",
  "ខេត្តកំពង់ចាម (Kampong Cham)",
  "ខេត្តកំពង់ឆ្នាំង (Kampong Chhnang)",
  "ខេត្តកំពង់ធំ (Kampong Thom)",
  "ខេត្តកំពង់ស្ពឺ (Kampong Speu)",
  "ខេត្តកោះកុង (Koh Kong)",
  "ខេត្តក្រចេះ (Kratie)",
  "ខេត្តតាកែវ (Takeo)",
  "ខេត្តត្បូងឃ្មុំ (Tboung Khmum)",
  "ខេត្តបន្ទាយមានជ័យ (Banteay Meanchey)",
  "ខេត្តបាត់ដំបង (Battambang)",
  "ខេត្តប៉ៃលិន (Pailin)",
  "ខេត្តពោធិ៍សាត់ (Pursat)",
  "ខេត្តព្រៃវែង (Prey Veng)",
  "ខេត្តព្រះសីហនុ (Preah Sihanouk)",
  "ខេត្តព្រះវិហារ (Preah Vihear)",
  "ខេត្តមណ្ឌលគិរី (Mondulkiri)",
  "ខេត្តរតនគិរី (Ratanakiri)",
  "ខេត្តស្វាយរៀង (Svay Rieng)",
  "ខេត្តស្ទឹងត្រែង (Stung Treng)",
  "ខេត្តសៀមរាប (Siem Reap)",
  "ខេត្តឧត្តរមានជ័យ (Oddar Meanchey)",
];
