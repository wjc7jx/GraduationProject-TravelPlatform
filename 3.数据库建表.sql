-- ============================================================
-- 旅行项目管理系统（Travel Project Management System）
-- MySQL 8.0 可执行建表脚本
-- 字符集: utf8mb4 / 排序规则: utf8mb4_0900_ai_ci
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) 创建数据库
CREATE DATABASE IF NOT EXISTS `travel_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `travel_db`;

-- 2) 如需重复执行脚本，先按依赖顺序删表
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `friendships`;
DROP TABLE IF EXISTS `contents`;
DROP TABLE IF EXISTS `locations`;
DROP TABLE IF EXISTS `projects`;
DROP TABLE IF EXISTS `users`;

-- 3) 用户表
CREATE TABLE `users` (
  `user_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户唯一ID',
  `openid` VARCHAR(64) NOT NULL COMMENT '微信小程序用户唯一标识',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `nickname` VARCHAR(50) NOT NULL DEFAULT '旅行者' COMMENT '用户昵称',
  `avatar_url` VARCHAR(255) DEFAULT NULL COMMENT '用户头像URL',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '账号状态：1正常，0禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_users_openid` (`openid`),
  KEY `idx_users_status` (`status`),
  CONSTRAINT `chk_users_status` CHECK (`status` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';

-- 4) 旅行项目表
CREATE TABLE `projects` (
  `project_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '项目唯一ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',
  `title` VARCHAR(100) NOT NULL COMMENT '旅行项目标题',
  `subtitle` VARCHAR(255) DEFAULT NULL COMMENT '旅行副标题/一句话描述',
  `cover_image` VARCHAR(255) DEFAULT NULL COMMENT '封面图片URL',
  `start_date` DATE NOT NULL COMMENT '旅行开始日期',
  `end_date` DATE DEFAULT NULL COMMENT '旅行结束日期',
  `tags` VARCHAR(100) DEFAULT NULL COMMENT '项目标签，逗号分隔',
  `is_pinned` TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶：1是，0否',
  `pinned_at` DATETIME DEFAULT NULL COMMENT '置顶时间',
  `is_archived` TINYINT NOT NULL DEFAULT 0 COMMENT '是否归档：1是，0否',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`project_id`),
  KEY `idx_projects_user_id` (`user_id`),
  KEY `idx_projects_user_updated` (`user_id`, `updated_at`),
  KEY `idx_projects_user_pinned` (`user_id`, `is_pinned`, `pinned_at`),
  KEY `idx_projects_user_archived` (`user_id`, `is_archived`),
  CONSTRAINT `fk_projects_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_projects_is_archived` CHECK (`is_archived` IN (0,1)),
  CONSTRAINT `chk_projects_date_range` CHECK (`end_date` IS NULL OR `end_date` >= `start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='旅行项目表';

-- 5) 位置信息表
CREATE TABLE `locations` (
  `location_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '位置唯一ID',
  `longitude` DECIMAL(10,7) NOT NULL COMMENT '经度',
  `latitude` DECIMAL(10,7) NOT NULL COMMENT '纬度',
  `name` VARCHAR(100) DEFAULT NULL COMMENT '地点名称',
  `address` VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
  `city` VARCHAR(50) DEFAULT NULL COMMENT '城市',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`location_id`),
  KEY `idx_locations_city` (`city`),
  KEY `idx_locations_lng_lat` (`longitude`, `latitude`),
  CONSTRAINT `chk_locations_longitude` CHECK (`longitude` BETWEEN -180 AND 180),
  CONSTRAINT `chk_locations_latitude` CHECK (`latitude` BETWEEN -90 AND 90)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='位置信息表';

-- 6) 多媒体内容表
CREATE TABLE `contents` (
  `content_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内容明细ID',
  `project_id` BIGINT UNSIGNED NOT NULL COMMENT '所属项目ID',
  `content_type` ENUM('photo','note','audio') NOT NULL COMMENT '内容类型',
  `content_data` JSON NOT NULL COMMENT '内容JSON数据（URL、文本、EXIF、时长、轨迹点等）',
  `record_time` DATETIME NOT NULL COMMENT '记录时间（时间轴核心）',
  `location_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '位置ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '手动排序权重',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`content_id`),
  KEY `idx_contents_project_id` (`project_id`),
  KEY `idx_contents_project_record_time` (`project_id`, `record_time`),
  KEY `idx_contents_location_id` (`location_id`),
  CONSTRAINT `fk_contents_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_contents_location_id` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chk_contents_sort_order` CHECK (`sort_order` >= 0),
  CONSTRAINT `chk_contents_content_data_json` CHECK (JSON_VALID(`content_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='多媒体内容表';

-- 7) 权限规则表（多态关联：project/content）
CREATE TABLE `permissions` (
  `permission_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '权限规则ID',
  `target_type` ENUM('project','content') NOT NULL COMMENT '目标类型',
  `target_id` BIGINT UNSIGNED NOT NULL COMMENT '目标ID',
  `visibility` TINYINT NOT NULL DEFAULT 1 COMMENT '可见性：1私密，2好友可见，3公开',
  `white_list` JSON DEFAULT NULL COMMENT '白名单用户ID数组（visibility=2时使用）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `uk_permissions_target` (`target_type`, `target_id`),
  KEY `idx_permissions_visibility` (`visibility`),
  CONSTRAINT `chk_permissions_visibility` CHECK (`visibility` IN (1,2,3)),
  CONSTRAINT `chk_permissions_white_list_json` CHECK (`white_list` IS NULL OR JSON_VALID(`white_list`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限规则表';

-- 8) 好友关系表（双向各存一条记录：A->B 与 B->A）
CREATE TABLE `friendships` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关系ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `friend_id` BIGINT UNSIGNED NOT NULL COMMENT '好友用户ID',
  `remark` VARCHAR(50) DEFAULT NULL COMMENT '本方备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_friendships_pair` (`user_id`, `friend_id`),
  KEY `idx_friendships_user_id` (`user_id`),
  KEY `idx_friendships_friend_id` (`friend_id`),
  CONSTRAINT `fk_friendships_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_friendships_friend_id` FOREIGN KEY (`friend_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_friendships_self` CHECK (`user_id` <> `friend_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='好友关系表';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 可选说明：
-- 1) permissions 为多态关联，target_id 无法直接加外键到两张表。
--    需在应用层根据 target_type 校验 target_id 是否存在。
-- ============================================================
