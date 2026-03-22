import { createProject, listProjects } from '../services/projectService.js';

export async function getProjects(req, res, next) {
  try {
    const data = await listProjects(req.user.user_id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function addProject(req, res, next) {
  try {
    const project = await createProject(req.user.user_id, req.body);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}
