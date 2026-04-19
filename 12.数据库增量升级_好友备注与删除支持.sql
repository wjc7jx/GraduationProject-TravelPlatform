-- ============================================================
-- 数据库增量升级：好友备注与删除支持
-- 执行前请先备份数据库
-- ============================================================

USE `travel_db`;

START TRANSACTION;

-- 1) friendships 增加备注字段（仅本方视角）
ALTER TABLE `friendships`
  ADD COLUMN `remark` VARCHAR(50) NULL COMMENT '本方备注' AFTER `friend_id`;

COMMIT;

