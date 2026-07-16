import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputSvgPath = resolve("supabase/process-diagram.svg");
const outputPngPath = resolve("supabase/process-diagram.png");
const contextSvgPath = resolve("supabase/context-diagram.svg");
const contextPngPath = resolve("supabase/context-diagram.png");
const level0SvgPath = resolve("supabase/dfd-level-0.svg");
const level0PngPath = resolve("supabase/dfd-level-0.png");
const useCaseSvgPath = resolve("supabase/use-case-diagram.svg");
const useCasePngPath = resolve("supabase/use-case-diagram.png");
const professionalSvgPath = resolve("supabase/professional-system-overview.svg");
const professionalPngPath = resolve("supabase/professional-system-overview.png");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textLines(text, maxLength = 28) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function multiLineText({ text, x, y, className = "label", maxLength = 28, lineHeight = 18 }) {
  return textLines(text, maxLength)
    .map((line, index, lines) => {
      const dy = (index - (lines.length - 1) / 2) * lineHeight;
      return `<text x="${x}" y="${y + dy}" class="${className}">${escapeXml(line)}</text>`;
    })
    .join("\n");
}

function card({ x, y, width, height, className = "card", radius = 18 }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" class="${className}" />`;
}

function actor({ x, y, title, note, accent, initials }) {
  return `
    <g>
      ${card({ x, y, width: 240, height: 110, className: "actor-card", radius: 20 })}
      <circle cx="${x + 42}" cy="${y + 55}" r="25" fill="${accent}" />
      <text x="${x + 42}" y="${y + 62}" class="initials">${escapeXml(initials)}</text>
      <text x="${x + 84}" y="${y + 46}" class="actor-title">${escapeXml(title)}</text>
      ${multiLineText({
        text: note,
        x: x + 84,
        y: y + 72,
        className: "actor-note",
        maxLength: 20,
        lineHeight: 15,
      })}
    </g>`;
}

function moduleCard({ x, y, title, note, accent }) {
  return `
    <g>
      ${card({ x, y, width: 285, height: 88, className: "module-card", radius: 16 })}
      <rect x="${x}" y="${y}" width="7" height="88" rx="3.5" fill="${accent}" />
      <text x="${x + 24}" y="${y + 35}" class="module-title">${escapeXml(title)}</text>
      ${multiLineText({
        text: note,
        x: x + 24,
        y: y + 60,
        className: "module-note",
        maxLength: 30,
        lineHeight: 14,
      })}
    </g>`;
}

function dataPill({ x, y, title, note, accent }) {
  return `
    <g>
      ${card({ x, y, width: 345, height: 62, className: "data-pill", radius: 15 })}
      <circle cx="${x + 30}" cy="${y + 31}" r="10" fill="${accent}" />
      <text x="${x + 55}" y="${y + 27}" class="data-title">${escapeXml(title)}</text>
      <text x="${x + 55}" y="${y + 46}" class="data-note">${escapeXml(note)}</text>
    </g>`;
}

function flow({ x1, y1, x2, y2, label, className = "flow", curve = 0 }) {
  const d =
    curve === 0
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 9;

  return `
    <g>
      <path d="${d}" class="${className}" marker-end="url(#arrow)" />
      ${label ? `<text x="${labelX}" y="${labelY}" class="flow-label">${escapeXml(label)}</text>` : ""}
    </g>`;
}

function pathFlow({ d, label, labelX, labelY, className = "flow" }) {
  return `
    <g>
      <path d="${d}" class="${className}" marker-end="url(#arrow)" />
      ${label ? `<text x="${labelX}" y="${labelY}" class="flow-label">${escapeXml(label)}</text>` : ""}
    </g>`;
}

function processNode({ x, y, width, height, title, id, accent }) {
  return `
    <g>
      ${card({ x, y, width, height, className: "process-node", radius: 18 })}
      <circle cx="${x + 34}" cy="${y + 34}" r="18" fill="${accent}" />
      <text x="${x + 34}" y="${y + 40}" class="process-id">${escapeXml(id)}</text>
      <text x="${x + 68}" y="${y + 31}" class="process-title">${escapeXml(title)}</text>
      <text x="${x + 68}" y="${y + 56}" class="process-kind">Application process</text>
    </g>`;
}

