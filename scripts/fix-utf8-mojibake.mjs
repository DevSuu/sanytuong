#!/usr/bin/env node
/**
 * Automatic & Idempotent UTF-8 Mojibake Repair Script
 *
 * Repairs strings that were accidentally imported into PostgreSQL with Windows-1252 / Latin-1
 * client encoding (e.g. "Season 1 â€” Thá»­ thÃ¡ch sÃ¡ng táº¡o 4.0" -> "Season 1 — Thử thách sáng tạo 4.0").
 *
 * Safe to run repeatedly (idempotent): clean UTF-8 strings are left 100% untouched.
 */

import { Buffer } from "node:buffer";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const CP1252_TO_BYTE = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

// Matches UTF-8 multi-byte sequences misread as CP1252/Latin-1
const MOJIBAKE_HINT =
  /[\u00c2-\u00df][\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018-\u2022\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]|[\u00e0-\u00ef][\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018-\u2022\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]{2}|[\u00f0-\u00f4][\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018-\u2022\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]{3}/;

export function fixMojibakeString(str) {
  if (typeof str !== "string" || str.length < 2 || str.startsWith("data:")) {
    return str;
  }
  if (!MOJIBAKE_HINT.test(str)) {
    return str;
  }

  const bytes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
    } else if (CP1252_TO_BYTE.has(cp)) {
      bytes.push(CP1252_TO_BYTE.get(cp));
    } else {
      return str;
    }
  }

  const decoded = Buffer.from(bytes).toString("utf8");
  if (decoded.includes("\ufffd")) {
    return str;
  }
  return decoded;
}

function fixDeepValue(val) {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(val);
        const inner = fixDeepValue(parsed);
        if (inner.changed) {
          return { value: JSON.stringify(inner.value), changed: true };
        }
      } catch {
        // Fall through to plain string mojibake check
      }
    }
    const next = fixMojibakeString(val);
    return { value: next, changed: next !== val };
  }
  if (Array.isArray(val)) {
    let anyChanged = false;
    const nextArr = val.map((item) => {
      const res = fixDeepValue(item);
      if (res.changed) anyChanged = true;
      return res.value;
    });
    return { value: anyChanged ? nextArr : val, changed: anyChanged };
  }
  if (val && typeof val === "object") {
    let anyChanged = false;
    const nextObj = {};
    for (const [k, v] of Object.entries(val)) {
      const fixedKey = fixMojibakeString(k);
      const res = fixDeepValue(v);
      if (fixedKey !== k || res.changed) anyChanged = true;
      nextObj[fixedKey] = res.value;
    }
    return { value: anyChanged ? nextObj : val, changed: anyChanged };
  }
  return { value: val, changed: false };
}

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes("dummy:dummy@127.0.0.1")) {
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("SET client_encoding TO 'UTF8'");

    // Discover primary keys for all public tables (excluding _prisma_migrations)
    const pkRes = await client.query(`
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND kcu.table_name <> '_prisma_migrations'
      ORDER BY kcu.table_name, kcu.ordinal_position;
    `);

    const pkByTable = new Map();
    for (const row of pkRes.rows) {
      if (!pkByTable.has(row.table_name)) pkByTable.set(row.table_name, []);
      pkByTable.get(row.table_name).push(row.column_name);
    }

    // Discover inspectable text / varchar / jsonb / text[] columns
    const colRes = await client.query(`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name <> '_prisma_migrations'
        AND (
          data_type IN ('text', 'character varying', 'json', 'jsonb')
          OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar'))
        )
      ORDER BY table_name, ordinal_position;
    `);

    const colsByTable = new Map();
    for (const row of colRes.rows) {
      if (!pkByTable.has(row.table_name)) continue;
      if (!colsByTable.has(row.table_name)) colsByTable.set(row.table_name, []);
      colsByTable.get(row.table_name).push(row);
    }

    let totalRowsFixed = 0;

    for (const [tableName, cols] of colsByTable.entries()) {
      const pks = pkByTable.get(tableName);
      // Do not attempt to mutate primary key columns themselves unless safe; inspect non-PK columns
      const targetCols = cols.filter((c) => !pks.includes(c.column_name));
      if (targetCols.length === 0) continue;

      const selectCols = [...pks, ...targetCols.map((c) => c.column_name)]
        .map(quoteIdent)
        .join(", ");

      // Skip huge Base64 image blobs in SystemProbe
      const whereClause =
        tableName === "SystemProbe"
          ? `WHERE LEFT("label", 5) <> 'data:'`
          : "";

      const rowsRes = await client.query(
        `SELECT ${selectCols} FROM ${quoteIdent(tableName)} ${whereClause}`
      );

      for (const row of rowsRes.rows) {
        const updates = [];
        const values = [];
        let paramIdx = 1;

        for (const col of targetCols) {
          const rawVal = row[col.column_name];
          if (rawVal === null || rawVal === undefined) continue;

          const { value: fixedVal, changed } = fixDeepValue(rawVal);
          if (changed) {
            updates.push(`${quoteIdent(col.column_name)} = $${paramIdx++}`);
            values.push(
              col.data_type === "json" || col.data_type === "jsonb"
                ? JSON.stringify(fixedVal)
                : fixedVal
            );
          }
        }

        if (updates.length > 0) {
          const pkConds = pks.map((pk) => {
            values.push(row[pk]);
            return `${quoteIdent(pk)} = $${paramIdx++}`;
          });

          await client.query(
            `UPDATE ${quoteIdent(tableName)} SET ${updates.join(", ")} WHERE ${pkConds.join(" AND ")}`,
            values
          );
          totalRowsFixed++;
        }
      }
    }

    if (totalRowsFixed > 0) {
      console.log(
        `[UTF8-REPAIR] Fixed mojibake encoding in ${totalRowsFixed} database row(s).`
      );
    } else {
      console.log("[UTF8-REPAIR] Database UTF-8 encoding verified clean (0 rows needed repair).");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[UTF8-REPAIR] Warning:", err.message);
});
