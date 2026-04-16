import { Project, ProjectShare } from '../models/index.js';
import { randomUUID } from 'crypto';

const DEFAULT_SHARE_EXPIRES_HOURS = 7 * 24;
const MAX_SHARE_EXPIRES_HOURS = 90 * 24;

function toSharePayload(row) {
  const raw = typeof row?.toJSON === 'function' ? row.toJSON() : row;
  return {
    share_id: raw.share_id,
    project_id: Number(raw.project_id),
    creator_user_id: Number(raw.creator_user_id),
    view_count: Number(raw.view_count),
    is_revoked: Number(raw.is_revoked),
    revoked_at: raw.revoked_at,
    expires_at: raw.expires_at,
    created_at: raw.created_at,
  };
}

async function ensureProjectOwner(projectId, userId) {
  const pid = Number(projectId);
  const uid = Number(userId);
  const project = await Project.findOne({
    where: {
      project_id: pid,
      user_id: uid,
      is_deleted: 0,
    },
  });

  if (!project) {
    const err = new Error('未找到该旅行项目');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function createProjectShare(projectId, creatorUserId, payload = {}) {
  const pid = Number(projectId);
  const creatorId = Number(creatorUserId);

  if (!Number.isFinite(pid) || pid <= 0) {
    const err = new Error('项目ID无效');
    err.status = 400;
    throw err;
  }

  await ensureProjectOwner(pid, creatorId);

  const expiresInHours = Number(payload.expires_in_hours ?? DEFAULT_SHARE_EXPIRES_HOURS);
  if (!Number.isInteger(expiresInHours) || expiresInHours <= 0 || expiresInHours > MAX_SHARE_EXPIRES_HOURS) {
    const err = new Error(`expires_in_hours 必须是 1-${MAX_SHARE_EXPIRES_HOURS} 的整数`);
    err.status = 400;
    throw err;
  }

  const share = await ProjectShare.create({
    share_id: randomUUID(),
    project_id: pid,
    creator_user_id: creatorId,
    view_count: 0,
    is_revoked: 0,
    revoked_at: null,
    expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
  });

  return toSharePayload(share);
}

export async function listProjectShares(projectId, userId) {
  const pid = Number(projectId);
  const uid = Number(userId);
  await ensureProjectOwner(pid, uid);

  const rows = await ProjectShare.findAll({
    where: {
      project_id: pid,
      creator_user_id: uid,
    },
    order: [['created_at', 'DESC']],
    limit: 100,
  });

  return rows.map((row) => toSharePayload(row));
}

export async function revokeProjectShare(projectId, shareId, userId) {
  const pid = Number(projectId);
  const uid = Number(userId);
  await ensureProjectOwner(pid, uid);

  const share = await ProjectShare.findOne({
    where: {
      share_id: String(shareId || ''),
      project_id: pid,
      creator_user_id: uid,
    },
  });

  if (!share) {
    const err = new Error('分享记录不存在');
    err.status = 404;
    throw err;
  }

  if (Number(share.is_revoked) !== 1) {
    await share.update({
      is_revoked: 1,
      revoked_at: new Date(),
    });
  }

  return toSharePayload(share);
}

export async function getActiveProjectShare(projectId, shareId) {
  const pid = Number(projectId);
  const sid = String(shareId || '').trim();

  if (!sid) {
    const err = new Error('分享标识不能为空');
    err.status = 400;
    throw err;
  }

  const share = await ProjectShare.findOne({
    where: {
      share_id: sid,
      project_id: pid,
    },
  });

  if (!share) {
    const err = new Error('分享不存在');
    err.status = 404;
    throw err;
  }

  if (Number(share.is_revoked) === 1) {
    const err = new Error('分享已被撤销');
    err.status = 410;
    throw err;
  }

  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    const err = new Error('分享已过期');
    err.status = 410;
    throw err;
  }

  return share;
}

export async function visitProjectShare(projectId, shareId) {
  const share = await getActiveProjectShare(projectId, shareId);
  await share.update({
    view_count: Number(share.view_count) + 1,
  });

  return toSharePayload(share);
}