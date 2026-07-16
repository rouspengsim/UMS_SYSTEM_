import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const sourcePath = resolve("src/integrations/supabase/types.ts");
const outputPath = resolve("supabase/database-schema.svg");
const pngOutputPath = resolve("supabase/database-schema.png");
const tableImagesDir = resolve("supabase/table-images");
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

const tablesBlock = extractObjectBlock(source, "Tables:");
const tableMatches = [...tablesBlock.matchAll(/^      ([a-zA-Z0-9_]+): \{/gm)];
const tables = tableMatches.map((match) => {
  const name = match[1];
  const blockStart = tablesBlock.indexOf("{", match.index);
  const blockEnd = findMatchingBrace(tablesBlock, blockStart);
  const block = tablesBlock.slice(blockStart + 1, blockEnd);
  const rowBlock = extractObjectBlock(block, "Row:");
  return {
    name,
    columns: parseColumns(rowBlock),
    relationships: parseRelationships(block),
  };
});

if (tables.length === 0) {
  throw new Error(`No tables found in ${sourcePath}`);
}

const fkColumns = new Map();
for (const table of tables) {
  fkColumns.set(
    table.name,
    new Set(table.relationships.flatMap((relationship) => relationship.columns)),
  );
}

const cardWidth = 360;
const titleHeight = 42;
const columnHeight = 22;
const cardPadding = 16;
const gapX = 34;
const gapY = 30;
const margin = 42;
const columns = 4;
const headerHeight = 88;
const columnHeights = Array.from({ length: columns }, () => headerHeight);

for (const table of tables) {
  const columnIndex = columnHeights.indexOf(Math.min(...columnHeights));
  const height = titleHeight + cardPadding + table.columns.length * columnHeight + cardPadding;
  table.layout = {
    x: margin + columnIndex * (cardWidth + gapX),
    y: columnHeights[columnIndex],
    width: cardWidth,
    height,
  };
  columnHeights[columnIndex] += height + gapY;
}

const width = margin * 2 + columns * cardWidth + (columns - 1) * gapX;
const height = Math.max(...columnHeights) + margin;
const tableByName = new Map(tables.map((table) => [table.name, table]));

const sharedStyles = `
      .background { fill: #f8fafc; }
      .headline { fill: #0f172a; font: 700 28px Arial, sans-serif; }
      .subhead { fill: #475569; font: 14px Arial, sans-serif; }
      .legend { fill: #334155; font: 12px Arial, sans-serif; }
      .card-shadow { fill: #0f172a; opacity: 0.08; transform: translate(0, 2px); }
      .card { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; }
      .card-title, .card-title-fill { fill: #123c69; }
      .table-name { fill: #ffffff; font: 700 16px Arial, sans-serif; }
      .table-count { fill: #bfdbfe; font: 12px Arial, sans-serif; text-anchor: end; }
      .column-marker { fill: #b45309; font: 700 11px Arial, sans-serif; }
      .column-name { fill: #111827; font: 13px Arial, sans-serif; }
      .column-type { fill: #64748b; font: 12px Arial, sans-serif; text-anchor: end; }
`;

function center(layout) {
  return {
    x: layout.x + layout.width / 2,
    y: layout.y + layout.height / 2,
  };
}

function edgePath(from, to) {
  const source = center(from.layout);
  const target = center(to.layout);
  const curve = Math.max(70, Math.abs(target.x - source.x) * 0.35);
  const c1x = source.x + (target.x > source.x ? curve : -curve);
  const c2x = target.x - (target.x > source.x ? curve : -curve);
  return `M ${source.x} ${source.y} C ${c1x} ${source.y}, ${c2x} ${target.y}, ${target.x} ${target.y}`;
}

const edgeElements = [];
for (const table of tables) {
  for (const relationship of table.relationships) {
    const target = tableByName.get(relationship.referencedTable);
    if (!target) continue;
    edgeElements.push(
      `<path d="${edgePath(table, target)}" fill="none" stroke="#64748b" stroke-width="1.4" stroke-opacity="0.48" marker-end="url(#arrow)" />`,
    );
  }
}

function renderTableCard(table, layout) {
  const { x, y, width: w, height: h } = layout;
  const fks = fkColumns.get(table.name) ?? new Set();
  const columnRows = table.columns
    .map((column, index) => {
      const label = column.name === "id" ? "PK" : fks.has(column.name) ? "FK" : "";
      const rowY = y + titleHeight + cardPadding + index * columnHeight;
      const marker = label
        ? `<text x="${x + 18}" y="${rowY + 15}" class="column-marker">${label}</text>`
        : "";
      return `
          ${marker}
          <text x="${x + 52}" y="${rowY + 15}" class="column-name">${escapeXml(column.name)}</text>
          <text x="${x + w - 18}" y="${rowY + 15}" class="column-type">${escapeXml(column.type)}</text>`;
    })
    .join("");

  return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="card-shadow" />
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="card" />
        <rect x="${x}" y="${y}" width="${w}" height="${titleHeight}" rx="8" class="card-title" />
        <path d="M ${x} ${y + titleHeight - 8} H ${x + w} V ${y + titleHeight} H ${x} Z" class="card-title-fill" />
        <text x="${x + 18}" y="${y + 27}" class="table-name">${escapeXml(table.name)}</text>
        <text x="${x + w - 18}" y="${y + 27}" class="table-count">${table.columns.length} columns</text>
        ${columnRows}
      </g>`;
}

const tableElements = tables
  .map((table) => {
    return renderTableCard(table, table.layout);
  })
  .join("");

const relationshipCount = tables.reduce((count, table) => count + table.relationships.length, 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">StudentSphere database schema</title>
  <desc id="desc">Database table diagram generated from src/integrations/supabase/types.ts.</desc>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 9 3 L 0 6 z" fill="#64748b" fill-opacity="0.65" />
    </marker>
    <style>
${sharedStyles}
    </style>
  </defs>
  <rect width="${width}" height="${height}" class="background" />
  <text x="${margin}" y="42" class="headline">StudentSphere Database Tables</text>
  <text x="${margin}" y="66" class="subhead">Generated from src/integrations/supabase/types.ts: ${tables.length} tables, ${relationshipCount} relationships</text>
  <text x="${width - margin}" y="45" class="legend" text-anchor="end">PK = primary key, FK = foreign key</text>
  <g>${edgeElements.join("\n")}</g>
  <g>${tableElements}</g>
</svg>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, svg);

console.log(`Wrote ${outputPath}`);

try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(svg)).png().toFile(pngOutputPath);
  console.log(`Wrote ${pngOutputPath}`);

  mkdirSync(tableImagesDir, { recursive: true });
  for (const table of tables) {
    const singleTableWidth = 560;
    const singleTableMargin = 32;
    const singleTableHeaderHeight = 78;
    const singleTableCardHeight =
      titleHeight + cardPadding + table.columns.length * columnHeight + cardPadding;
    const singleTableHeight = singleTableHeaderHeight + singleTableCardHeight + singleTableMargin;
    const singleTableLayout = {
      x: singleTableMargin,
      y: singleTableHeaderHeight,
      width: singleTableWidth - singleTableMargin * 2,
      height: singleTableCardHeight,
    };
    const relatedTables = table.relationships
      .map(
        (relationship) => `${relationship.columns.join(", ")} -> ${relationship.referencedTable}`,
      )
      .join("; ");
    const subhead = relatedTables || "No foreign-key relationships";
    const tableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${singleTableWidth}" height="${singleTableHeight}" viewBox="0 0 ${singleTableWidth} ${singleTableHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(table.name)} table</title>
  <desc id="desc">Columns and keys for the ${escapeXml(table.name)} database table.</desc>
  <defs>
    <style>
${sharedStyles}
      .single-headline { fill: #0f172a; font: 700 24px Arial, sans-serif; }
      .single-subhead { fill: #475569; font: 13px Arial, sans-serif; }
    </style>
  </defs>
  <rect width="${singleTableWidth}" height="${singleTableHeight}" class="background" />
  <text x="${singleTableMargin}" y="34" class="single-headline">${escapeXml(table.name)}</text>
  <text x="${singleTableMargin}" y="57" class="single-subhead">${escapeXml(subhead)}</text>
  ${renderTableCard(table, singleTableLayout)}
</svg>
`;
    const tableSvgPath = join(tableImagesDir, `${table.name}.svg`);
    const tablePngPath = join(tableImagesDir, `${table.name}.png`);
    writeFileSync(tableSvgPath, tableSvg);
    await sharp(Buffer.from(tableSvg)).png().toFile(tablePngPath);
  }
  console.log(`Wrote ${tables.length} table SVG/PNG pairs to ${tableImagesDir}`);
} catch (error) {
  console.warn(`Skipped PNG export because sharp is not available: ${error.message}`);
}
