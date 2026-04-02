import { Content } from '../models/index.js';
import { getProjectOrThrow } from './projectService.js';

export async function listContents(projectId, userId) {
  await getProjectOrThrow(projectId, userId);
  return Content.findAll({
    where: { project_id: projectId },
    order: [
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
    ],
  });
}

export async function createContent(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { content_type, content_data, record_time, location_id, sort_order } = payload;
  if (!content_type || !content_data || !record_time) {
    const err = new Error('内容类型、内容数据和记录时间是必填选项');
    err.status = 400;
    throw err;
  }
  return Content.create({
    project_id: project.project_id,
    content_type,
    content_data,
    record_time,
    location_id,
    sort_order: sort_order || 0,
  });
}
