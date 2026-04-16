-- ============================================================
-- 数据库增量升级：邀请码好友 + 项目分享追溯/撤销 + 内容级隐私清理
-- 执行前请先备份数据库
-- ============================================================

USE `travel_db`;

START TRANSACTION;

-- 1) 清理内容级隐私规则：后续统一按项目级隐私控制
DELETE FROM `permissions`
WHERE `target_type` = 'content';

-- 2) 动态邀请码表
CREATE TABLE IF NOT EXISTS `invitation_codes` (
  `invitation_code_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '邀请码记录ID',
  `code` VARCHAR(32) NOT NULL COMMENT '邀请码',
  `creator_user_id` BIGINT UNSIGNED NOT NULL COMMENT '邀请码创建者',
  `max_uses` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '最大可用次数',
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已使用次数',
  `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1有效，0失效',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`invitation_code_id`),
  UNIQUE KEY `uk_invitation_codes_code` (`code`),
  KEY `idx_invitation_codes_creator` (`creator_user_id`, `created_at`),
  KEY `idx_invitation_codes_status_expires` (`status`, `expires_at`),
  CONSTRAINT `fk_invitation_codes_creator_user_id`
    FOREIGN KEY (`creator_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_invitation_codes_status` CHECK (`status` IN (0,1)),
  CONSTRAINT `chk_invitation_codes_used_count` CHECK (`used_count` <= `max_uses`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='好友邀请码表';

-- 3) 项目分享记录表（可追溯、可撤销）
CREATE TABLE IF NOT EXISTS `project_shares` (
  `share_id` VARCHAR(64) NOT NULL COMMENT '分享唯一标识(UUID)',
  `project_id` BIGINT UNSIGNED NOT NULL COMMENT '被分享项目ID',
  `creator_user_id` BIGINT UNSIGNED NOT NULL COMMENT '分享创建者',
  `view_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '访问次数',
  `is_revoked` TINYINT NOT NULL DEFAULT 0 COMMENT '是否撤销：1是，0否',
  `revoked_at` DATETIME DEFAULT NULL COMMENT '撤销时间',
  `expires_at` DATETIME DEFAULT NULL COMMENT '失效时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`share_id`),
  KEY `idx_project_shares_project_created` (`project_id`, `created_at`),
  KEY `idx_project_shares_creator_created` (`creator_user_id`, `created_at`),
  KEY `idx_project_shares_revoked_expires` (`is_revoked`, `expires_at`),
  CONSTRAINT `fk_project_shares_project_id`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_project_shares_creator_user_id`
    FOREIGN KEY (`creator_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_project_shares_is_revoked` CHECK (`is_revoked` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='项目分享记录表';

COMMIT;
