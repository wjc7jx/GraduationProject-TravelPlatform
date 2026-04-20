import { Content, Location, Permission, Project, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import {
  canView,
  getProjectRule,
  getProjectRules,
  getViewerLevel,
  sanitizeLocation,
} from './privacyService.js';
import { getActiveProjectShare } from './projectShareService.js';

export async function listProjects(userId, filters = {}) {
  const where = {
    user_id: userId,
  };

  const keyword = (filters.keyword || '').trim();
  const tag = (filters.tag || '').trim();
  const startDate = (filters.startDate || '').trim();
  const endDate = (filters.endDate || '').trim();

  const andConditions = [];

  if (keyword) {
    andConditions.push({
      [Op.or]: [
        { title: { [Op.like]: `%${keyword}%` } },
        { subtitle: { [Op.like]: `%${keyword}%` } },
      ],
    });
  }

  if (tag) {
    andConditions.push({
      tags: { [Op.like]: `%${tag}%` },
    });
  }

  if (startDate) {
    andConditions.push({
      start_date: { [Op.gte]: startDate },
    });
  }

  if (endDate) {
    andConditions.push({
      [Op.or]: [
        { end_date: { [Op.lte]: endDate } },
        {
          [Op.and]: [
            { end_date: null },
            { start_date: { [Op.lte]: endDate } },
          ],
        },
      ],
    });
  }

  if (andConditions.length > 0) {
    where[Op.and] = andConditions;
  }

  return Project.findAll({
    where,
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM contents AS content
            WHERE
              content.project_id = Project.project_id
              AND content.location_id IS NOT NULL
          )`),
          'locationCount'
        ]
      ]
    },
    order: [['is_pinned', 'DESC'], ['pinned_at', 'DESC'], ['created_at', 'DESC']]
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

export async function getProjectById(projectId, userId, options = {}) {
  const pid = Number(projectId);
  const uid = Number(userId);
  const shareId = String(options.shareId || '').trim();

  const project = await Project.findOne({
    where: {
      project_id: pid,
    },
  });
  if (!project) {
    const err = new Error('未找到该旅行项目');
    err.status = 404;
    throw err;
  }

  if (Number(project.user_id) === uid) {
    return project;
  }

  if (!shareId) {
    const err = new Error('无权查看该项目');
    err.status = 403;
    throw err;
  }

  await getActiveProjectShare(pid, shareId);
  const rule = await getProjectRule(pid);
  const viewable = await canView(rule, project.user_id, uid);
  if (!viewable) {
    const err = new Error('无权查看该项目');
    err.status = 403;
    throw err;
  }

  return project;
}

export async function getProjectOrThrow(projectId, userId) {
  // TODO: findOne返回的数据是什么？
  const project = await Project.findOne({ 
    where: { 
      project_id: projectId, 
      user_id: userId,
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
  const pid = Number(project.project_id);
  await sequelize.transaction(async (t) => {
    await Permission.destroy({
      where: {
        target_type: 'project',
        target_id: pid,
      },
      transaction: t,
    });
    await project.destroy({ transaction: t });
  });
}

export async function setProjectPinned(projectId, userId, payload) {
  const project = await getProjectOrThrow(projectId, userId);
  const { is_pinned } = payload || {};
  const nextPinned = Number(is_pinned);

  if (![0, 1].includes(nextPinned)) {
    const err = new Error('置顶状态参数无效');
    err.status = 400;
    throw err;
  }

  return project.update({
    is_pinned: nextPinned,
    pinned_at: nextPinned === 1 ? new Date() : null,
  });
}

export async function getTimelineMapOverview(userId) {
  const projects = await Project.findAll({
    where: {
      user_id: userId,
    },
    order: [['start_date', 'DESC'], ['created_at', 'DESC']],
  });

  const contents = await Content.findAll({
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['project_id', 'title', 'start_date', 'end_date', 'cover_image'],
        where: {
          user_id: userId,
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
  const visibleContents = [];
  for (const item of contents) {
    const rule = projectRulesMap.get(Number(item.project_id));
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
