import { listContents, createContent } from '../services/contentService.js';

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
