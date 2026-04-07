import { Content, Location } from '../models/index.js';
import { getProjectOrThrow } from './projectService.js';
import { filterViewableContents } from './privacyService.js';

export async function listContents(projectId, userId) {
  const project = await getProjectOrThrow(projectId, userId);
  const contents = await Content.findAll({
    where: { 
      project_id: projectId,
      is_deleted: 0
    },
    include: [{
      model: Location,
      as: 'location',
      required: false,
    }],
    order: [
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
    ],
  });

  return filterViewableContents(contents, userId, {
    projectId: project.project_id,
    ownerUserId: project.user_id,
  });
}

export async function createContent(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { content_type, content_data, record_time, sort_order, location } = payload;
  let { location_id } = payload;

  if (!content_type || !content_data || !record_time) {
    const err = new Error('内容类型、内容数据和记录时间是必填选项');
    err.status = 400;
    throw err;
  }

  // 如果传递了 location 对象且包含经纬度，则自动在后台创建 Location
  if (location && location.latitude && location.longitude && !location_id) {
    const newLoc = await Location.create({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name || null,
      address: location.address || null
    });
    location_id = newLoc.location_id;
  }

  return Content.create({
    project_id: project.project_id,
    content_type,
    content_data,
    record_time,
    location_id: location_id || null,
    sort_order: sort_order || 0,
  });
}

export async function getContentOrThrow(projectId, contentId, userId) {
  await getProjectOrThrow(projectId, userId);
  const content = await Content.findOne({
    where: {
      content_id: contentId,
      project_id: projectId,
      is_deleted: 0
    }
  });
  if (!content) {
    const err = new Error('未找到该内容');
    err.status = 404;
    throw err;
  }
  return content;
}

export async function updateContent(projectId, contentId, userId, payload) {
  const content = await getContentOrThrow(projectId, contentId, userId);
  const { content_type, content_data, record_time, location_id, sort_order } = payload;
  
  return content.update({
    content_type: content_type !== undefined ? content_type : content.content_type,
    content_data: content_data !== undefined ? content_data : content.content_data,
    record_time: record_time !== undefined ? record_time : content.record_time,
    location_id: location_id !== undefined ? location_id : content.location_id,
    sort_order: sort_order !== undefined ? sort_order : content.sort_order,
  });
}

export async function deleteContent(projectId, contentId, userId) {
  const content = await getContentOrThrow(projectId, contentId, userId);
  return content.update({
    is_deleted: 1,
    deleted_at: new Date()
  });
}
