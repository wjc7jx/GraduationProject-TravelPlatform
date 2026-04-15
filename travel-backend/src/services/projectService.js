import { Content, Location, Project } from '../models/index.js';
import {
  canView,
  getContentRules,
  getProjectRules,
  getViewerLevel,
  resolveContentRule,
  sanitizeLocation,
} from './privacyService.js';

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
  const { title, subtitle, cover_image, start_date, end_date, tags } = payload;
  if (!title || !start_date) {
    const err = new Error('旅行名称和开始时间是必填项');
    err.status = 400;
    throw err;
  }
  return Project.create({
    user_id: userId,
    title,
    subtitle,
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
  const { title, subtitle, cover_image, start_date, end_date, tags, is_archived } = payload;
  const nextArchived = is_archived !== undefined ? Number(is_archived) : undefined;
  const hasEditableFieldChanges = [title, subtitle, cover_image, start_date, end_date, tags]
    .some((value) => value !== undefined);

  if (nextArchived !== undefined && ![0, 1].includes(nextArchived)) {
    const err = new Error('归档状态参数无效');
    err.status = 400;
    throw err;
  }

  if (Number(project.is_archived) === 1 && hasEditableFieldChanges) {
    const err = new Error('项目已归档，不能修改项目信息，请先取消归档');
    err.status = 403;
    throw err;
  }
  
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
    subtitle: subtitle !== undefined ? subtitle : project.subtitle,
    cover_image: cover_image !== undefined ? cover_image : project.cover_image,
    start_date: start_date !== undefined ? start_date : project.start_date,
    end_date: end_date !== undefined ? end_date : project.end_date,
    tags: tags !== undefined ? tags : project.tags,
    is_archived: nextArchived !== undefined ? nextArchived : project.is_archived,
  });
}

export async function deleteProject(projectId, userId) {
  const project = await getProjectOrThrow(projectId, userId);
  return project.update({ 
    is_deleted: 1,
    deleted_at: new Date()
  });
}

export async function getTimelineMapOverview(userId) {
  const projects = await Project.findAll({
    where: {
      user_id: userId,
      is_deleted: 0,
    },
    order: [['start_date', 'DESC'], ['created_at', 'DESC']],
  });

  const contents = await Content.findAll({
    where: {
      is_deleted: 0,
    },
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['project_id', 'title', 'start_date', 'end_date', 'cover_image'],
        where: {
          user_id: userId,
          is_deleted: 0,
        },
        required: true,
      },
      {
        model: Location,
        as: 'location',
        attributes: ['location_id', 'longitude', 'latitude', 'name', 'address'],
        required: false,
      },
    ],
    order: [
      [{ model: Project, as: 'project' }, 'start_date', 'DESC'],
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
    ],
  });

  const projectRulesMap = await getProjectRules(projects.map((project) => project.project_id));
  const contentRulesMap = await getContentRules(contents.map((item) => item.content_id));
  const visibleContents = [];
  for (const item of contents) {
    const rule = resolveContentRule(item, {
      projectRule: projectRulesMap.get(Number(item.project_id)),
      contentRulesMap,
    });
    const ownerUserId = item.project?.user_id || userId;

    if (!(await canView(rule, ownerUserId, userId))) continue;
    const viewerLevel = await getViewerLevel(rule, ownerUserId, userId);
    visibleContents.push(sanitizeLocation(item, viewerLevel));
  }

  const projectStats = new Map();
  projects.forEach((project) => {
    projectStats.set(String(project.project_id), {
      content_count: 0,
      point_count: 0,
      first_record_time: null,
      last_record_time: null,
    });
  });

  const points = visibleContents
    .filter((item) => item.location)
    .map((item) => {
      const location = item.location;
      const projectId = String(item.project_id);
      const stats = projectStats.get(projectId);
      const recordTime = item.record_time || item.created_at;

      if (stats) {
        stats.content_count += 1;
        stats.point_count += 1;
        if (!stats.first_record_time || new Date(recordTime).getTime() < new Date(stats.first_record_time).getTime()) {
          stats.first_record_time = recordTime;
        }
        if (!stats.last_record_time || new Date(recordTime).getTime() > new Date(stats.last_record_time).getTime()) {
          stats.last_record_time = recordTime;
        }
      }

      return {
        content_id: item.content_id,
        project_id: item.project_id,
        record_time: recordTime,
        content_type: item.content_type,
        content_data: item.content_data,
        longitude: Number(location.longitude),
        latitude: Number(location.latitude),
        location_name: location.name || '',
      };
    });

  visibleContents
    .filter((item) => !item.location)
    .forEach((item) => {
      const stats = projectStats.get(String(item.project_id));
      const recordTime = item.record_time || item.created_at;
      if (stats) {
        stats.content_count += 1;
        if (!stats.first_record_time || new Date(recordTime).getTime() < new Date(stats.first_record_time).getTime()) {
          stats.first_record_time = recordTime;
        }
        if (!stats.last_record_time || new Date(recordTime).getTime() > new Date(stats.last_record_time).getTime()) {
          stats.last_record_time = recordTime;
        }
      }
    });

  return {
    projects: projects.map((project) => {
      const stats = projectStats.get(String(project.project_id));
      return {
        ...project.toJSON(),
        year: Number(String(project.start_date || project.created_at).slice(0, 4)),
        content_count: stats?.content_count || 0,
        point_count: stats?.point_count || 0,
        first_record_time: stats?.first_record_time || null,
        last_record_time: stats?.last_record_time || null,
      };
    }),
    points,
  };
}
