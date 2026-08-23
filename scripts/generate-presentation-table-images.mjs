import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const sourcePath = resolve("src/integrations/supabase/types.ts");
const outputDir = resolve("supabase/table-images");
const source = readFileSync(sourcePath, "utf8");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("Could not find matching brace.");
}

function extractObjectBlock(text, label) {
  const labelIndex = text.indexOf(label);
  if (labelIndex === -1) return "";
  const openIndex = text.indexOf("{", labelIndex);
  const closeIndex = findMatchingBrace(text, openIndex);
  return text.slice(openIndex + 1, closeIndex);
}

function simplifyType(type) {
  const nullable = type.includes("| null");
  const enumMatch = type.match(/Enums"\]\["([^"]+)"\]/);
  const base = enumMatch
    ? `enum:${enumMatch[1]}`
    : type
        .replace(/\s*\|\s*null/g, "")
        .replace(/\s*\|\s*undefined/g, "")
        .trim();
  return `${base}${nullable ? "?" : ""}`;
}

function parseColumns(rowBlock) {
  return rowBlock
    .split("\n")
    .map((line) => line.match(/^\s+([a-zA-Z0-9_]+):\s*(.+);$/))
    .filter(Boolean)
    .map((match) => ({
      name: match[1],
      type: simplifyType(match[2]),
    }));
}

function parseRelationships(block) {
  const relationships = [];
  const relationshipMatches = block.matchAll(
    /\{\s*foreignKeyName:\s*"([^"]+)";\s*columns:\s*\[([^\]]+)\];\s*isOneToOne:\s*(true|false);\s*referencedRelation:\s*"([^"]+)";\s*referencedColumns:\s*\[([^\]]+)\];\s*\}/gms,
  );

  for (const match of relationshipMatches) {
    relationships.push({
      name: match[1],
      columns: [...match[2].matchAll(/"([^"]+)"/g)].map((column) => column[1]),
      referencedTable: match[4],
      referencedColumns: [...match[5].matchAll(/"([^"]+)"/g)].map((column) => column[1]),
    });
  }
  return relationships;
}

function orderColumns(columns) {
  const priority = new Map([
    ["id", 0],
    ["updated_at", 1],
  ]);

  return [...columns].sort((left, right) => {
    const leftPriority = priority.get(left.name) ?? 2;
    const rightPriority = priority.get(right.name) ?? 2;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return columns.indexOf(left) - columns.indexOf(right);
  });
}

