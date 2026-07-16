import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputSvgPath = resolve("supabase/context-flow-diagram.svg");
const outputPngPath = resolve("supabase/context-flow-diagram.png");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function box({ x, y, width, height, label, className = "external" }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" class="${className}" />
      <text x="${x + width / 2}" y="${y + height / 2 + 7}" class="box-label">${escapeXml(label)}</text>
    </g>`;
}

function systemBox({ x, y, width, height, label }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" class="system" />
      <path d="M ${x} ${y + 28} H ${x + width}" class="system-divider" />
      <path d="M ${x} ${y + height - 28} H ${x + width}" class="system-divider" />
      <text x="${x + width / 2}" y="${y + height / 2 + 7}" class="system-label">${escapeXml(label)}</text>
    </g>`;
}

function label({ x, y, text, anchor = "middle" }) {
  return text
    .split("\n")
    .map((line, index) => {
      return `<text x="${x}" y="${y + index * 20}" class="flow-label" text-anchor="${anchor}">${escapeXml(line)}</text>`;
    })
    .join("\n");
}

function arrowPath({ d, labelText, labelX, labelY, anchor = "middle" }) {
  return `
    <g>
      <path d="${d}" class="flow" marker-end="url(#arrow)" />
      ${labelText ? label({ x: labelX, y: labelY, text: labelText, anchor }) : ""}
    </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000" role="img" aria-labelledby="title desc">
  <title id="title">StudentSphere context flow diagram</title>
  <desc id="desc">Context flow diagram showing StudentSphere interactions with admins, teachers, students, admissions, and the database.</desc>
  <defs>
    <marker id="arrow" markerWidth="11" markerHeight="11" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#1f2933" />
    </marker>
    <style>
      .background { fill: #ffffff; }
      .title { fill: #111827; font: 700 30px Arial, sans-serif; text-anchor: middle; }
      .subtitle { fill: #4b5563; font: 400 15px Arial, sans-serif; text-anchor: middle; }
      .external { fill: #cbe95b; stroke: #1f2933; stroke-width: 2; }
      .system { fill: #cbe95b; stroke: #111827; stroke-width: 2.4; }
      .system-divider { stroke: #111827; stroke-width: 2; }
      .box-label { fill: #111827; font: 700 21px Arial, sans-serif; text-anchor: middle; }
      .system-label { fill: #111827; font: 700 23px Arial, sans-serif; text-anchor: middle; }
      .flow { fill: none; stroke: #1f2933; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .flow-label { fill: #111827; font: 16px Arial, sans-serif; paint-order: stroke; stroke: #ffffff; stroke-width: 5px; stroke-linejoin: round; }
    </style>
  </defs>
  <rect width="1400" height="1000" class="background" />
  <text x="700" y="55" class="title">Context Flow Diagram for StudentSphere Management System</text>
  <text x="700" y="82" class="subtitle">External users exchange requests, records, and reports with the central school management system</text>

  ${box({ x: 310, y: 115, width: 280, height: 90, label: "Admin" })}
  ${box({ x: 810, y: 115, width: 280, height: 90, label: "Teachers" })}
  ${box({ x: 40, y: 430, width: 270, height: 90, label: "Admissions" })}
  ${box({ x: 1090, y: 430, width: 270, height: 90, label: "Students" })}
  ${box({ x: 565, y: 810, width: 270, height: 90, label: "Supabase Database" })}
  ${systemBox({ x: 565, y: 420, width: 270, height: 120, label: "StudentSphere SMS" })}

  ${arrowPath({
    d: "M 450 205 V 335 Q 450 395 565 440",
    labelText: "Manage users,\nclasses, reports",
    labelX: 465,
    labelY: 290,
    anchor: "start",
  })}
  ${arrowPath({
    d: "M 595 455 Q 520 398 520 320 V 205",
    labelText: "Dashboard and\nsystem reports",
    labelX: 535,
    labelY: 250,
    anchor: "start",
  })}

  ${arrowPath({
    d: "M 950 205 V 335 Q 950 395 835 440",
    labelText: "Attendance,\nscores, schedule",
    labelX: 930,
    labelY: 290,
    anchor: "end",
  })}
  ${arrowPath({
    d: "M 805 455 Q 880 398 880 320 V 205",
    labelText: "Class lists and\nteaching reports",
    labelX: 865,
    labelY: 250,
    anchor: "end",
  })}

  ${arrowPath({
    d: "M 310 505 H 565",
    labelText: "Add new student\nregistration",
    labelX: 430,
    labelY: 540,
  })}
  ${arrowPath({
    d: "M 565 455 H 310",
    labelText: "Student ID and\nregistration status",
    labelX: 430,
    labelY: 402,
  })}

  ${arrowPath({
    d: "M 835 455 H 1090",
    labelText: "Schedules,\nresults, notices",
    labelX: 965,
    labelY: 402,
  })}
  ${arrowPath({
    d: "M 1090 505 H 835",
    labelText: "Profile, payment,\nreport requests",
    labelX: 965,
    labelY: 540,
  })}

  ${arrowPath({
    d: "M 770 540 V 810",
    labelText: "Save students,\nclasses, payments",
    labelX: 785,
    labelY: 665,
    anchor: "start",
  })}
  ${arrowPath({
    d: "M 630 810 V 540",
    labelText: "Load records\nand reports",
    labelX: 615,
    labelY: 690,
    anchor: "end",
  })}
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
