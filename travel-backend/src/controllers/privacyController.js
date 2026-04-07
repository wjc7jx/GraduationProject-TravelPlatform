import {
  getProjectPrivacy,
  setProjectPrivacy,
  getContentPrivacy,
  setContentPrivacy,
  clearContentPrivacy,
} from '../services/privacyService.js';
import { sendSuccess } from '../utils/response.js';

export async function getProjectPrivacyRule(req, res, next) {
  try {
    const { id } = req.params;
    const data = await getProjectPrivacy(id, req.user.user_id);
    sendSuccess(res, data, '获取项目隐私规则成功');
  } catch (error) {
    next(error);
  }
}

export async function updateProjectPrivacyRule(req, res, next) {
  try {
    const { id } = req.params;
    const data = await setProjectPrivacy(id, req.user.user_id, req.body);
    sendSuccess(res, data, '更新项目隐私规则成功');
  } catch (error) {
    next(error);
  }
}

export async function getContentPrivacyRule(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    const data = await getContentPrivacy(projectId, contentId, req.user.user_id);
    sendSuccess(res, data, '获取内容隐私规则成功');
  } catch (error) {
    next(error);
  }
}

export async function updateContentPrivacyRule(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    const data = await setContentPrivacy(projectId, contentId, req.user.user_id, req.body);
    sendSuccess(res, data, '更新内容隐私规则成功');
  } catch (error) {
    next(error);
  }
}

export async function clearContentPrivacyRule(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    const data = await clearContentPrivacy(projectId, contentId, req.user.user_id);
    sendSuccess(res, data, '已恢复内容继承项目隐私策略');
  } catch (error) {
    next(error);
  }
}
