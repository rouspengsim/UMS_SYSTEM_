export const MAJOR_OPTIONS = [
  {
    group: "១. មហាវិទ្យាល័យនីតិសាស្ត្រ (Faculty of Law)",
    options: [{ value: "នីតិសាស្ត្រ (Law)", label: "នីតិសាស្ត្រ (Law)" }],
  },
  {
    group:
      "២. មហាវិទ្យាល័យវិទ្យាសាស្ត្រសេដ្ឋកិច្ច និងគ្រប់គ្រង (Faculty of Economics and Management)",
    options: [
      { value: "សេដ្ឋកិច្ច (Economics)", label: "សេដ្ឋកិច្ច (Economics)" },
      { value: "គ្រប់គ្រង (Management)", label: "គ្រប់គ្រង (Management)" },
      { value: "គណនេយ្យ (Accounting)", label: "គណនេយ្យ (Accounting)" },
      {
        value: "ហិរញ្ញវត្ថុ និងធនាគារ (Finance and Banking)",
        label: "ហិរញ្ញវត្ថុ និងធនាគារ (Finance and Banking)",
      },
      {
        value: "ពាណិជ្ជកម្មអន្តរជាតិ (International Business)",
        label: "ពាណិជ្ជកម្មអន្តរជាតិ (International Business)",
      },
    ],
  },
  {
    group: "៣. មហាវិទ្យាល័យរដ្ឋបាលសាធារណៈ (Faculty of Public Administration)",
    options: [
      {
        value: "រដ្ឋបាលសាធារណៈ (Public Administration)",
        label: "រដ្ឋបាលសាធារណៈ (Public Administration)",
      },
      {
        value: "ទំនាក់ទំនងអន្តរជាតិ (International Relations)",
        label: "ទំនាក់ទំនងអន្តរជាតិ (International Relations)",
      },
    ],
  },
  {
    group: "៤. មហាវិទ្យាល័យព័ត៌មានវិទ្យាធុរកិច្ច (Faculty of Business Informatics)",
    options: [
      {
        value: "ព័ត៌មានវិទ្យាធុរកិច្ច (Business Informatics)",
        label: "ព័ត៌មានវិទ្យាធុរកិច្ច (Business Informatics)",
      },
      {
        value: "បច្ចេកវិទ្យាព័ត៌មាន (Information Technology)",
        label: "បច្ចេកវិទ្យាព័ត៌មាន (Information Technology)",
      },
    ],
  },
  {
    group: "៥. កម្មវិធីពិសេសៗ និងទ្វេសញ្ញាបត្រ (Dual Degree Programs)",
    options: [
      {
        value: "បរិញ្ញាបត្រផ្នែកសេដ្ឋកិច្ច និងគ្រប់គ្រង (Bachelor of Economics and Management)",
        label: "បរិញ្ញាបត្រផ្នែកសេដ្ឋកិច្ច និងគ្រប់គ្រង (Bachelor of Economics and Management)",
      },
      {
        value: "បរិញ្ញាបត្រផ្នែកច្បាប់ (Bachelor of Laws)",
        label: "បរិញ្ញាបត្រផ្នែកច្បាប់ (Bachelor of Laws)",
      },
      {
        value:
          "បរិញ្ញាបត្រផ្នែកគ្រប់គ្រងទេសចរណ៍ និងបដិសណ្ឋារកិច្ច (Bachelor of Tourism and Hospitality Management)",
        label:
          "បរិញ្ញាបត្រផ្នែកគ្រប់គ្រងទេសចរណ៍ និងបដិសណ្ឋារកិច្ច (Bachelor of Tourism and Hospitality Management)",
      },
    ],
  },
  {
    group: "៦. កម្មវិធីបរិញ្ញាបត្រជាន់ខ្ពស់ (Master's Degrees)",
    options: [
      { value: "ច្បាប់ឯកជន (Private Law)", label: "ច្បាប់ឯកជន (Private Law)" },
      { value: "ច្បាប់ព្រហ្មទណ្ឌ (Criminal Law)", label: "ច្បាប់ព្រហ្មទណ្ឌ (Criminal Law)" },
      { value: "ច្បាប់រដ្ឋបាល (Administrative Law)", label: "ច្បាប់រដ្ឋបាល (Administrative Law)" },
      { value: "ច្បាប់ឌីជីថល (Digital Law)", label: "ច្បាប់ឌីជីថល (Digital Law)" },
      { value: "នីតិភូមិបាល (Land Law)", label: "នីតិភូមិបាល (Land Law)" },
      { value: "MBA", label: "MBA" },
      { value: "ហិរញ្ញវត្ថុ (Finance)", label: "ហិរញ្ញវត្ថុ (Finance)" },
      { value: "គណនេយ្យ (Accounting)", label: "គណនេយ្យ (Accounting)" },
      {
        value: "សេដ្ឋកិច្ចអភិវឌ្ឍន៍ (Development Economics)",
        label: "សេដ្ឋកិច្ចអភិវឌ្ឍន៍ (Development Economics)",
      },
      {
        value: "រដ្ឋបាលសាធារណៈ (Public Administration)",
        label: "រដ្ឋបាលសាធារណៈ (Public Administration)",
      },
      {
        value: "ទំនាក់ទំនងអន្តរជាតិ (International Relations)",
        label: "ទំនាក់ទំនងអន្តរជាតិ (International Relations)",
      },
    ],
  },
];

export const FLAT_MAJOR_OPTIONS = MAJOR_OPTIONS.flatMap((group) => group.options);

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
