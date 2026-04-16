import {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  getProjectById,
  setProjectPinned,
  getTimelineMapOverview,
} from '../services/projectService.js';
import {
  createProjectShare,
  listProjectShares,
  revokeProjectShare,
  visitProjectShare,
  generateProjectShareQrcode,
} from '../services/projectShareService.js';
import { sendSuccess } from '../utils/response.js';

export async function getProjects(req, res, next) {
  try {
    const { startDate, endDate, keyword, tag } = req.query;
    const data = await listProjects(req.user.user_id, { startDate, endDate, keyword, tag });
    sendSuccess(res, data, '获取项目列表成功');
  } catch (error) {
    next(error);
  }
}

export async function getTimelineMapData(req, res, next) {
  try {
    const data = await getTimelineMapOverview(req.user.user_id);
    sendSuccess(res, data, '获取时间地图总览成功');
  } catch (error) {
    next(error);
  }
}

export async function getProjectDetail(req, res, next) {
  try {
    const { id } = req.params;
    const shareId = String(req.query?.share_id || '').trim() || null;
    const project = await getProjectById(id, req.user.user_id, { shareId });
    sendSuccess(res, project, '获取项目详情成功');
  } catch (error) {
    next(error);
  }
}

export async function addProject(req, res, next) {
  try {
    const project = await createProject(req.user.user_id, req.body);
    sendSuccess(res, project, '创建项目成功', 201);
  } catch (error) {
    next(error);
  }
}

export async function editProject(req, res, next) {
  try {
    const { id } = req.params;
    const project = await updateProject(id, req.user.user_id, req.body);
    sendSuccess(res, project, '更新项目成功');
  } catch (error) {
    next(error);
  }
}

export async function removeProject(req, res, next) {
  try {
    const { id } = req.params;
    await deleteProject(id, req.user.user_id);
    sendSuccess(res, null, '删除项目成功');
  } catch (error) {
    next(error);
  }
}

export async function pinProject(req, res, next) {
  try {
    const { id } = req.params;
    const project = await setProjectPinned(id, req.user.user_id, req.body);
    sendSuccess(res, project, Number(project.is_pinned) === 1 ? '项目置顶成功' : '已取消置顶');
  } catch (error) {
    next(error);
  }
}

export async function createShare(req, res, next) {
  try {
    const { id } = req.params;
    const data = await createProjectShare(id, req.user.user_id, req.body || {});
    sendSuccess(res, data, '创建分享成功', 201);
  } catch (error) {
    next(error);
  }
}

export async function getShares(req, res, next) {
  try {
    const { id } = req.params;
    const data = await listProjectShares(id, req.user.user_id);
    sendSuccess(res, data, '获取分享记录成功');
  } catch (error) {
    next(error);
  }
}

export async function revokeShare(req, res, next) {
  try {
    const { id, shareId } = req.params;
    const data = await revokeProjectShare(id, shareId, req.user.user_id);
    sendSuccess(res, data, '撤销分享成功');
  } catch (error) {
    next(error);
  }
}

export async function markShareVisited(req, res, next) {
  try {
    const { id, shareId } = req.params;
    const data = await visitProjectShare(id, shareId);
    sendSuccess(res, data, '分享访问已记录');
  } catch (error) {
    next(error);
  }
}

export async function getShareQrcode(req, res, next) {
  try {
    const { id, shareId } = req.params;
    const pngBuffer = await generateProjectShareQrcode(id, shareId, req.user.user_id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(pngBuffer);
  } catch (error) {
    next(error);
  }
}
