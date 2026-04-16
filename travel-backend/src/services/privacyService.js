import { Op } from 'sequelize';
import { Permission, Project } from '../models/index.js';
import { areFriends } from './friendService.js';

const VISIBILITY_PRIVATE = 1;
const VISIBILITY_FRIENDS = 2;
const VISIBILITY_PUBLIC = 3;

function createDefaultRule() {
  return {
    visibility: VISIBILITY_PRIVATE,
    white_list: [],
  };
}

function normalizeVisibility(visibility) {
  const value = Number(visibility);
  if ([VISIBILITY_PRIVATE, VISIBILITY_FRIENDS, VISIBILITY_PUBLIC].includes(value)) {
    return value;
  }
  return VISIBILITY_PRIVATE;
}

function normalizeWhiteList(whiteList) {
  if (!Array.isArray(whiteList)) return [];
  return Array.from(new Set(
    whiteList
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
  ));
}

function normalizeRule(rule) {
  if (!rule) return createDefaultRule();
  const visibility = normalizeVisibility(rule.visibility);
  const whiteList = visibility === VISIBILITY_FRIENDS ? normalizeWhiteList(rule.white_list) : [];
  return {
    visibility,
    white_list: whiteList,
  };
}

function toPlainObject(item) {
  if (!item) return null;
  return typeof item.toJSON === 'function' ? item.toJSON() : item;
}

function roundCoordinate(value, precision) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(precision));
}

function isOwner(ownerUserId, viewerUserId) {
  return Number(ownerUserId) === Number(viewerUserId);
}

function inWhiteList(rule, viewerUserId) {
  const viewer = Number(viewerUserId);
  if (!Number.isFinite(viewer)) return false;
  return normalizeWhiteList(rule?.white_list).includes(viewer);
}

function maskAddress(address) {
  if (!address || typeof address !== 'string') return '';
  const tokens = address.split(/[\s,，]/).filter(Boolean);
  if (!tokens.length) return '';
  return tokens[0];
}

