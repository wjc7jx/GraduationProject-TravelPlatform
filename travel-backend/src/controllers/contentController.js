import { listContents, createContent, updateContent, deleteContent } from '../services/contentService.js';

export async function getContents(req, res, next) {
  try {
    const { projectId } = req.params;
    const data = await listContents(projectId, req.user.user_id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function addContent(req, res, next) {
  try {
    const { projectId } = req.params;
    const content = await createContent(projectId, req.user.user_id, req.body);
    res.status(201).json(content);
  } catch (error) {
    next(error);
  }
}

export async function editContent(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    const content = await updateContent(projectId, contentId, req.user.user_id, req.body);
    res.json(content);
  } catch (error) {
    next(error);
  }
}

export async function removeContent(req, res, next) {
  try {
    const { projectId, contentId } = req.params;
    await deleteContent(projectId, contentId, req.user.user_id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
