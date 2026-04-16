import {
  getProjectPrivacy,
  setProjectPrivacy,
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
