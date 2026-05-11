-- ============================================================
-- review_status 扩展：增加 pending（异步内容安全审核进行中）
-- 执行前提：已执行 13.数据库更新语句_内容合规审核标记.sql
-- ============================================================

USE `travel_db`;

ALTER TABLE `projects`
  MODIFY COLUMN `review_status` ENUM('ok','pending','flagged') NOT NULL DEFAULT 'ok'
    COMMENT '内容合规：ok 已通过，pending 审核中，flagged 命中需修改';

ALTER TABLE `contents`
  MODIFY COLUMN `review_status` ENUM('ok','pending','flagged') NOT NULL DEFAULT 'ok'
    COMMENT '内容合规：ok 已通过，pending 审核中，flagged 命中需修改';
