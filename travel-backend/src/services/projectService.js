import { Permission, Project, User, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import {
  canView,
  getProjectRule,
} from './privacyService.js';
import { getActiveProjectShare } from './projectShareService.js';
import { sanitizePlainText, sanitizeResourceUrl } from '../utils/sanitize.js';
import { checkTextContent, AUDIT_SCENE } from './wechatContentSecurity.js';
import { logContentAudit } from '../utils/auditLogger.js';

/** 把以逗号分隔的 tags 字符串清洗为统一格式。 */
function normalizeTags(input) {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'string') return '';
  const parts = input.split(',')
    .map((tag) => sanitizePlainText(tag, { maxLength: 24 }))
    .filter(Boolean);
  const unique = Array.from(new Set(parts)).slice(0, 20);
  return unique.join(',');
}

/** 封面图地址：空值放行，其它走资源白名单。 */
function normalizeCoverImage(input) {
  if (input === undefined) return undefined;
  if (input === null || input === '') return '';
  return sanitizeResourceUrl(input, { allowEmpty: true });
}

/**
 * 项目文本内容送检：命中时写审计日志 + 数据库标记；接口异常仅记审计，不标记。
 * 永远不抛：不能影响用户主链路。
 */
function queueProjectAudit({ project, userId, action }) {
  const title = (project.title || '').trim();
  const subtitle = (project.subtitle || '').trim();
  const tags = (project.tags || '').trim();
  const combined = [title, subtitle, tags].filter(Boolean).join(' \n ').trim();
  if (!combined) return;

  setImmediate(async () => {
    try {
      const user = await User.findByPk(userId, { attributes: ['openid'] }).catch(() => null);
      const openid = user?.openid || '';
      const result = await checkTextContent({
        content: [subtitle, tags].filter(Boolean).join(' \n ') || title,
        title,
        openid,
        scene: AUDIT_SCENE.PROFILE,
      });
      if (result.pass) return;

      const hit = result.reason === 'risky' || result.reason === 'review';
      logContentAudit({
        event: 'content_sec_check',
        hit,
        reason: result.reason,
        userId,
        openid,
        resource: {
          type: 'project',
          id: project.project_id,
          action,
        },
        scene: AUDIT_SCENE.PROFILE,
        text: combined,
        detail: result.raw,
      });

      if (hit) {
        try {
          await Project.update(
            {
              review_status: 'flagged',
              review_reason: String(result.reason || 'flagged').slice(0, 64),
              review_checked_at: new Date(),
            },
            { where: { project_id: project.project_id } }
          );
        } catch (dbErr) {
          logContentAudit({
            event: 'content_sec_check',
            hit: false,
            reason: 'db_update_failed',
            userId,
            resource: {
              type: 'project',
              id: project.project_id,
              action,
            },
            detail: { message: String(dbErr?.message || dbErr) },
          });
        }
      }
    } catch (err) {
      logContentAudit({
        event: 'content_sec_check',
        hit: false,
        reason: 'exception',
        userId,
        resource: {
          type: 'project',
          id: project.project_id,
          action,
        },
        text: combined,
        detail: { message: String(err?.message || err) },
      });
    }
  });
}

