import { listContents, createContent, updateContent, deleteContent } from '../services/contentService.js';
import { sendSuccess } from '../utils/response.js';

export async function getContents(req, res, next) {
  try {
    const { projectId } = req.params;
    const shareId = String(req.query?.share_id || '').trim() || null;
    const data = await listContents(projectId, req.user.user_id, { shareId });
    sendSuccess(res, data, '获取内容列表成功');
  } catch (error) {
    next(error);
  }
}

export async function addContent(req, res, next) {
  try {
    const { projectId } = req.params;
    const content = await createContent(projectId, req.user.user_id, req.body);
    sendSuccess(res, content, '创建内容成功', 201);
  } catch (error) {
    next(error);
  }
}

export async function editContent(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    const content = await updateContent(projectId, contentId, req.user.user_id, req.body);
    sendSuccess(res, content, '更新内容成功');
  } catch (error) {
    next(error);
  }
}

export async function removeContent(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    await deleteContent(projectId, contentId, req.user.user_id);
    sendSuccess(res, null, '删除内容成功');
  } catch (error) {
    next(error);
  }
}
