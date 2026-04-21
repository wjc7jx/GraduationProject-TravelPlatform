import { getWechatAccessToken, isWechatAccessTokenConfigured } from './wechatAccessToken.js';

/**
 * 微信小程序「内容安全」文本送检封装。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
 *
 * 结果判定：
 * - errcode !== 0：视为「请求失败」，not pass，由调用方决定重试或忽略。
 * - result.suggest: 'pass' | 'review' | 'risky'
 *   - 'pass' 视为通过；其它视为命中需记录。
 * - 兼容旧版（无 result 字段、仅 errcode 0），一律按通过处理。
 *
 * scene 取值（业务约定）：
 *   1 资料（个人/项目标题、副标题、标签）
 *   2 评论
 *   3 论坛
 *   4 社交日志（旅行记录正文）
 */

const SEC_CHECK_URL = 'https://api.weixin.qq.com/wxa/msg_sec_check';
const FETCH_TIMEOUT_MS = 10 * 1000;
const MAX_TEXT_LENGTH = 2500; // 微信接口单次上限约 2500 字；多出部分裁剪

export const AUDIT_SCENE = Object.freeze({
  PROFILE: 1,
  COMMENT: 2,
  FORUM: 3,
  SOCIAL_LOG: 4,
});

function truncateForCheck(text) {
  if (!text) return '';
  const s = String(text);
  return s.length > MAX_TEXT_LENGTH ? s.slice(0, MAX_TEXT_LENGTH) : s;
}

/**
 * @param {object} params
 * @param {string} params.content 必填，送检正文
 * @param {string} [params.openid] 用户 openid（v2 必填；缺失会被微信拒绝）
 * @param {number} [params.scene] scene，默认 4 社交日志
 * @param {string} [params.title] 可选：标题
 * @param {string} [params.nickname] 可选：昵称
 * @param {string} [params.signature] 可选：个性签名
 * @returns {Promise<{ pass: boolean, reason: string, raw: any }>}
 *   - pass=true 表示微信认为通过；pass=false 表示命中或请求失败
 *   - reason: 'ok' | 'not_configured' | 'risky' | 'review' | 'api_error' | 'network_error'
 */
export async function checkTextContent({
  content,
  openid,
  scene = AUDIT_SCENE.SOCIAL_LOG,
  title,
  nickname,
  signature,
}) {
  const text = truncateForCheck(content);
  if (!text) {
    return { pass: true, reason: 'ok', raw: null };
  }

  if (!isWechatAccessTokenConfigured()) {
    return { pass: true, reason: 'not_configured', raw: null };
  }

  let token;
  try {
    token = await getWechatAccessToken();
  } catch (err) {
    return { pass: false, reason: 'network_error', raw: { stage: 'token', message: String(err?.message || err) } };
  }
  if (!token) {
    return { pass: true, reason: 'not_configured', raw: null };
  }

  const body = {
    version: 2,
    scene,
    content: text,
    openid: openid || '',
  };
  if (title) body.title = truncateForCheck(title);
  if (nickname) body.nickname = truncateForCheck(nickname);
  if (signature) body.signature = truncateForCheck(signature);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let json;
  try {
    const res = await fetch(`${SEC_CHECK_URL}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { pass: false, reason: 'network_error', raw: { stage: 'http', status: res.status } };
    }
    json = await res.json();
  } catch (err) {
    return { pass: false, reason: 'network_error', raw: { stage: 'fetch', message: String(err?.message || err) } };
  } finally {
    clearTimeout(timer);
  }

  if (json && typeof json === 'object' && json.errcode !== 0) {
    return { pass: false, reason: 'api_error', raw: json };
  }

  const suggest = json?.result?.suggest;
  if (suggest === 'risky') {
    return { pass: false, reason: 'risky', raw: json };
  }
  if (suggest === 'review') {
    return { pass: false, reason: 'review', raw: json };
  }

  return { pass: true, reason: 'ok', raw: json };
}
