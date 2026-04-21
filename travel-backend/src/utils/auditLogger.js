import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.resolve(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'content-audit.log');

let logDirEnsured = false;
function ensureLogDir() {
  if (logDirEnsured) return true;
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    logDirEnsured = true;
    return true;
  } catch (err) {
    console.warn('[auditLogger] 无法创建日志目录:', err?.message || err);
    return false;
  }
}

/** 简单截断，避免日志单行过大。 */
function truncate(str, max = 500) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * 写一条内容审计日志。命中时调用方传入 hit=true，
 * 未命中但希望留痕（如 api_error / network_error）也可以记录。
 *
 * 任意异常均被吞下——审计日志绝不应阻塞主流程。
 *
 * @param {{
 *   event: string,
 *   hit: boolean,
 *   reason: string,
 *   userId?: number|string,
 *   openid?: string,
 *   resource: { type: 'content'|'project', id?: number|string, action: 'create'|'update' },
 *   scene?: number,
 *   text?: string,
 *   detail?: any,
 * }} payload
 */
export function logContentAudit(payload) {
  try {
    if (!ensureLogDir()) return;

    const record = {
      ts: new Date().toISOString(),
      event: payload.event || 'content_sec_check',
      hit: !!payload.hit,
      reason: payload.reason || 'unknown',
      user_id: payload.userId ?? null,
      openid: payload.openid ? truncate(payload.openid, 64) : null,
      resource: payload.resource || null,
      scene: payload.scene ?? null,
      text: truncate(payload.text, 500),
      detail: payload.detail ?? null,
    };

    const line = `${JSON.stringify(record)}\n`;
    fs.appendFile(AUDIT_LOG_FILE, line, (err) => {
      if (err) {
        console.warn('[auditLogger] 写入失败:', err?.message || err);
      }
    });
  } catch (err) {
    console.warn('[auditLogger] 记录异常:', err?.message || err);
  }
}

export const AUDIT_LOG_PATH = AUDIT_LOG_FILE;
