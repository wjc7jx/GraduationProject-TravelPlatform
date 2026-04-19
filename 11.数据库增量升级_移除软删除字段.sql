-- ============================================================
-- 数据库增量升级：移除 projects / contents 软删除字段
-- 适用：已从旧版建表脚本创建、仍含 is_deleted / deleted_at 的库
-- 执行前请先备份数据库
-- ============================================================

USE `travel_db`;

START TRANSACTION;

-- projects
ALTER TABLE `projects` DROP INDEX `idx_projects_archived_deleted`;
ALTER TABLE `projects` DROP CHECK `chk_projects_is_deleted`;
ALTER TABLE `projects`
  DROP COLUMN `is_deleted`,
  DROP COLUMN `deleted_at`;
ALTER TABLE `projects`
  ADD KEY `idx_projects_user_archived` (`user_id`, `is_archived`);

-- contents
ALTER TABLE `contents` DROP INDEX `idx_contents_deleted`;
ALTER TABLE `contents` DROP CHECK `chk_contents_is_deleted`;
ALTER TABLE `contents`
  DROP COLUMN `is_deleted`,
  DROP COLUMN `deleted_at`;

COMMIT;
