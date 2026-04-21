import { Content, Location, User } from '../models/index.js';
import { getProjectById, getProjectOrThrow } from './projectService.js';
import { filterViewableContents } from './privacyService.js';
import {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeResourceUrl,
  sanitizeResourceUrlList,
  extractPlainTextFromHtml,
} from '../utils/sanitize.js';
import { checkTextContent, AUDIT_SCENE } from './wechatContentSecurity.js';
import { logContentAudit } from '../utils/auditLogger.js';

const ALLOWED_CONTENT_TYPES = new Set(['photo', 'note', 'audio']);
const MAX_RICH_HTML_LENGTH = 64 * 1024;

function ensureProjectEditable(project) {
  if (Number(project.is_archived) === 1) {
    const err = new Error('项目已归档，不能修改内容，请先取消归档');
    err.status = 403;
    throw err;
  }
}

/**
 * 规范化 content_data：清洗富文本、校验资源 URL、过滤控制字符并限制长度。
 * 只保留白名单字段，防止恶意客户端塞入未预期的 JSON 键。
 */
function normalizeContentData(input) {
  const data = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const out = {};

  const title = sanitizePlainText(data.title, { maxLength: 120 });
  if (title) out.title = title;

  const caption = sanitizePlainText(data.caption, { maxLength: 120 });
  if (caption) out.caption = caption;

  if (data.content !== undefined && data.content !== null) {
    const raw = typeof data.content === 'string' ? data.content : '';
    const cleaned = sanitizeRichText(raw);
    if (cleaned.length > MAX_RICH_HTML_LENGTH) {
      const err = new Error(`富文本正文超过最大长度 ${MAX_RICH_HTML_LENGTH} 字符`);
      err.status = 400;
      throw err;
    }
    out.content = cleaned;
  }

  if (data.location_text && typeof data.location_text === 'object') {
    const name = sanitizePlainText(data.location_text.name, { maxLength: 200 });
    const address = sanitizePlainText(data.location_text.address, { maxLength: 200 });
    if (name || address) {
      out.location_text = {};
      if (name) out.location_text.name = name;
      if (address) out.location_text.address = address;
    }
  }

  if (Array.isArray(data.images) && data.images.length) {
    const images = sanitizeResourceUrlList(data.images, 9);
    if (images.length) out.images = images;
  }

  if (data.audio && typeof data.audio === 'object') {
    const url = sanitizeResourceUrl(data.audio.url, { allowEmpty: true });
    if (url) {
      out.audio = { url };
      const name = sanitizePlainText(data.audio.name, { maxLength: 120 });
      if (name) out.audio.name = name;
    }
  }

  return out;
}

function assertContentType(contentType) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    const err = new Error('内容类型只能是 photo / note / audio');
    err.status = 400;
    throw err;
  }
}

/**
 * 把 content_data 里所有可读文本拼成一条，供微信 msgSecCheck 送检。
 */
function collectAuditText(contentData) {
  if (!contentData || typeof contentData !== 'object') return { title: '', body: '' };
  const title = (contentData.title || contentData.caption || '').trim();
  const bodyParts = [];
  if (contentData.content) bodyParts.push(extractPlainTextFromHtml(contentData.content));
  if (contentData.location_text) {
    if (contentData.location_text.name) bodyParts.push(contentData.location_text.name);
    if (contentData.location_text.address) bodyParts.push(contentData.location_text.address);
  }
  if (contentData.audio?.name) bodyParts.push(contentData.audio.name);
  return {
    title,
    body: bodyParts.filter(Boolean).join(' \n ').trim(),
  };
}

/**
 * 异步内容送检：命中/接口异常均写审计日志，永远不抛。
 */
