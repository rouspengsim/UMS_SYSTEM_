import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputSvgPath = resolve("supabase/er-diagram.svg");
const outputPngPath = resolve("supabase/er-diagram.png");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function entity({ x, y, width = 210, height = 72, label }) {
  return `
    <g>
      <rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" class="entity" />
      <text x="${x}" y="${y + 5}" class="entity-label">${escapeXml(label)}</text>
    </g>`;
}

function attribute({ x, y, width = 190, height = 56, label, key = false }) {
  return `
    <g>
      <ellipse cx="${x}" cy="${y}" rx="${width / 2}" ry="${height / 2}" class="attribute" />
      <text x="${x}" y="${y + 5}" class="${key ? "attribute-label key" : "attribute-label"}">${escapeXml(label)}</text>
    </g>`;
}

function relationship({ x, y, width = 145, height = 86, label }) {
  return `
    <g>
      <path d="M ${x} ${y - height / 2} L ${x + width / 2} ${y} L ${x} ${y + height / 2} L ${x - width / 2} ${y} Z" class="relationship" />
      <text x="${x}" y="${y + 5}" class="relationship-label">${escapeXml(label)}</text>
    </g>`;
}

function line({ x1, y1, x2, y2, label, labelX, labelY }) {
  const labelElement = label
    ? `<text x="${labelX ?? (x1 + x2) / 2}" y="${labelY ?? (y1 + y2) / 2 - 8}" class="line-label">${escapeXml(label)}</text>`
    : "";

  return `
    <g>
      <path d="M ${x1} ${y1} L ${x2} ${y2}" class="line" />
      ${labelElement}
    </g>`;
}

function pathLine({ d, label, labelX, labelY }) {
  const labelElement = label
    ? `<text x="${labelX}" y="${labelY}" class="line-label">${escapeXml(label)}</text>`
    : "";

  return `
    <g>
      <path d="${d}" class="line" />
      ${labelElement}
    </g>`;
}

