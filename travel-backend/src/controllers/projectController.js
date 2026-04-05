import {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  getProjectById,
  getTimelineMapOverview,
} from '../services/projectService.js';
import { sendSuccess } from '../utils/response.js';

export async function getProjects(req, res, next) {
  try {
    const data = await listProjects(req.user.user_id);
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
    const project = await getProjectById(id, req.user.user_id);
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