function queueContentAudit({ content, userId, action }) {
  const contentData = content.content_data || {};
  const { title, body } = collectAuditText(contentData);
  const combined = [title, body].filter(Boolean).join(' \n ').trim();
  if (!combined) return;

  setImmediate(async () => {
    try {
      const user = await User.findByPk(userId, { attributes: ['openid'] }).catch(() => null);
      const openid = user?.openid || '';
      const result = await checkTextContent({
        content: body || title,
        title,
        openid,
        scene: AUDIT_SCENE.SOCIAL_LOG,
      });
      if (result.pass) return;
      logContentAudit({
        event: 'content_sec_check',
        hit: result.reason === 'risky' || result.reason === 'review',
        reason: result.reason,
        userId,
        openid,
        resource: {
          type: 'content',
          id: content.content_id,
          action,
          project_id: content.project_id,
        },
        scene: AUDIT_SCENE.SOCIAL_LOG,
        text: combined,
        detail: result.raw,
      });
    } catch (err) {
      logContentAudit({
        event: 'content_sec_check',
        hit: false,
        reason: 'exception',
        userId,
        resource: {
          type: 'content',
          id: content.content_id,
          action,
          project_id: content.project_id,
        },
        text: combined,
        detail: { message: String(err?.message || err) },
      });
    }
  });
}

export async function listContents(projectId, userId, options = {}) {
  const project = await getProjectById(projectId, userId, {
    shareId: options.shareId,
  });
  const contents = await Content.findAll({
    where: { 
      project_id: projectId,
    },
    include: [{
      model: Location,
      as: 'location',
      required: false,
    }],
    order: [
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
    ],
  });

  return filterViewableContents(contents, userId, {
    projectId: project.project_id,
    ownerUserId: project.user_id,
  });
}

export async function createContent(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  ensureProjectEditable(project);
  const { content_type, content_data, record_time, sort_order, location } = payload;
  let { location_id } = payload;

  if (!content_type || !content_data || !record_time) {
    const err = new Error('内容类型、内容数据和记录时间是必填选项');
    err.status = 400;
    throw err;
  }

  assertContentType(content_type);
  const normalizedData = normalizeContentData(content_data);

  // 如果传递了 location 对象且包含经纬度，则自动在后台创建 Location
  if (location && location.latitude && location.longitude && !location_id) {
    const newLoc = await Location.create({
      latitude: location.latitude,
      longitude: location.longitude,
      name: sanitizePlainText(location.name, { maxLength: 200 }) || null,
      address: sanitizePlainText(location.address, { maxLength: 200 }) || null,
    });
    location_id = newLoc.location_id;
  }

  const created = await Content.create({
    project_id: project.project_id,
    content_type,
    content_data: normalizedData,
    record_time,
    location_id: location_id || null,
    sort_order: sort_order || 0,
  });

  queueContentAudit({ content: created, userId, action: 'create' });
  return created;
}

export async function getContentOrThrow(projectId, contentId, userId) {
  await getProjectOrThrow(projectId, userId);
  const content = await Content.findOne({
    where: {
      content_id: contentId,
      project_id: projectId,
    }
  });
  if (!content) {
    const err = new Error('未找到该内容');
    err.status = 404;
    throw err;
  }
  return content;
}

export async function updateContent(projectId, contentId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  ensureProjectEditable(project);
  const content = await getContentOrThrow(projectId, contentId, userId);
  const { content_type, content_data, record_time, location_id, sort_order } = payload;

  if (content_type !== undefined) {
    assertContentType(content_type);
  }

  const nextContentData = content_data !== undefined
    ? normalizeContentData(content_data)
    : content.content_data;

  const updated = await content.update({
    content_type: content_type !== undefined ? content_type : content.content_type,
    content_data: nextContentData,
    record_time: record_time !== undefined ? record_time : content.record_time,
    location_id: location_id !== undefined ? location_id : content.location_id,
    sort_order: sort_order !== undefined ? sort_order : content.sort_order,
  });

  if (content_data !== undefined) {
    queueContentAudit({ content: updated, userId, action: 'update' });
  }
  return updated;
}

export async function deleteContent(projectId, contentId, userId) {
  const project = await getProjectOrThrow(projectId, userId);
  ensureProjectEditable(project);
  const content = await getContentOrThrow(projectId, contentId, userId);
  await content.destroy();
}