const body = `
  <text x="900" y="70" class="title">ER Diagram for StudentSphere Management System</text>

  ${entity({ x: 590, y: 230, label: "Profiles" })}
  ${attribute({ x: 395, y: 125, label: "profile_id", key: true })}
  ${attribute({ x: 590, y: 105, label: "user_id" })}
  ${attribute({ x: 790, y: 125, label: "full_name" })}
  ${attribute({ x: 395, y: 330, label: "email" })}
  ${attribute({ x: 790, y: 330, label: "phone" })}

  ${relationship({ x: 920, y: 230, label: "Has" })}

  ${entity({ x: 1235, y: 230, label: "User Roles" })}
  ${attribute({ x: 1135, y: 105, label: "role_id", key: true })}
  ${attribute({ x: 1435, y: 150, label: "role" })}
  ${attribute({ x: 1450, y: 300, label: "user_id" })}

  ${entity({ x: 320, y: 660, label: "Students" })}
  ${attribute({ x: 130, y: 500, label: "student_id", key: true })}
  ${attribute({ x: 320, y: 455, label: "student_code" })}
  ${attribute({ x: 535, y: 510, label: "full_name" })}
  ${attribute({ x: 125, y: 660, label: "email" })}
  ${attribute({ x: 145, y: 805, label: "phone" })}
  ${attribute({ x: 320, y: 860, label: "major" })}
  ${attribute({ x: 545, y: 800, label: "status" })}

  ${relationship({ x: 610, y: 660, label: "Enrolls" })}

  ${entity({ x: 900, y: 660, label: "Classes" })}
  ${attribute({ x: 900, y: 455, label: "class_id", key: true })}
  ${attribute({ x: 755, y: 525, label: "class_name" })}
  ${attribute({ x: 1045, y: 525, label: "subject_code" })}
  ${attribute({ x: 760, y: 800, label: "room" })}
  ${attribute({ x: 1040, y: 800, label: "semester" })}

  ${relationship({ x: 1190, y: 660, label: "Teaches" })}

  ${entity({ x: 1480, y: 660, label: "Teachers" })}
  ${attribute({ x: 1285, y: 500, label: "teacher_id", key: true })}
  ${attribute({ x: 1480, y: 455, label: "staff_code" })}
  ${attribute({ x: 1675, y: 510, label: "full_name" })}
  ${attribute({ x: 1680, y: 660, label: "email" })}
  ${attribute({ x: 1660, y: 805, label: "department" })}
  ${attribute({ x: 1480, y: 860, label: "specialization" })}

  ${entity({ x: 900, y: 990, label: "Enrollments" })}
  ${attribute({ x: 680, y: 940, label: "enrollment_id", key: true })}
  ${attribute({ x: 1120, y: 940, label: "enrolled_at" })}
  ${attribute({ x: 700, y: 1085, label: "student_id" })}
  ${attribute({ x: 1100, y: 1085, label: "class_id" })}

  ${relationship({ x: 320, y: 1010, label: "Pays" })}
  ${entity({ x: 320, y: 1240, label: "Payments" })}
  ${attribute({ x: 130, y: 1140, label: "payment_id", key: true })}
  ${attribute({ x: 320, y: 1095, label: "invoice_number" })}
  ${attribute({ x: 545, y: 1140, label: "amount" })}
  ${attribute({ x: 130, y: 1320, label: "status" })}
  ${attribute({ x: 530, y: 1320, label: "paid_date" })}

  ${relationship({ x: 610, y: 1340, label: "Records" })}
  ${entity({ x: 900, y: 1340, label: "Attendance" })}
  ${attribute({ x: 690, y: 1240, label: "attendance_id", key: true })}
  ${attribute({ x: 900, y: 1200, label: "date" })}
  ${attribute({ x: 1110, y: 1240, label: "status" })}
  ${attribute({ x: 710, y: 1465, label: "week_number" })}
  ${attribute({ x: 1090, y: 1465, label: "subject_code" })}

  ${relationship({ x: 1190, y: 1240, label: "Gets" })}
  ${entity({ x: 1480, y: 1240, label: "Scores" })}
  ${attribute({ x: 1285, y: 1140, label: "score_id", key: true })}
  ${attribute({ x: 1480, y: 1095, label: "score" })}
  ${attribute({ x: 1680, y: 1140, label: "remark" })}
  ${attribute({ x: 1290, y: 1320, label: "exam_id" })}
  ${attribute({ x: 1670, y: 1320, label: "student_id" })}

  ${relationship({ x: 1480, y: 1475, label: "Has" })}
  ${entity({ x: 1480, y: 1660, label: "Exams" })}
  ${attribute({ x: 1285, y: 1580, label: "exam_id", key: true })}
  ${attribute({ x: 1480, y: 1540, label: "exam_name" })}
  ${attribute({ x: 1675, y: 1580, label: "exam_type" })}
  ${attribute({ x: 1360, y: 1770, label: "max_score" })}
  ${attribute({ x: 1600, y: 1770, label: "weight" })}

  ${relationship({ x: 900, y: 1595, label: "Schedules" })}
  ${entity({ x: 900, y: 1810, label: "Timetable Slots" })}
  ${attribute({ x: 690, y: 1725, label: "slot_id", key: true })}
  ${attribute({ x: 900, y: 1685, label: "day" })}
  ${attribute({ x: 1110, y: 1725, label: "start_time" })}
  ${attribute({ x: 780, y: 1935, label: "end_time" })}
  ${attribute({ x: 1020, y: 1935, label: "room" })}

  ${line({ x1: 590, y1: 194, x2: 395, y2: 135 })}
  ${line({ x1: 590, y1: 194, x2: 590, y2: 133 })}
  ${line({ x1: 590, y1: 194, x2: 790, y2: 135 })}
  ${line({ x1: 590, y1: 266, x2: 395, y2: 320 })}
  ${line({ x1: 590, y1: 266, x2: 790, y2: 320 })}
  ${line({ x1: 695, y1: 230, x2: 848, y2: 230 })}
  ${line({ x1: 992, y1: 230, x2: 1130, y2: 230 })}
  ${line({ x1: 1235, y1: 194, x2: 1135, y2: 115 })}
  ${line({ x1: 1235, y1: 194, x2: 1435, y2: 160 })}
  ${line({ x1: 1235, y1: 266, x2: 1450, y2: 290 })}

  ${line({ x1: 320, y1: 624, x2: 130, y2: 510 })}
  ${line({ x1: 320, y1: 624, x2: 320, y2: 483 })}
  ${line({ x1: 320, y1: 624, x2: 535, y2: 520 })}
  ${line({ x1: 215, y1: 660, x2: 125, y2: 660 })}
  ${line({ x1: 320, y1: 696, x2: 145, y2: 795 })}
  ${line({ x1: 320, y1: 696, x2: 320, y2: 832 })}
  ${line({ x1: 320, y1: 696, x2: 545, y2: 790 })}

  ${line({ x1: 425, y1: 660, x2: 538, y2: 660, label: "1", labelX: 475, labelY: 642 })}
  ${line({ x1: 682, y1: 660, x2: 795, y2: 660, label: "M", labelX: 735, labelY: 642 })}

  ${line({ x1: 900, y1: 624, x2: 900, y2: 483 })}
  ${line({ x1: 900, y1: 624, x2: 755, y2: 535 })}
  ${line({ x1: 900, y1: 624, x2: 1045, y2: 535 })}
  ${line({ x1: 900, y1: 696, x2: 760, y2: 790 })}
  ${line({ x1: 900, y1: 696, x2: 1040, y2: 790 })}

  ${line({ x1: 1005, y1: 660, x2: 1118, y2: 660, label: "M", labelX: 1060, labelY: 642 })}
  ${line({ x1: 1262, y1: 660, x2: 1375, y2: 660, label: "1", labelX: 1320, labelY: 642 })}

  ${line({ x1: 1480, y1: 624, x2: 1285, y2: 510 })}
  ${line({ x1: 1480, y1: 624, x2: 1480, y2: 483 })}
  ${line({ x1: 1480, y1: 624, x2: 1675, y2: 520 })}
  ${line({ x1: 1585, y1: 660, x2: 1680, y2: 660 })}
  ${line({ x1: 1480, y1: 696, x2: 1660, y2: 795 })}
  ${line({ x1: 1480, y1: 696, x2: 1480, y2: 832 })}

  ${line({ x1: 610, y1: 703, x2: 830, y2: 954 })}
  ${line({ x1: 900, y1: 696, x2: 900, y2: 954 })}
  ${line({ x1: 900, y1: 954, x2: 680, y2: 950 })}
  ${line({ x1: 900, y1: 954, x2: 1120, y2: 950 })}
  ${line({ x1: 900, y1: 1026, x2: 700, y2: 1075 })}
  ${line({ x1: 900, y1: 1026, x2: 1100, y2: 1075 })}

  ${line({ x1: 320, y1: 696, x2: 320, y2: 967, label: "1", labelX: 340, labelY: 820 })}
  ${line({ x1: 320, y1: 1053, x2: 320, y2: 1204, label: "M", labelX: 340, labelY: 1135 })}
  ${line({ x1: 320, y1: 1204, x2: 130, y2: 1150 })}
  ${line({ x1: 320, y1: 1204, x2: 320, y2: 1123 })}
  ${line({ x1: 320, y1: 1204, x2: 545, y2: 1150 })}
  ${line({ x1: 320, y1: 1276, x2: 130, y2: 1310 })}
  ${line({ x1: 320, y1: 1276, x2: 530, y2: 1310 })}

  ${pathLine({ d: "M 425 660 L 510 660 L 510 1340 L 538 1340", label: "1", labelX: 490, labelY: 630 })}
  ${line({ x1: 682, y1: 1340, x2: 795, y2: 1340, label: "M", labelX: 735, labelY: 1322 })}
  ${pathLine({ d: "M 900 696 L 900 920 L 900 920 L 900 1258", label: "1", labelX: 918, labelY: 825 })}
  ${line({ x1: 900, y1: 1297, x2: 900, y2: 1304, label: "M", labelX: 918, labelY: 1288 })}
  ${line({ x1: 900, y1: 1304, x2: 690, y2: 1250 })}
  ${line({ x1: 900, y1: 1304, x2: 900, y2: 1228 })}
  ${line({ x1: 900, y1: 1304, x2: 1110, y2: 1250 })}
  ${line({ x1: 900, y1: 1376, x2: 710, y2: 1455 })}
  ${line({ x1: 900, y1: 1376, x2: 1090, y2: 1455 })}

  ${pathLine({ d: "M 425 660 L 1190 660 L 1190 1197", label: "1", labelX: 1145, labelY: 635 })}
  ${line({ x1: 1262, y1: 1240, x2: 1375, y2: 1240, label: "M", labelX: 1320, labelY: 1222 })}
  ${line({ x1: 1480, y1: 1204, x2: 1285, y2: 1150 })}
  ${line({ x1: 1480, y1: 1204, x2: 1480, y2: 1123 })}
  ${line({ x1: 1480, y1: 1204, x2: 1680, y2: 1150 })}
  ${line({ x1: 1480, y1: 1276, x2: 1290, y2: 1310 })}
  ${line({ x1: 1480, y1: 1276, x2: 1670, y2: 1310 })}
  ${line({ x1: 1480, y1: 1276, x2: 1480, y2: 1432, label: "M", labelX: 1500, labelY: 1360 })}
  ${line({ x1: 1480, y1: 1518, x2: 1480, y2: 1624, label: "1", labelX: 1500, labelY: 1570 })}
  ${line({ x1: 1480, y1: 1624, x2: 1285, y2: 1590 })}
  ${line({ x1: 1480, y1: 1624, x2: 1480, y2: 1568 })}
  ${line({ x1: 1480, y1: 1624, x2: 1675, y2: 1590 })}
  ${line({ x1: 1480, y1: 1696, x2: 1360, y2: 1760 })}
  ${line({ x1: 1480, y1: 1696, x2: 1600, y2: 1760 })}

  ${pathLine({ d: "M 900 696 L 900 1552", label: "1", labelX: 920, labelY: 965 })}
  ${line({ x1: 900, y1: 1638, x2: 900, y2: 1774, label: "M", labelX: 920, labelY: 1710 })}
  ${line({ x1: 900, y1: 1774, x2: 690, y2: 1735 })}
  ${line({ x1: 900, y1: 1774, x2: 900, y2: 1713 })}
  ${line({ x1: 900, y1: 1774, x2: 1110, y2: 1735 })}
  ${line({ x1: 900, y1: 1846, x2: 780, y2: 1925 })}
  ${line({ x1: 900, y1: 1846, x2: 1020, y2: 1925 })}
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2020" viewBox="0 0 1800 2020" role="img" aria-labelledby="title desc">
  <title id="title">StudentSphere ER diagram</title>
  <desc id="desc">Chen-style ER diagram for the StudentSphere database.</desc>
  <defs>
    <style>
      .background { fill: #fff1e8; }
      .title { fill: #2947b8; font: 700 31px Arial, sans-serif; text-anchor: middle; }
      .entity { fill: #898989; stroke: #24304f; stroke-width: 2; }
      .entity-label { fill: #ffffff; font: 700 16px Arial, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #898989; stroke-width: 5px; stroke-linejoin: round; }
      .attribute { fill: #ffffff; stroke: #0f2147; stroke-width: 1.8; }
      .attribute-label { fill: #2947b8; font: 500 14px Arial, sans-serif; text-anchor: middle; }
      .attribute-label.key { text-decoration: underline; font-weight: 700; }
      .relationship { fill: #ffffff; stroke: #0f2147; stroke-width: 1.8; }
      .relationship-label { fill: #2947b8; font: 500 14px Arial, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 4px; stroke-linejoin: round; }
      .line { fill: none; stroke: #3447e0; stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
      .line-label { fill: #0f2147; font: 700 12px Arial, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #fff1e8; stroke-width: 4px; stroke-linejoin: round; }
    </style>
  </defs>
  <rect width="1800" height="2020" class="background" />
  ${body}
</svg>
`;

mkdirSync(dirname(outputSvgPath), { recursive: true });
writeFileSync(outputSvgPath, svg);
console.log(`Wrote ${outputSvgPath}`);

try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(svg)).png().toFile(outputPngPath);
  console.log(`Wrote ${outputPngPath}`);
} catch (error) {
  console.warn(`Skipped PNG export because sharp is not available: ${error.message}`);
}
