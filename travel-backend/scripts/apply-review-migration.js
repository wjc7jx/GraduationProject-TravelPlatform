import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../13.数据库更新语句_内容合规审核标记.sql'
);

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_db',
    multipleStatements: true,
  });

  const hasFile = await fs.access(MIGRATION_PATH).then(() => true).catch(() => false);
  console.log(`[migrate] migration file: ${MIGRATION_PATH} (exists=${hasFile})`);

  const tasks = [
    { table: 'projects', column: 'review_status', ddl: "ADD COLUMN `review_status` ENUM('ok','flagged') NOT NULL DEFAULT 'ok' AFTER `is_archived`" },
    { table: 'projects', column: 'review_reason', ddl: "ADD COLUMN `review_reason` VARCHAR(64) DEFAULT NULL AFTER `review_status`" },
    { table: 'projects', column: 'review_checked_at', ddl: "ADD COLUMN `review_checked_at` DATETIME DEFAULT NULL AFTER `review_reason`" },
    { table: 'contents', column: 'review_status', ddl: "ADD COLUMN `review_status` ENUM('ok','flagged') NOT NULL DEFAULT 'ok' AFTER `sort_order`" },
    { table: 'contents', column: 'review_reason', ddl: "ADD COLUMN `review_reason` VARCHAR(64) DEFAULT NULL AFTER `review_status`" },
    { table: 'contents', column: 'review_checked_at', ddl: "ADD COLUMN `review_checked_at` DATETIME DEFAULT NULL AFTER `review_reason`" },
  ];

  for (const { table, column, ddl } of tasks) {
    if (await columnExists(conn, table, column)) {
      console.log(`[skip] ${table}.${column} already exists`);
      continue;
    }
    console.log(`[apply] ALTER TABLE ${table} ${ddl}`);
    await conn.query(`ALTER TABLE \`${table}\` ${ddl}`);
  }

  const indexes = [
    { table: 'projects', name: 'idx_projects_review_status', columns: '`review_status`' },
    { table: 'contents', name: 'idx_contents_project_review', columns: '`project_id`, `review_status`' },
  ];

  for (const { table, name, columns } of indexes) {
    if (await indexExists(conn, table, name)) {
      console.log(`[skip] index ${table}.${name} exists`);
      continue;
    }
    console.log(`[apply] CREATE INDEX ${name} ON ${table}(${columns})`);
    await conn.query(`ALTER TABLE \`${table}\` ADD KEY \`${name}\` (${columns})`);
  }

  await conn.end();
  console.log('[done] migration applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
