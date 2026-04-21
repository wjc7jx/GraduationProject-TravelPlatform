import { env } from '../config/env.js';

/**
 * 进程内缓存微信小程序全局 access_token。
 *
 * 微信服务端 token 有效期 7200s，且全局唯一；多实例部署需改为共享缓存（Redis 等）。
 * 本项目为单进程毕业设计场景，按内存缓存 + 提前 5 分钟续期处理即可。
 */

const TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const EARLY_REFRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;

let cache = {
  token: '',
  expiresAt: 0,
};
let inflight = null;

function isWechatConfigured() {
  const { appId, appSecret } = env.wechat;
  return !!(appId && appSecret);
}

async function fetchTokenFromWechat() {
  const { appId, appSecret } = env.wechat;
  const url = `${TOKEN_URL}?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json.access_token || !json.expires_in) {
      throw new Error(`微信返回异常: ${JSON.stringify(json).slice(0, 200)}`);
    }
    return {
      token: String(json.access_token),
      expiresAt: Date.now() + Number(json.expires_in) * 1000,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 获取有效的 access_token。
 * - 未配置微信 appId/appSecret 时返回 null（调用方需自行跳过后续动作）。
 * - 出错时抛错；调用方决定是否吞掉。
 *
 * @returns {Promise<string|null>}
 */
export async function getWechatAccessToken() {
  if (!isWechatConfigured()) return null;

  const now = Date.now();
  if (cache.token && cache.expiresAt - EARLY_REFRESH_MS > now) {
    return cache.token;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const fresh = await fetchTokenFromWechat();
      cache = fresh;
      return fresh.token;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * 测试/调试用：强制清空缓存。
 */
export function __resetWechatAccessTokenCache() {
  cache = { token: '', expiresAt: 0 };
  inflight = null;
}

export function isWechatAccessTokenConfigured() {
  return isWechatConfigured();
}
