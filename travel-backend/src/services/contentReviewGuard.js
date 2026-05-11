import { Content, Project } from '../models/index.js';

/** 合规命中错误码：控制器与前端可凭此分辨是合规拦截还是普通 403。 */
export const REVIEW_BLOCK_CODE = 'CONTENT_REVIEW_BLOCKED';

/** 异步审核尚未完成，禁止分享/导出等传播操作。 */
export const REVIEW_PENDING_CODE = 'CONTENT_REVIEW_PENDING';

/**
 * 断言项目及其全部内容均未命中合规检测。
 * 命中任意一条即抛 403 + status_code=CONTENT_REVIEW_BLOCKED；
 * 仍存在 pending（审核中）即抛 403 + CONTENT_REVIEW_PENDING。
 *
 * @param {number|string} projectId
 * @param {object} [opts]
 * @param {string} [opts.action] 触发场景，仅用于错误文案拼装
 */
export async function assertProjectContentReviewable(projectId, opts = {}) {
  const pid = Number(projectId);
  if (!Number.isFinite(pid) || pid <= 0) return;

  const project = await Project.findOne({
    where: { project_id: pid },
    attributes: ['project_id', 'review_status', 'review_reason'],
  });

  const action = opts.action || '操作';

  if (project && project.review_status === 'pending') {
    const err = new Error(`内容安全审核尚未完成，无法${action}，请稍后再试`);
    err.status = 403;
    err.code = REVIEW_PENDING_CODE;
    err.details = {
      scope: 'project',
      project_id: pid,
    };
    throw err;
  }

  if (project && project.review_status === 'flagged') {
    const err = new Error(`该项目存在合规风险内容，无法${action}，请先修改项目信息`);
    err.status = 403;
    err.code = REVIEW_BLOCK_CODE;
    err.details = {
      scope: 'project',
      project_id: pid,
      reason: project.review_reason || null,
    };
    throw err;
  }

  const pendingContent = await Content.findOne({
    where: { project_id: pid, review_status: 'pending' },
    attributes: ['content_id'],
  });

  if (pendingContent) {
    const err = new Error(`内容安全审核尚未完成，无法${action}，请稍后再试`);
    err.status = 403;
    err.code = REVIEW_PENDING_CODE;
    err.details = {
      scope: 'content',
      project_id: pid,
      content_id: Number(pendingContent.content_id),
    };
    throw err;
  }

  const flaggedContent = await Content.findOne({
    where: { project_id: pid, review_status: 'flagged' },
    attributes: ['content_id', 'review_reason'],
  });

  if (flaggedContent) {
    const err = new Error(`该项目存在合规风险内容，无法${action}，请先修改对应日记后再试`);
    err.status = 403;
    err.code = REVIEW_BLOCK_CODE;
    err.details = {
      scope: 'content',
      project_id: pid,
      content_id: Number(flaggedContent.content_id),
      reason: flaggedContent.review_reason || null,
    };
    throw err;
  }
}
