import { createProject, listProjects, updateProject, deleteProject, getProjectById } from '../services/projectService.js';

export async function getProjects(req, res, next) {
  try {
    const data = await listProjects(req.user.user_id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getProjectDetail(req, res, next) {
  try {
    const { id } = req.params;
    const project = await getProjectById(id, req.user.user_id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
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

export async function editProject(req, res, next) {
  try {
    const { id } = req.params;
    const project = await updateProject(id, req.user.user_id, req.body);
    res.json(project);
  } catch (error) {
    next(error);
  }
}

export async function removeProject(req, res, next) {
  try {
    const { id } = req.params;
    await deleteProject(id, req.user.user_id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
