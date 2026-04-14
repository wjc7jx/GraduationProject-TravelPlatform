-- ============================================================
-- 旅行项目管理系统（Travel Project Management System）
-- 增量升级脚本：projects 新增 subtitle 字段
-- 适用：已存在 travel_db 与 projects 表的环境
-- ============================================================

SET NAMES utf8mb4;
USE `travel_db`;

ALTER TABLE `projects`
  ADD COLUMN `subtitle` VARCHAR(255) DEFAULT NULL COMMENT '旅行副标题/一句话描述' AFTER `title`;