async function ensureProjectOwner(projectId, userId) {
  const project = await Project.findOne({
    where: {
      project_id: projectId,
      user_id: userId,
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

async function upsertRule(targetType, targetId, rule) {
  const payload = normalizeRule(rule);
  const [permission, created] = await Permission.findOrCreate({
    where: {
      target_type: targetType,
      target_id: targetId,
    },
    defaults: payload,
  });

  if (!created) {
    await permission.update(payload);
  }

  return normalizeRule(permission.toJSON());
}

export async function getProjectRule(projectId) {
  const permission = await Permission.findOne({
    where: {
      target_type: 'project',
      target_id: projectId,
    },
  });
  return normalizeRule(permission ? permission.toJSON() : null);
}

export async function getProjectRules(projectIds) {
  const ids = Array.from(new Set((projectIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))));
  const ruleMap = new Map();

  if (!ids.length) return ruleMap;

  const rows = await Permission.findAll({
    where: {
      target_type: 'project',
      target_id: {
        [Op.in]: ids,
      },
    },
  });

  ids.forEach((id) => {
    ruleMap.set(id, createDefaultRule());
  });

  rows.forEach((row) => {
    ruleMap.set(Number(row.target_id), normalizeRule(row.toJSON()));
  });

  return ruleMap;
}

export async function canView(rule, ownerUserId, viewerUserId) {
  if (isOwner(ownerUserId, viewerUserId)) return true;

  const normalizedRule = normalizeRule(rule);
  if (normalizedRule.visibility === VISIBILITY_PUBLIC) {
    return Number.isFinite(Number(viewerUserId));
  }
  if (normalizedRule.visibility === VISIBILITY_FRIENDS) {
    if (inWhiteList(normalizedRule, viewerUserId)) return true;
    return areFriends(ownerUserId, viewerUserId);
  }

  return false;
}

export async function getViewerLevel(rule, ownerUserId, viewerUserId) {
  if (isOwner(ownerUserId, viewerUserId)) return 'owner';

  const normalizedRule = normalizeRule(rule);
  if (normalizedRule.visibility === VISIBILITY_PUBLIC) return 'public';
  if (normalizedRule.visibility === VISIBILITY_FRIENDS) {
    if (inWhiteList(normalizedRule, viewerUserId)) return 'friend';
    if (await areFriends(ownerUserId, viewerUserId)) return 'friend';
  }
  return 'private_hidden';
}

export function sanitizeLocation(item, viewerLevel) {
  const plain = toPlainObject(item);
  if (!plain || typeof plain !== 'object') return plain;

  const result = { ...plain };
  const location = result.location && typeof result.location === 'object'
    ? { ...result.location }
    : null;

  let precision = null;
  if (viewerLevel === 'owner') precision = 6;
  if (viewerLevel === 'friend') precision = 4;
  if (viewerLevel === 'public') precision = 3;

  const hideCoordinates = viewerLevel === 'private_hidden';

  if (location) {
    if (hideCoordinates) {
      location.latitude = null;
      location.longitude = null;
      location.address = maskAddress(location.address);
    } else if (precision !== null) {
      location.latitude = roundCoordinate(location.latitude, precision);
      location.longitude = roundCoordinate(location.longitude, precision);
    }
    result.location = location;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'latitude')) {
    result.latitude = hideCoordinates
      ? null
      : roundCoordinate(result.latitude, precision ?? 3);
  }
  if (Object.prototype.hasOwnProperty.call(result, 'longitude')) {
    result.longitude = hideCoordinates
      ? null
      : roundCoordinate(result.longitude, precision ?? 3);
  }
  if (hideCoordinates && Object.prototype.hasOwnProperty.call(result, 'location_name') && !result.location_name && location?.name) {
    result.location_name = location.name;
  }

  return result;
}

export async function filterViewableContents(contents, viewerUserId, options = {}) {
  const items = Array.isArray(contents) ? contents : [];
  if (!items.length) return [];

  const { projectId, ownerUserId } = options;
  const projectRule = options.projectRule || await getProjectRule(projectId);
  const normalizedProjectRule = normalizeRule(projectRule);
  if (!(await canView(normalizedProjectRule, ownerUserId, viewerUserId))) return [];

  const viewerLevel = await getViewerLevel(normalizedProjectRule, ownerUserId, viewerUserId);

  const result = [];
  for (const item of items) {
    result.push(sanitizeLocation(item, viewerLevel));
  }

  return result;
}

export async function shouldKeepByExportScope(rule, options = {}) {
  const scope = String(options.visibilityScope || 'all');
  const requesterUserId = Number(options.requesterUserId);
  const ownerUserId = Number(options.ownerUserId);
  const viewerUserId = options.viewerUserId;
  const normalizedRule = normalizeRule(rule);

  if (scope === 'all') {
    return requesterUserId === ownerUserId;
  }

  if (scope === 'public') {
    return normalizedRule.visibility === VISIBILITY_PUBLIC;
  }

  if (scope === 'share') {
    return canView(normalizedRule, ownerUserId, viewerUserId);
  }

  return false;
}

export function normalizePrivacyPayload(payload = {}) {
  const visibility = Number(payload.visibility);
  if (![VISIBILITY_PRIVATE, VISIBILITY_FRIENDS, VISIBILITY_PUBLIC].includes(visibility)) {
    const err = new Error('visibility 必须为 1(私密)、2(好友可见)、3(公开)');
    err.status = 400;
    throw err;
  }

  const whiteList = normalizeWhiteList(payload.white_list);

  return {
    visibility,
    white_list: visibility === VISIBILITY_FRIENDS ? whiteList : [],
  };
}

export async function getProjectPrivacy(projectId, userId) {
  await ensureProjectOwner(projectId, userId);
  const rule = await getProjectRule(projectId);
  return {
    target_type: 'project',
    target_id: Number(projectId),
    ...rule,
  };
}

export async function setProjectPrivacy(projectId, userId, payload) {
  await ensureProjectOwner(projectId, userId);
  const rule = normalizePrivacyPayload(payload);
  const saved = await upsertRule('project', Number(projectId), rule);
  return {
    target_type: 'project',
    target_id: Number(projectId),
    ...saved,
  };
}
