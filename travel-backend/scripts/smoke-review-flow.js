/**
 * 端到端验证合规审核标记流程（不触及真实微信 msgSecCheck）：
 * 1. 造 user / project / content（含文本的内容为 pending；项目先手动置 ok 以便单独测内容拦截）。
 * 2. 手工 UPDATE content.review_status=flagged 模拟命中。
 * 3. assertProjectContentReviewable 应抛 403 CONTENT_REVIEW_BLOCKED。
 * 4. generateProjectHtmlExport 应被拦截。
 * 5. createProjectShare 应被拦截。
 * 6. updateContent 后 review_status 应为 pending（异步审核未完成）。
 * 7. assertProjectContentReviewable 应抛 CONTENT_REVIEW_PENDING。
 * 8. 手工将 content 置 ok 模拟异步通过后应放行。
 * 9. 清理测试数据。
 */
import '../src/models/index.js';
import { sequelize, User, Project, Content } from '../src/models/index.js';
import { createContent, updateContent } from '../src/services/contentService.js';
import { generateProjectHtmlExport } from '../src/services/exportService.js';
import { createProjectShare } from '../src/services/projectShareService.js';
import {
  assertProjectContentReviewable,
  REVIEW_PENDING_CODE,
} from '../src/services/contentReviewGuard.js';
import { setProjectPrivacy } from '../src/services/privacyService.js';

const LOG = (...a) => console.log('[smoke]', ...a);

async function main() {
  const tag = `smoke-${Date.now()}`;

  const user = await User.create({
    openid: `smoke-open-${Date.now()}`,
    nickname: 'smoke-tester',
  });
  LOG('created user', user.user_id);

  const project = await Project.create({
    user_id: user.user_id,
    title: `[${tag}] project`,
    start_date: '2024-01-01',
  });
  LOG('created project', project.project_id);

  await Project.update(
    {
      review_status: 'ok',
      review_reason: null,
      review_checked_at: new Date(),
    },
    { where: { project_id: project.project_id } }
  );
  LOG('project review_status forced ok for isolated content-flag test');

  const content = await createContent(project.project_id, user.user_id, {
    content_type: 'note',
    content_data: { title: `${tag}-c`, content: '<p>hello world</p>' },
    record_time: new Date().toISOString(),
  });
  LOG('created content', content.content_id, 'review_status=', content.review_status);
  if (content.review_status !== 'pending') {
    throw new Error('STEP 1b FAIL: new content with text should start as pending');
  }

  await Content.update(
    { review_status: 'flagged', review_reason: 'risky', review_checked_at: new Date() },
    { where: { content_id: content.content_id } }
  );
  LOG('manually flagged content');

  // 步骤 3
  let blocked3 = null;
  try {
    await assertProjectContentReviewable(project.project_id, { action: '导出' });
  } catch (err) {
    blocked3 = err;
  }
  if (!blocked3 || blocked3.code !== 'CONTENT_REVIEW_BLOCKED') {
    throw new Error('STEP 3 FAIL: guard did not block as expected');
  }
  LOG('step3 guard blocked as expected:', blocked3.message, '| code=', blocked3.code);

  // 步骤 4
  let blocked4 = null;
  try {
    await generateProjectHtmlExport(project.project_id, user.user_id);
  } catch (err) {
    blocked4 = err;
  }
  if (!blocked4 || blocked4.code !== 'CONTENT_REVIEW_BLOCKED') {
    throw new Error('STEP 4 FAIL: export did not block as expected');
  }
  LOG('step4 export blocked as expected:', blocked4.message);

  // 步骤 5
  // 先开放项目可见性，否则 createProjectShare 会先因为私密项目 403 (这我们不想验证)
  await setProjectPrivacy(project.project_id, user.user_id, { visibility: 3 });
  let blocked5 = null;
  try {
    await createProjectShare(project.project_id, user.user_id, { expires_in_hours: 24 });
  } catch (err) {
    blocked5 = err;
  }
  if (!blocked5 || blocked5.code !== 'CONTENT_REVIEW_BLOCKED') {
    throw new Error('STEP 5 FAIL: share did not block as expected, got=' + (blocked5 && blocked5.message));
  }
  LOG('step5 share blocked as expected:', blocked5.message);

  // 步骤 6：通过 updateContent 重新保存——乐观清零
  await updateContent(project.project_id, content.content_id, user.user_id, {
    content_data: { title: `${tag}-c (fixed)`, content: '<p>fixed content</p>' },
  });
  const refreshed = await Content.findByPk(content.content_id);
  LOG('after updateContent: review_status=', refreshed.review_status, 'reason=', refreshed.review_reason);
  if (refreshed.review_status !== 'pending' || refreshed.review_reason !== null) {
    throw new Error('STEP 6 FAIL: updateContent should set pending when text needs audit');
  }

  // 步骤 7：pending 应拦截传播
  let blocked7 = null;
  try {
    await assertProjectContentReviewable(project.project_id, { action: '导出' });
  } catch (err) {
    blocked7 = err;
  }
  if (!blocked7 || blocked7.code !== REVIEW_PENDING_CODE) {
    throw new Error(`STEP 7 FAIL: expected ${REVIEW_PENDING_CODE}, got ${blocked7 && blocked7.code}`);
  }
  LOG('step7 guard blocked pending as expected');

  await Content.update(
    {
      review_status: 'ok',
      review_reason: null,
      review_checked_at: new Date(),
    },
    { where: { content_id: content.content_id } }
  );

  // 步骤 8
  await assertProjectContentReviewable(project.project_id, { action: '导出' });
  LOG('step8 guard passes after simulated async ok');

  // 清理
  await Content.destroy({ where: { content_id: content.content_id } });
  await Project.destroy({ where: { project_id: project.project_id } });
  await User.destroy({ where: { user_id: user.user_id } });
  LOG('cleanup done');

  await sequelize.close();
  LOG('ALL STEPS PASSED ✅');
}

main().catch(async (err) => {
  console.error('[smoke] FAILED:', err);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