function parseTables() {
  const tablesBlock = extractObjectBlock(source, "Tables:");
  const tableMatches = [...tablesBlock.matchAll(/^      ([a-zA-Z0-9_]+): \{/gm)];
  return tableMatches.map((match) => {
    const name = match[1];
    const blockStart = tablesBlock.indexOf("{", match.index);
    const blockEnd = findMatchingBrace(tablesBlock, blockStart);
    const block = tablesBlock.slice(blockStart + 1, blockEnd);
    const rowBlock = extractObjectBlock(block, "Row:");
    return {
      name,
      columns: orderColumns(parseColumns(rowBlock)),
      relationships: parseRelationships(block),
    };
  });
}

function renderKeyCell({ x, y, column, fkColumns }) {
  const centerY = y + 29;
  const isPrimaryKey = column.name === "id";
  const isForeignKey = fkColumns.has(column.name);
  const badge = isPrimaryKey ? "PK" : isForeignKey ? "FK" : "";
  const badgeClass = isPrimaryKey ? "pk-badge" : "fk-badge";

  if (!badge) {
    return `<text x="${x + 125}" y="${centerY + 4}" class="cell cell-center">No</text>`;
  }

  return `
      <rect x="${x + 84}" y="${centerY - 15}" width="38" height="30" rx="7" class="${badgeClass}" />
      <text x="${x + 103}" y="${centerY}" class="badge-text">${badge}</text>
      <text x="${x + 136}" y="${centerY}" class="yes-no">Yes</text>`;
}

function renderPresentationTable(table) {
  const width = 1024;
  const pageMargin = 64;
  const titleY = 90;
  const cardX = 64;
  const cardY = 140;
  const cardWidth = 896;
  const headerHeight = 76;
  const rowHeight = 44;
  const bottomPad = 18;
  const tableHeight = headerHeight + table.columns.length * rowHeight + bottomPad;
  const height = cardY + tableHeight + 92;
  const col1X = cardX + 332;
  const col2X = cardX + 646;
  const fkColumns = new Set(table.relationships.flatMap((relationship) => relationship.columns));

  const rowBackgrounds = table.columns
    .map((_, index) => {
      const y = cardY + headerHeight + index * rowHeight;
      const rowClass = index % 2 === 0 ? "row-even" : "row-odd";
      return `<rect x="${cardX}" y="${y}" width="${cardWidth}" height="${rowHeight}" class="${rowClass}" />`;
    })
    .join("\n    ");

  const horizontalLines = Array.from({ length: table.columns.length + 1 }, (_, index) => {
    const y = cardY + headerHeight + index * rowHeight;
    return `<line x1="${cardX}" y1="${y}" x2="${cardX + cardWidth}" y2="${y}" class="grid" />`;
  }).join("\n    ");

  const rows = table.columns
    .map((column, index) => {
      const y = cardY + headerHeight + index * rowHeight;
      const textY = y + 30;
      return `
      <text x="${cardX + 166}" y="${textY}" class="cell cell-center">${escapeXml(column.name)}</text>
      <text x="${col1X + 26}" y="${textY}" class="cell">${escapeXml(column.type)}</text>
      ${renderKeyCell({ x: col2X, y, column, fkColumns })}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Table: ${escapeXml(table.name)}</title>
  <desc id="desc">Presentation-style database table image for the ${escapeXml(table.name)} table.</desc>
  <defs>
    <filter id="cardShadow" x="-8%" y="-6%" width="116%" height="120%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18" />
    </filter>
    <clipPath id="cardClip">
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${tableHeight}" rx="18" />
    </clipPath>
    <linearGradient id="headerGradient" x1="${cardX}" y1="${cardY}" x2="${cardX + cardWidth}" y2="${cardY + headerHeight}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0f4a8a" />
      <stop offset="1" stop-color="#153f78" />
    </linearGradient>
    <style>
      .page { fill: #f8fafc; }
      .title { fill: #050505; font: 700 52px Arial, sans-serif; text-anchor: middle; }
      .card { fill: #ffffff; stroke: #d1d5db; stroke-width: 2; filter: url(#cardShadow); }
      .header { fill: url(#headerGradient); }
      .header-text { fill: #ffffff; font: 700 36px Arial, sans-serif; }
      .row-even { fill: #ffffff; }
      .row-odd { fill: #eeeeee; }
      .grid { stroke: #b7b7b7; stroke-width: 1.4; }
      .cell { fill: #0b0b0b; font: 400 26px Arial, sans-serif; }
      .cell-center { text-anchor: middle; }
      .badge-text { fill: #ffffff; font: 700 15px Arial, sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .yes-no { fill: #0b0b0b; font: 400 26px Arial, sans-serif; dominant-baseline: middle; }
      .pk-badge { fill: #a66b3d; }
      .fk-badge { fill: #4d9461; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" class="page" />
  <text x="${width / 2}" y="${titleY}" class="title">Table: ${escapeXml(table.name)}</text>

  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${tableHeight}" rx="18" class="card" />
  <g clip-path="url(#cardClip)">
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${headerHeight}" class="header" />
    ${rowBackgrounds}

    <line x1="${col1X}" y1="${cardY}" x2="${col1X}" y2="${cardY + tableHeight}" class="grid" />
    <line x1="${col2X}" y1="${cardY}" x2="${col2X}" y2="${cardY + tableHeight}" class="grid" />
    ${horizontalLines}

    <text x="${cardX + 26}" y="${cardY + 48}" class="header-text">Field Name</text>
    <text x="${col1X + 26}" y="${cardY + 48}" class="header-text">Data Type</text>
    <text x="${col2X + 100}" y="${cardY + 48}" class="header-text">Key</text>
    ${rows}
  </g>
</svg>
`;
}

const tables = parseTables();

if (tables.length === 0) {
  throw new Error(`No tables found in ${sourcePath}`);
}

mkdirSync(outputDir, { recursive: true });

const { default: sharp } = await import("sharp");

for (const table of tables) {
  const svg = renderPresentationTable(table);
  const svgPath = join(outputDir, `${table.name}-presentation.svg`);
  const pngPath = join(outputDir, `${table.name}-presentation.png`);
  writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
}

console.log(`Wrote ${tables.length} presentation table SVG/PNG pairs to ${outputDir}`);
