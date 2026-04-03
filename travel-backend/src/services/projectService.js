import { Project } from '../models/index.js';

export async function listProjects(userId) {
  return Project.findAll({ 
    where: { 
      user_id: userId,
      is_deleted: 0 
    }, 
    order: [['created_at', 'DESC']] 
  });
}

export async function createProject(userId, payload) {
  const { title, cover_image, start_date, end_date, tags } = payload;
  if (!title || !start_date) {
    const err = new Error('旅行名称和开始时间是必填项');
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

export async function getProjectById(projectId, userId) {
  return await getProjectOrThrow(projectId, userId);
}

export async function getProjectOrThrow(projectId, userId) {
  const project = await Project.findOne({ 
    where: { 
      project_id: projectId, 
      user_id: userId,
      is_deleted: 0
    } 
  });
  if (!project) {
    const err = new Error('未找到该旅行项目');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function updateProject(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { title, cover_image, start_date, end_date, tags, is_archived } = payload;
  
  if (title !== undefined && !title) {
    const err = new Error('旅行名称不能为空');
    err.status = 400;
    throw err;
  }
  if (start_date !== undefined && !start_date) {
    const err = new Error('开始时间不能为空');
    err.status = 400;
    throw err;
  }

  return project.update({
    title: title !== undefined ? title : project.title,
    cover_image: cover_image !== undefined ? cover_image : project.cover_image,
    start_date: start_date !== undefined ? start_date : project.start_date,
    end_date: end_date !== undefined ? end_date : project.end_date,
    tags: tags !== undefined ? tags : project.tags,
    is_archived: is_archived !== undefined ? is_archived : project.is_archived,
  });
}

export async function deleteProject(projectId, userId) {
  const project = await getProjectOrThrow(projectId, userId);
  return project.update({ 
    is_deleted: 1,
    deleted_at: new Date()
  });
}
