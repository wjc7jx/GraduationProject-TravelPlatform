-- ============================================================
-- 内容合规审核标记字段
-- - review_status: 'ok' 默认，'flagged' 代表命中微信内容安全接口
-- - review_reason: 命中原因（reason/label/suggest 的简述）
-- - review_checked_at: 最近一次检测时间
-- 说明：命中后由后端在异步检测流程中 UPDATE 该行；
--      用户再次编辑（create/update）时会重置为 ok 以触发重检。
-- ============================================================

USE `travel_db`;

-- projects 表
ALTER TABLE `projects`
  ADD COLUMN `review_status` ENUM('ok','flagged') NOT NULL DEFAULT 'ok'
    COMMENT '内容合规审核状态：ok 正常，flagged 命中需修改' AFTER `is_archived`,
  ADD COLUMN `review_reason` VARCHAR(64) DEFAULT NULL
    COMMENT '命中原因简述（label/suggest）' AFTER `review_status`,
  ADD COLUMN `review_checked_at` DATETIME DEFAULT NULL
    COMMENT '最近一次内容安全检测时间' AFTER `review_reason`;

ALTER TABLE `projects`
  ADD KEY `idx_projects_review_status` (`review_status`);

-- contents 表
ALTER TABLE `contents`
  ADD COLUMN `review_status` ENUM('ok','flagged') NOT NULL DEFAULT 'ok'
    COMMENT '内容合规审核状态：ok 正常，flagged 命中需修改' AFTER `sort_order`,
  ADD COLUMN `review_reason` VARCHAR(64) DEFAULT NULL
    COMMENT '命中原因简述（label/suggest）' AFTER `review_status`,
  ADD COLUMN `review_checked_at` DATETIME DEFAULT NULL
    COMMENT '最近一次内容安全检测时间' AFTER `review_reason`;

ALTER TABLE `contents`
  ADD KEY `idx_contents_project_review` (`project_id`, `review_status`);
