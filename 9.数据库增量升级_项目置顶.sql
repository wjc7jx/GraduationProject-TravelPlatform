-- ============================================================
-- 旅行项目管理系统（Travel Project Management System）
-- 增量升级脚本：projects 新增置顶字段
-- 适用：已存在 travel_db 与 projects 表的环境
-- ============================================================

SET NAMES utf8mb4;
USE `travel_db`;

ALTER TABLE `projects`
  ADD COLUMN `is_pinned` TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶：1是，0否' AFTER `tags`,
  ADD COLUMN `pinned_at` DATETIME DEFAULT NULL COMMENT '置顶时间' AFTER `is_pinned`;

ALTER TABLE `projects`
  ADD INDEX `idx_projects_user_pinned` (`user_id`, `is_pinned`, `pinned_at`);