export async function listProjects(userId, filters = {}) {
  const where = {
    user_id: userId,
  };

  const keyword = (filters.keyword || '').trim();
  const tag = (filters.tag || '').trim();
  const startDate = (filters.startDate || '').trim();
  const endDate = (filters.endDate || '').trim();

  const andConditions = [];

  if (keyword) {
    andConditions.push({
      [Op.or]: [
        { title: { [Op.like]: `%${keyword}%` } },
        { subtitle: { [Op.like]: `%${keyword}%` } },
      ],
    });
  }

  if (tag) {
    andConditions.push({
      tags: { [Op.like]: `%${tag}%` },
    });
  }

  if (startDate) {
    andConditions.push({
      start_date: { [Op.gte]: startDate },
    });
  }

  if (endDate) {
    andConditions.push({
      [Op.or]: [
        { end_date: { [Op.lte]: endDate } },
        {
          [Op.and]: [
            { end_date: null },
            { start_date: { [Op.lte]: endDate } },
          ],
        },
      ],
    });
  }

  if (andConditions.length > 0) {
    where[Op.and] = andConditions;
  }

  return Project.findAll({
    where,
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM contents AS content
            WHERE
              content.project_id = Project.project_id
              AND content.location_id IS NOT NULL
          )`),
          'locationCount'
        ]
      ]
    },
    order: [['is_pinned', 'DESC'], ['pinned_at', 'DESC'], ['created_at', 'DESC']]
  });
}

export async function createProject(userId, payload) {
  const { title, subtitle, cover_image, start_date, end_date, tags } = payload;
  if (!title || !start_date) {
    const err = new Error('旅行名称和开始时间是必填项');
    err.status = 400;
    throw err;
  }

  const cleanTitle = sanitizePlainText(title, { maxLength: 100 });
  if (!cleanTitle) {
    const err = new Error('旅行名称不能为空');
    err.status = 400;
    throw err;
  }

  const created = await Project.create({
    user_id: userId,
    title: cleanTitle,
    subtitle: sanitizePlainText(subtitle, { maxLength: 200 }) || null,
    cover_image: normalizeCoverImage(cover_image) || null,
    start_date,
    end_date,
    tags: normalizeTags(tags) || null,
    review_status: 'ok',
    review_reason: null,
    review_checked_at: null,
  });

  queueProjectAudit({ project: created, userId, action: 'create' });
  return created;
}

export async function getProjectById(projectId, userId, options = {}) {
  const pid = Number(projectId);
  const uid = Number(userId);
  const shareId = String(options.shareId || '').trim();

  const project = await Project.findOne({
    where: {
      project_id: pid,
    },
  });
  if (!project) {
    const err = new Error('未找到该旅行项目');
    err.status = 404;
    throw err;
  }

  if (Number(project.user_id) === uid) {
    return project;
  }

  if (!shareId) {
    const err = new Error('无权查看该项目');
    err.status = 403;
    throw err;
  }

  await getActiveProjectShare(pid, shareId);
  const rule = await getProjectRule(pid);
  const viewable = await canView(rule, project.user_id, uid);
  if (!viewable) {
    const err = new Error('无权查看该项目');
    err.status = 403;
    throw err;
  }

  return project;
}

export async function getProjectOrThrow(projectId, userId) {
  // TODO: findOne返回的数据是什么？
  const project = await Project.findOne({ 
    where: { 
      project_id: projectId, 
      user_id: userId,
    } 
  });
  if (!project) {
    const err = new Error('未找到该旅行项目');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function updateProject(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { title, subtitle, cover_image, start_date, end_date, tags, is_archived } = payload;
  const nextArchived = is_archived !== undefined ? Number(is_archived) : undefined;
  const hasEditableFieldChanges = [title, subtitle, cover_image, start_date, end_date, tags]
    .some((value) => value !== undefined);

  if (nextArchived !== undefined && ![0, 1].includes(nextArchived)) {
    const err = new Error('归档状态参数无效');
    err.status = 400;
    throw err;
  }

  if (Number(project.is_archived) === 1 && hasEditableFieldChanges) {
    const err = new Error('项目已归档，不能修改项目信息，请先取消归档');
    err.status = 403;
    throw err;
  }
  
  if (title !== undefined && !title) {
    const err = new Error('旅行名称不能为空');
    err.status = 400;
    throw err;
  }
  if (start_date !== undefined && !start_date) {
    const err = new Error('开始时间不能为空');
    err.status = 400;
    throw err;
  }

  let nextTitle = project.title;
  if (title !== undefined) {
    const cleaned = sanitizePlainText(title, { maxLength: 100 });
    if (!cleaned) {
      const err = new Error('旅行名称不能为空');
      err.status = 400;
      throw err;
    }
    nextTitle = cleaned;
  }

  const nextSubtitle = subtitle !== undefined
    ? (sanitizePlainText(subtitle, { maxLength: 200 }) || null)
    : project.subtitle;

  const nextCover = cover_image !== undefined
    ? (normalizeCoverImage(cover_image) || null)
    : project.cover_image;

  const nextTags = tags !== undefined
    ? (normalizeTags(tags) || null)
    : project.tags;

  const textTouched = title !== undefined || subtitle !== undefined || tags !== undefined;
  const updatePayload = {
    title: nextTitle,
    subtitle: nextSubtitle,
    cover_image: nextCover,
    start_date: start_date !== undefined ? start_date : project.start_date,
    end_date: end_date !== undefined ? end_date : project.end_date,
    tags: nextTags,
    is_archived: nextArchived !== undefined ? nextArchived : project.is_archived,
  };

  // 文本字段变更时，乐观清零合规状态，等待下一次异步检测结果。
  if (textTouched) {
    updatePayload.review_status = 'ok';
    updatePayload.review_reason = null;
    updatePayload.review_checked_at = null;
  }

  const updated = await project.update(updatePayload);

  if (textTouched) {
    queueProjectAudit({ project: updated, userId, action: 'update' });
  }
  return updated;
}

export async function deleteProject(projectId, userId) {
  const project = await getProjectOrThrow(projectId, userId);
  const pid = Number(project.project_id);
  await sequelize.transaction(async (t) => {
    await Permission.destroy({
      where: {
        target_type: 'project',
        target_id: pid,
      },
      transaction: t,
    });
    await project.destroy({ transaction: t });
  });
}

export async function setProjectPinned(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { is_pinned } = payload || {};
  const nextPinned = Number(is_pinned);

  if (![0, 1].includes(nextPinned)) {
    const err = new Error('置顶状态参数无效');
    err.status = 400;
    throw err;
  }

  return project.update({
    is_pinned: nextPinned,
    pinned_at: nextPinned === 1 ? new Date() : null,
  });
}