function datastore({ x, y, title, note }) {
  return `
    <g>
      ${card({ x, y, width: 275, height: 70, className: "store", radius: 16 })}
      <path d="M ${x + 22} ${y + 20} C ${x + 22} ${y + 10}, ${x + 78} ${y + 10}, ${x + 78} ${y + 20} V ${y + 48} C ${x + 78} ${y + 58}, ${x + 22} ${y + 58}, ${x + 22} ${y + 48} Z M ${x + 22} ${y + 20} C ${x + 22} ${y + 30}, ${x + 78} ${y + 30}, ${x + 78} ${y + 20}" class="db-icon" />
      <text x="${x + 100}" y="${y + 32}" class="store-title">${escapeXml(title)}</text>
      <text x="${x + 100}" y="${y + 52}" class="store-note">${escapeXml(note)}</text>
    </g>`;
}

function step({ x, y, number, title, note }) {
  return `
    <g>
      <circle cx="${x + 25}" cy="${y + 26}" r="22" class="step-circle" />
      <text x="${x + 25}" y="${y + 33}" class="step-number">${number}</text>
      <text x="${x + 62}" y="${y + 22}" class="step-title">${escapeXml(title)}</text>
      ${multiLineText({
        text: note,
        x: x + 62,
        y: y + 47,
        className: "step-note",
        maxLength: 25,
        lineHeight: 14,
      })}
    </g>`;
}

function umlActor({ x, y, label }) {
  return `
    <g>
      <circle cx="${x}" cy="${y}" r="22" class="uml-line" />
      <path d="M ${x} ${y + 22} V ${y + 92} M ${x - 50} ${y + 48} H ${x + 50} M ${x} ${y + 92} L ${x - 42} ${y + 152} M ${x} ${y + 92} L ${x + 42} ${y + 152}" class="uml-line" />
      <text x="${x}" y="${y + 182}" class="uml-actor-label">${escapeXml(label)}</text>
    </g>`;
}

function roleCard({ x, y, title, note, initials, tone }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="220" height="104" rx="18" class="role-card role-${tone}" />
      <circle cx="${x + 46}" cy="${y + 52}" r="26" class="role-avatar role-avatar-${tone}" />
      <text x="${x + 46}" y="${y + 59}" class="role-initials">${escapeXml(initials)}</text>
      <text x="${x + 86}" y="${y + 42}" class="role-title">${escapeXml(title)}</text>
      ${multiLineText({
        text: note,
        x: x + 86,
        y: y + 68,
        className: "role-note",
        maxLength: 18,
        lineHeight: 14,
      })}
    </g>`;
}

function useCase({ x, y, width = 215, height = 58, label, tone = "default" }) {
  return `
    <g>
      <ellipse cx="${x}" cy="${y}" rx="${width / 2}" ry="${height / 2}" class="use-case use-case-${tone}" />
      ${multiLineText({
        text: label,
        x,
        y: y + 4,
        className: "use-case-label",
        maxLength: 20,
        lineHeight: 14,
      })}
    </g>`;
}

function association({ x1, y1, x2, y2 }) {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2}" class="association" />`;
}

function include({ x1, y1, x2, y2, label = "include" }) {
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 8;
  return `
    <g>
      <path d="M ${x1} ${y1} L ${x2} ${y2}" class="include" marker-end="url(#umlArrow)" />
      <text x="${labelX}" y="${labelY}" class="include-label">&lt;&lt;${escapeXml(label)}&gt;&gt;</text>
    </g>`;
}

