import { Project } from '../models/index.js';

export async function listProjects(userId) {
  return Project.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']] });
}

export async function createProject(userId, payload) {
  const { title, cover_image, start_date, end_date, tags } = payload;
  if (!title || !start_date) {
    const err = new Error('title and start_date are required');
    err.status = 400;
    throw err;
  }
  return Project.create({
    user_id: userId,
    title,
    cover_image,
    start_date,
    end_date,
    tags,
  });
}

export async function getProjectOrThrow(projectId, userId) {
  const project = await Project.findOne({ where: { project_id: projectId, user_id: userId } });
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  return project;
}