function wrapSvg({ width, height, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#334155" />
    </marker>
    <filter id="softShadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.12" />
    </filter>
    <style>
      .background { fill: #f8fafc; }
      .page-title { fill: #0f172a; font: 800 34px Arial, sans-serif; text-anchor: middle; }
      .page-subtitle { fill: #64748b; font: 500 16px Arial, sans-serif; text-anchor: middle; }
      .section-title { fill: #0f172a; font: 800 21px Arial, sans-serif; }
      .section-note { fill: #64748b; font: 500 14px Arial, sans-serif; }
      .panel { fill: #ffffff; stroke: #dbe4ee; stroke-width: 1.4; filter: url(#softShadow); }
      .platform-panel { fill: #ffffff; stroke: #b6d9e2; stroke-width: 1.5; filter: url(#softShadow); }
      .data-panel { fill: #ffffff; stroke: #d6d3d1; stroke-width: 1.5; filter: url(#softShadow); }
      .actor-card, .module-card, .data-pill, .process-node, .store { fill: #ffffff; stroke: #d7e0ea; stroke-width: 1.2; }
      .initials { fill: #ffffff; font: 800 17px Arial, sans-serif; text-anchor: middle; }
      .actor-title { fill: #0f172a; font: 800 17px Arial, sans-serif; }
      .actor-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .module-title { fill: #0f172a; font: 800 16px Arial, sans-serif; }
      .module-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .data-title { fill: #0f172a; font: 800 14px Arial, sans-serif; }
      .data-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .flow { fill: none; stroke: #334155; stroke-width: 2.2; stroke-linecap: round; }
      .flow-soft { fill: none; stroke: #0f766e; stroke-width: 2.4; stroke-linecap: round; }
      .flow-dashed { fill: none; stroke: #64748b; stroke-width: 2; stroke-dasharray: 7 7; stroke-linecap: round; }
      .flow-label { fill: #0f172a; font: 700 12px Arial, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #f8fafc; stroke-width: 5px; stroke-linejoin: round; }
      .process-id { fill: #ffffff; font: 800 14px Arial, sans-serif; text-anchor: middle; }
      .process-title { fill: #0f172a; font: 800 15px Arial, sans-serif; }
      .process-kind { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .db-icon { fill: #ecfeff; stroke: #0891b2; stroke-width: 1.5; }
      .store-title { fill: #0f172a; font: 800 14px Arial, sans-serif; }
      .store-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .step-circle { fill: #0f766e; }
      .step-number { fill: #ffffff; font: 800 17px Arial, sans-serif; text-anchor: middle; }
      .step-title { fill: #0f172a; font: 800 14px Arial, sans-serif; }
      .step-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .swimlane-label { fill: #475569; font: 800 13px Arial, sans-serif; letter-spacing: 1.5px; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" class="background" />
  <text x="${width / 2}" y="48" class="page-title">${escapeXml(title)}</text>
  <text x="${width / 2}" y="78" class="page-subtitle">${escapeXml(desc)}</text>
  ${body}
</svg>
`;
}

function wrapUseCaseSvg({ width, height, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="max-width: 100%; height: auto;" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <defs>
    <marker id="umlArrow" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#111827" />
    </marker>
    <style>
      .background { fill: #f8fafc; }
      .title { fill: #0f172a; font: 800 32px Arial, sans-serif; text-anchor: middle; }
      .subtitle { fill: #64748b; font: 500 15px Arial, sans-serif; text-anchor: middle; }
      .system-boundary { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.8; }
      .boundary-label { fill: #0f172a; font: 800 18px Arial, sans-serif; }
      .group-panel { stroke-width: 1.4; }
      .group-admin { fill: #eff6ff; stroke: #bfdbfe; }
      .group-school { fill: #f5f3ff; stroke: #ddd6fe; }
      .group-service { fill: #ecfdf5; stroke: #bbf7d0; }
      .uml-line { fill: none; stroke: #111827; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .uml-actor-label { fill: #111827; font: 700 16px Arial, sans-serif; text-anchor: middle; }
      .role-card { fill: #ffffff; stroke-width: 1.5; filter: url(#cardShadow); }
      .role-admin { stroke: #93c5fd; }
      .role-teacher { stroke: #5eead4; }
      .role-student { stroke: #86efac; }
      .role-avatar-admin { fill: #2563eb; }
      .role-avatar-teacher { fill: #0f766e; }
      .role-avatar-student { fill: #16a34a; }
      .role-initials { fill: #ffffff; font: 800 16px Arial, sans-serif; text-anchor: middle; }
      .role-title { fill: #0f172a; font: 800 16px Arial, sans-serif; }
      .role-note { fill: #64748b; font: 500 12px Arial, sans-serif; }
      .use-case { fill: #ffffff; stroke: #334155; stroke-width: 1.7; filter: url(#caseShadow); }
      .use-case-admin { fill: #dbeafe; stroke: #2563eb; }
      .use-case-school { fill: #ede9fe; stroke: #7c3aed; }
      .use-case-service { fill: #dcfce7; stroke: #16a34a; }
      .use-case-label { fill: #0f172a; font: 700 13px Arial, sans-serif; text-anchor: middle; }
      .association { fill: none; stroke: #475569; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
      .include { fill: none; stroke: #111827; stroke-width: 1.2; stroke-dasharray: 7 5; stroke-linecap: round; }
      .include-label { fill: #111827; font: 600 11px Arial, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 4px; stroke-linejoin: round; }
      .spine { fill: none; stroke: #475569; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      .group-label { fill: #0f172a; font: 800 14px Arial, sans-serif; text-anchor: middle; }
      .group-note { fill: #64748b; font: 500 12px Arial, sans-serif; text-anchor: middle; }
    </style>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.10" />
    </filter>
    <filter id="caseShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.07" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" class="background" />
  <text x="${width / 2}" y="46" class="title">${escapeXml(title)}</text>
  <text x="${width / 2}" y="74" class="subtitle">${escapeXml(desc)}</text>
  ${body}
</svg>
`;
}

const overviewBody = `
  <g>
    ${card({ x: 48, y: 120, width: 270, height: 665, className: "panel", radius: 28 })}
    <text x="78" y="166" class="section-title">People</text>
    <text x="78" y="190" class="section-note">Who uses the system</text>
    ${actor({ x: 68, y: 230, title: "Admin", note: "Setup users, classes, teachers, and reports", accent: "#2563eb", initials: "AD" })}
    ${actor({ x: 68, y: 365, title: "Teacher", note: "Take attendance, add scores, view schedule", accent: "#0f766e", initials: "TR" })}
    ${actor({ x: 68, y: 500, title: "Student", note: "View profile, timetable, payments, results", accent: "#db2777", initials: "ST" })}
    ${actor({ x: 68, y: 635, title: "Accounting", note: "Update payments and payment reports", accent: "#d97706", initials: "AC" })}

    ${card({ x: 380, y: 120, width: 680, height: 665, className: "platform-panel", radius: 30 })}
    <text x="420" y="166" class="section-title">StudentSphere Platform</text>
    <text x="420" y="190" class="section-note">Main application processes grouped by work area</text>
    ${moduleCard({ x: 420, y: 230, title: "Login and Roles", note: "Sign in, permissions, dashboards", accent: "#2563eb" })}
    ${moduleCard({ x: 735, y: 230, title: "Student Records", note: "Register, edit, class assignment", accent: "#db2777" })}
    ${moduleCard({ x: 420, y: 345, title: "Teachers and Classes", note: "Teachers, classrooms, subjects", accent: "#7c3aed" })}
    ${moduleCard({ x: 735, y: 345, title: "Timetable", note: "Class schedule and teacher schedule", accent: "#0f766e" })}
    ${moduleCard({ x: 420, y: 460, title: "Attendance and Scores", note: "Daily attendance, exams, results", accent: "#0891b2" })}
    ${moduleCard({ x: 735, y: 460, title: "Payments", note: "Student fees and payment status", accent: "#d97706" })}
    ${moduleCard({ x: 420, y: 575, title: "Reports", note: "Student, teacher, payment, schedule reports", accent: "#475569" })}
    ${moduleCard({ x: 735, y: 575, title: "Notifications", note: "Announcements and reminders", accent: "#ea580c" })}

    ${card({ x: 1120, y: 120, width: 430, height: 665, className: "data-panel", radius: 28 })}
    <text x="1160" y="166" class="section-title">Database</text>
    <text x="1160" y="190" class="section-note">Supabase tables used by the app</text>
    ${dataPill({ x: 1160, y: 225, title: "Auth and Profiles", note: "users, profiles, roles", accent: "#2563eb" })}
    ${dataPill({ x: 1160, y: 305, title: "Students", note: "student records and enrollment", accent: "#db2777" })}
    ${dataPill({ x: 1160, y: 385, title: "Teachers and Classes", note: "teachers, classrooms, subjects", accent: "#7c3aed" })}
    ${dataPill({ x: 1160, y: 465, title: "Attendance and Scores", note: "attendance, grades, results", accent: "#0891b2" })}
    ${dataPill({ x: 1160, y: 545, title: "Payments", note: "invoices, fees, pay status", accent: "#d97706" })}
    ${dataPill({ x: 1160, y: 625, title: "Notifications", note: "messages and reminders", accent: "#ea580c" })}

    ${flow({ x1: 318, y1: 455, x2: 380, y2: 455, label: "actions", curve: 18 })}
    ${flow({ x1: 1060, y1: 450, x2: 1120, y2: 450, label: "read/write", className: "flow-soft" })}
    ${flow({ x1: 1120, y1: 530, x2: 1060, y2: 530, label: "records", className: "flow-dashed" })}

    ${card({ x: 48, y: 830, width: 1502, height: 130, className: "panel", radius: 28 })}
    <text x="78" y="874" class="section-title">Simple Process</text>
    ${step({ x: 78, y: 898, number: "1", title: "Login", note: "User signs in and role is checked" })}
    ${step({ x: 350, y: 898, number: "2", title: "Choose Module", note: "Open students, classes, attendance, or payments" })}
    ${step({ x: 650, y: 898, number: "3", title: "Update Data", note: "Add or edit records inside the app" })}
    ${step({ x: 950, y: 898, number: "4", title: "Save to Supabase", note: "Tables store the latest information" })}
    ${step({ x: 1240, y: 898, number: "5", title: "Report", note: "Users view reports, schedules, and results" })}
  </g>`;

const contextBody = `
  <g>
    ${card({ x: 70, y: 125, width: 1260, height: 520, className: "panel", radius: 32 })}
    <text x="110" y="176" class="section-title">Context Diagram</text>
    <text x="110" y="202" class="section-note">External users send work into StudentSphere and receive reports back.</text>

    ${actor({ x: 110, y: 260, title: "Admin", note: "Manage school setup and reports", accent: "#2563eb", initials: "AD" })}
    ${actor({ x: 110, y: 430, title: "Accounting", note: "Payment updates and payment reports", accent: "#d97706", initials: "AC" })}

    ${card({ x: 525, y: 300, width: 350, height: 185, className: "platform-panel", radius: 34 })}
    <text x="700" y="365" class="page-title" style="font-size: 28px;">StudentSphere</text>
    <text x="700" y="400" class="page-subtitle">Student Management System</text>
    <text x="700" y="432" class="page-subtitle">students, classes, payments, reports</text>

    ${actor({ x: 1050, y: 220, title: "Teacher", note: "Attendance, scores, schedules", accent: "#0f766e", initials: "TR" })}
    ${actor({ x: 1050, y: 375, title: "Student", note: "Timetable, payment, results", accent: "#db2777", initials: "ST" })}
    ${actor({ x: 1050, y: 530, title: "Register", note: "Add new student records", accent: "#7c3aed", initials: "RG" })}

    ${flow({ x1: 350, y1: 315, x2: 525, y2: 365, label: "manage system", curve: 45 })}
    ${flow({ x1: 525, y1: 415, x2: 350, y2: 485, label: "reports", curve: 45 })}
    ${flow({ x1: 875, y1: 350, x2: 1050, y2: 275, label: "teacher reports", curve: 45 })}
    ${flow({ x1: 1050, y1: 300, x2: 875, y2: 392, label: "attendance scores", curve: -45 })}
    ${flow({ x1: 875, y1: 418, x2: 1050, y2: 430, label: "student reports", curve: 45 })}
    ${flow({ x1: 1050, y1: 585, x2: 875, y2: 445, label: "new students", curve: -45 })}
  </g>`;

const level0Body = `
  <g>
    ${card({ x: 60, y: 125, width: 1480, height: 820, className: "panel", radius: 32 })}
    <text x="100" y="175" class="section-title">DFD Level 0</text>
    <text x="100" y="202" class="section-note">A cleaner Level 0 view with actors on the left, processes in the middle, and data stores on the right.</text>

    <text x="105" y="255" class="swimlane-label">ACTORS</text>
    <text x="390" y="255" class="swimlane-label">APPLICATION PROCESSES</text>
    <text x="1210" y="255" class="swimlane-label">DATA STORES</text>

    ${actor({ x: 100, y: 290, title: "Admin", note: "Setup and reports", accent: "#2563eb", initials: "AD" })}
    ${actor({ x: 100, y: 430, title: "Teacher", note: "Attendance and scores", accent: "#0f766e", initials: "TR" })}
    ${actor({ x: 100, y: 570, title: "Student", note: "View own information", accent: "#db2777", initials: "ST" })}
    ${actor({ x: 100, y: 710, title: "Accounting", note: "Payment updates", accent: "#d97706", initials: "AC" })}

    ${processNode({ x: 390, y: 290, width: 300, height: 82, title: "Login and Roles", id: "1.0", accent: "#2563eb" })}
    ${processNode({ x: 740, y: 290, width: 300, height: 82, title: "Student Records", id: "2.0", accent: "#db2777" })}
    ${processNode({ x: 390, y: 420, width: 300, height: 82, title: "Teachers and Classes", id: "3.0", accent: "#7c3aed" })}
    ${processNode({ x: 740, y: 420, width: 300, height: 82, title: "Attendance and Scores", id: "4.0", accent: "#0891b2" })}
    ${processNode({ x: 390, y: 550, width: 300, height: 82, title: "Timetable", id: "5.0", accent: "#0f766e" })}
    ${processNode({ x: 740, y: 550, width: 300, height: 82, title: "Payments", id: "6.0", accent: "#d97706" })}
    ${processNode({ x: 390, y: 680, width: 300, height: 82, title: "Reports", id: "7.0", accent: "#475569" })}
    ${processNode({ x: 740, y: 680, width: 300, height: 82, title: "Notifications", id: "8.0", accent: "#ea580c" })}

    ${datastore({ x: 1190, y: 290, title: "D1 Auth and Profiles", note: "users, profiles, roles" })}
    ${datastore({ x: 1190, y: 390, title: "D2 Academic Records", note: "students, teachers, classes" })}
    ${datastore({ x: 1190, y: 490, title: "D3 Attendance and Scores", note: "attendance, exams, results" })}
    ${datastore({ x: 1190, y: 590, title: "D4 Payments", note: "student fee records" })}
    ${datastore({ x: 1190, y: 690, title: "D5 Messages", note: "notifications and reminders" })}

    ${flow({ x1: 340, y1: 345, x2: 390, y2: 331, label: "login" })}
    ${flow({ x1: 340, y1: 485, x2: 390, y2: 461, label: "class work" })}
    ${flow({ x1: 340, y1: 625, x2: 390, y2: 721, label: "view reports", curve: -40 })}
    ${pathFlow({ d: "M 340 765 L 360 765 C 610 765, 610 591, 740 591", label: "payments", labelX: 555, labelY: 790 })}

    ${flow({ x1: 690, y1: 331, x2: 740, y2: 331, label: "authorized" })}
    ${flow({ x1: 690, y1: 461, x2: 740, y2: 461, label: "classes" })}
    ${flow({ x1: 690, y1: 591, x2: 740, y2: 591, label: "schedule" })}
    ${flow({ x1: 690, y1: 721, x2: 740, y2: 721, label: "reports" })}

    ${flow({ x1: 1040, y1: 331, x2: 1190, y2: 325, label: "profile data", className: "flow-soft" })}
    ${flow({ x1: 1040, y1: 461, x2: 1190, y2: 425, label: "academic data", className: "flow-soft" })}
    ${flow({ x1: 1040, y1: 591, x2: 1190, y2: 625, label: "payment data", className: "flow-soft" })}
    ${flow({ x1: 1040, y1: 721, x2: 1190, y2: 725, label: "message data", className: "flow-soft" })}
  </g>`;

const useCaseBody = `
  <g>
    ${roleCard({ x: 45, y: 405, title: "Admin", note: "school setup and control", initials: "AD", tone: "admin" })}
    ${roleCard({ x: 1335, y: 255, title: "Teacher", note: "class and learning records", initials: "TR", tone: "teacher" })}
    ${roleCard({ x: 1335, y: 575, title: "Student", note: "self service and results", initials: "ST", tone: "student" })}

    <rect x="295" y="120" width="1005" height="790" rx="26" class="system-boundary" />
    <text x="335" y="158" class="boundary-label">StudentSphere Management System</text>

    <rect x="340" y="190" width="260" height="660" rx="22" class="group-panel group-admin" />
    <rect x="670" y="190" width="260" height="660" rx="22" class="group-panel group-school" />
    <rect x="1000" y="190" width="250" height="660" rx="22" class="group-panel group-service" />

    <text x="470" y="225" class="group-label">Admin Management</text>
    <text x="470" y="246" class="group-note">setup and control</text>
    <text x="800" y="225" class="group-label">School Operations</text>
    <text x="800" y="246" class="group-note">daily academic work</text>
    <text x="1125" y="225" class="group-label">User Services</text>
    <text x="1125" y="246" class="group-note">teacher and student access</text>

    ${useCase({ x: 470, y: 295, label: "Login", tone: "admin" })}
    ${useCase({ x: 470, y: 370, label: "Manage Users", tone: "admin" })}
    ${useCase({ x: 470, y: 445, label: "Manage Students", tone: "admin" })}
    ${useCase({ x: 470, y: 520, label: "Manage Teachers", tone: "admin" })}
    ${useCase({ x: 470, y: 595, label: "Manage Classrooms", tone: "admin" })}
    ${useCase({ x: 470, y: 670, label: "Manage Reports", tone: "admin" })}
    ${useCase({ x: 470, y: 745, label: "Manage Notifications", tone: "admin" })}

    ${useCase({ x: 800, y: 315, label: "Manage Classes", tone: "school" })}
    ${useCase({ x: 800, y: 405, label: "Manage Timetable", tone: "school" })}
    ${useCase({ x: 800, y: 495, label: "Manage Attendance", tone: "school" })}
    ${useCase({ x: 800, y: 585, label: "Manage Scores", tone: "school" })}
    ${useCase({ x: 800, y: 675, label: "Manage Payments", tone: "school" })}

    ${useCase({ x: 1125, y: 295, label: "View Schedule", tone: "service" })}
    ${useCase({ x: 1125, y: 375, label: "Take Attendance", tone: "service" })}
    ${useCase({ x: 1125, y: 455, label: "Add Scores", tone: "service" })}
    ${useCase({ x: 1125, y: 570, label: "View Profile", tone: "service" })}
    ${useCase({ x: 1125, y: 650, label: "View Results", tone: "service" })}
    ${useCase({ x: 1125, y: 730, label: "View Payments", tone: "service" })}

    <path d="M 265 457 H 322 M 322 295 V 745" class="spine" />
    ${association({ x1: 322, y1: 295, x2: 362, y2: 295 })}
    ${association({ x1: 322, y1: 370, x2: 362, y2: 370 })}
    ${association({ x1: 322, y1: 445, x2: 362, y2: 445 })}
    ${association({ x1: 322, y1: 520, x2: 362, y2: 520 })}
    ${association({ x1: 322, y1: 595, x2: 362, y2: 595 })}
    ${association({ x1: 322, y1: 670, x2: 362, y2: 670 })}
    ${association({ x1: 322, y1: 745, x2: 362, y2: 745 })}

    ${association({ x1: 578, y1: 445, x2: 692, y2: 315 })}
    ${association({ x1: 578, y1: 595, x2: 692, y2: 405 })}
    ${association({ x1: 578, y1: 670, x2: 692, y2: 675 })}

    <path d="M 1335 307 H 1275 M 1275 295 V 455" class="spine" />
    ${association({ x1: 1275, y1: 295, x2: 1232, y2: 295 })}
    ${association({ x1: 1275, y1: 375, x2: 1232, y2: 375 })}
    ${association({ x1: 1275, y1: 455, x2: 1232, y2: 455 })}

    <path d="M 1335 627 H 1275 M 1275 570 V 730" class="spine" />
    ${association({ x1: 1275, y1: 570, x2: 1232, y2: 570 })}
    ${association({ x1: 1275, y1: 650, x2: 1232, y2: 650 })}
    ${association({ x1: 1275, y1: 730, x2: 1232, y2: 730 })}
  </g>`;

const professionalBody = `
  <g>
    ${card({ x: 70, y: 130, width: 1460, height: 680, className: "panel", radius: 30 })}

    <text x="120" y="188" class="section-title">1. Users</text>
    <text x="120" y="214" class="section-note">People who use the system</text>
    ${actor({ x: 110, y: 255, title: "Admin", note: "Controls setup, users, reports", accent: "#2563eb", initials: "AD" })}
    ${actor({ x: 110, y: 390, title: "Teacher", note: "Attendance, scores, schedule", accent: "#0f766e", initials: "TR" })}
    ${actor({ x: 110, y: 525, title: "Student", note: "Profile, results, payments", accent: "#db2777", initials: "ST" })}
    ${actor({ x: 110, y: 660, title: "Accounting", note: "Fees, payments, receipts", accent: "#d97706", initials: "AC" })}

    ${card({ x: 430, y: 175, width: 520, height: 575, className: "platform-panel", radius: 28 })}
    <text x="480" y="230" class="section-title">2. StudentSphere App</text>
    <text x="480" y="256" class="section-note">Core modules used every day</text>
    ${moduleCard({ x: 480, y: 300, title: "Authentication", note: "Login, roles, permissions", accent: "#2563eb" })}
    ${moduleCard({ x: 480, y: 410, title: "Academic Management", note: "Students, teachers, classes", accent: "#7c3aed" })}
    ${moduleCard({ x: 480, y: 520, title: "Learning Records", note: "Attendance, scores, timetable", accent: "#0891b2" })}
    ${moduleCard({ x: 480, y: 630, title: "Finance and Reports", note: "Payments, summaries, exports", accent: "#d97706" })}

    ${card({ x: 1060, y: 175, width: 390, height: 575, className: "data-panel", radius: 28 })}
    <text x="1110" y="230" class="section-title">3. Supabase Data</text>
    <text x="1110" y="256" class="section-note">Records saved by each module</text>
    ${dataPill({ x: 1095, y: 300, title: "Users and Profiles", note: "accounts, roles, access", accent: "#2563eb" })}
    ${dataPill({ x: 1095, y: 390, title: "School Records", note: "students, teachers, classes", accent: "#7c3aed" })}
    ${dataPill({ x: 1095, y: 480, title: "Academic Activity", note: "attendance, scores, schedules", accent: "#0891b2" })}
    ${dataPill({ x: 1095, y: 570, title: "Payments and Notices", note: "fees, reports, notifications", accent: "#d97706" })}

    ${flow({ x1: 350, y1: 470, x2: 430, y2: 470, label: "use system", curve: 20 })}
    ${flow({ x1: 950, y1: 470, x2: 1060, y2: 470, label: "save data", className: "flow-soft", curve: 20 })}
    ${flow({ x1: 1060, y1: 545, x2: 950, y2: 545, label: "load records", className: "flow-dashed", curve: 20 })}

    ${card({ x: 70, y: 850, width: 1460, height: 90, className: "panel", radius: 24 })}
    <text x="125" y="904" class="section-title">Simple flow:</text>
    <text x="285" y="904" class="section-note" style="font-size: 18px;">Login -> Choose module -> Add or update data -> Save to Supabase -> View report</text>
  </g>`;

const overviewSvg = wrapSvg({
  width: 1600,
  height: 1000,
  title: "StudentSphere System Process",
  desc: "Modern overview of users, application modules, database tables, and the simple process flow.",
  body: overviewBody,
});

const contextSvg = wrapSvg({
  width: 1400,
  height: 720,
  title: "StudentSphere Context Diagram",
  desc: "Modern context diagram showing how external users interact with the system.",
  body: contextBody,
});

const level0Svg = wrapSvg({
  width: 1600,
  height: 1000,
  title: "StudentSphere DFD Level 0",
  desc: "Modern Level 0 data-flow diagram with clear actors, processes, and data stores.",
  body: level0Body,
});

const useCaseSvg = wrapUseCaseSvg({
  width: 1600,
  height: 960,
  title: "StudentSphere Use Case Diagram",
  desc: "Clean UML-style diagram with actors and oval use cases.",
  body: useCaseBody,
});

const professionalSvg = wrapSvg({
  width: 1600,
  height: 980,
  title: "StudentSphere Professional System Overview",
  desc: "Clean presentation diagram showing users, application modules, database records, and the main workflow.",
  body: professionalBody,
});

mkdirSync(dirname(outputSvgPath), { recursive: true });
writeFileSync(outputSvgPath, overviewSvg);
writeFileSync(contextSvgPath, contextSvg);
writeFileSync(level0SvgPath, level0Svg);
writeFileSync(useCaseSvgPath, useCaseSvg);
writeFileSync(professionalSvgPath, professionalSvg);

console.log(`Wrote ${outputSvgPath}`);
console.log(`Wrote ${contextSvgPath}`);
console.log(`Wrote ${level0SvgPath}`);
console.log(`Wrote ${useCaseSvgPath}`);
console.log(`Wrote ${professionalSvgPath}`);

try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(overviewSvg)).png().toFile(outputPngPath);
  await sharp(Buffer.from(contextSvg)).png().toFile(contextPngPath);
  await sharp(Buffer.from(level0Svg)).png().toFile(level0PngPath);
  await sharp(Buffer.from(useCaseSvg)).png().toFile(useCasePngPath);
  await sharp(Buffer.from(professionalSvg)).png().toFile(professionalPngPath);
  console.log(`Wrote ${outputPngPath}`);
  console.log(`Wrote ${contextPngPath}`);
  console.log(`Wrote ${level0PngPath}`);
  console.log(`Wrote ${useCasePngPath}`);
  console.log(`Wrote ${professionalPngPath}`);
} catch (error) {
  console.warn(`Skipped PNG export because sharp is not available: ${error.message}`);
}
