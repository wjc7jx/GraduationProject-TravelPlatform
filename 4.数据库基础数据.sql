-- ============================================================
-- 旅行项目管理系统（Travel Project Management System）
-- 基础数据初始化脚本
-- 适用：MySQL 8.0
-- ============================================================

SET NAMES utf8mb4;
USE `travel_db`;
SET FOREIGN_KEY_CHECKS = 0;

-- 如需重复执行，先清空基础数据
DELETE FROM `permissions`;
DELETE FROM `contents`;
DELETE FROM `locations`;
DELETE FROM `projects`;
DELETE FROM `users`;

-- 1) 用户基础数据
INSERT INTO `users` (
  `user_id`, `openid`, `phone`, `nickname`, `avatar_url`, `status`, `created_at`, `updated_at`
) VALUES
  (1001, 'openid_demo_zhangsan_001', '13800138001', '张三', 'https://example.com/avatar/zhangsan.png', 1, '2025-03-01 09:00:00', '2025-03-01 09:00:00'),
  (1002, 'openid_demo_lisi_002', '13800138002', '李四', 'https://example.com/avatar/lisi.png', 1, '2025-03-01 09:05:00', '2025-03-01 09:05:00'),
  (1003, 'openid_demo_wangwu_003', NULL, '王五', NULL, 1, '2025-03-01 09:10:00', '2025-03-01 09:10:00');

-- 2) 旅行项目基础数据
INSERT INTO `projects` (
  `project_id`, `user_id`, `title`, `subtitle`, `cover_image`, `start_date`, `end_date`, `tags`, `is_archived`, `created_at`, `updated_at`
) VALUES
  (2001, 1001, '云南七日游', '向雪山和古城出发', 'https://example.com/covers/yunnan-7days.jpg', '2025-07-01', '2025-07-07', '自驾,徒步,摄影', 0, '2025-03-02 10:00:00', '2025-03-02 10:00:00'),
  (2002, 1001, '周末露营记', '在山野里住两晚', 'https://example.com/covers/camping-weekend.jpg', '2025-08-16', '2025-08-17', '露营,亲子,轻户外', 0, '2025-03-02 10:05:00', '2025-03-02 10:05:00'),
  (2003, 1002, '厦门海边慢旅行', '把海风装进行李箱', 'https://example.com/covers/xiamen-coast.jpg', '2025-09-10', '2025-09-14', '海边,美食,慢旅行', 1, '2025-03-02 10:10:00', '2025-03-02 10:10:00');

-- 3) 位置信息基础数据
INSERT INTO `locations` (
  `location_id`, `longitude`, `latitude`, `name`, `address`, `city`, `created_at`
) VALUES
  (3001, 100.2334921, 26.8795688, '丽江古城', '云南省丽江市古城区四方街附近', '丽江', '2025-03-03 08:00:00'),
  (3002, 100.0812345, 25.7033210, '洱海双廊', '云南省大理白族自治州大理市双廊镇', '大理', '2025-03-03 08:05:00'),
  (3003, 102.8329100, 24.8801200, '玉龙雪山游客中心', '云南省丽江市玉龙纳西族自治县', '丽江', '2025-03-03 08:10:00'),
  (3004, 118.1213880, 24.4854080, '鼓浪屿钢琴码头', '福建省厦门市思明区鼓浪屿', '厦门', '2025-03-03 08:15:00');

-- 4) 内容基础数据
INSERT INTO `contents` (
  `content_id`, `project_id`, `content_type`, `content_data`, `record_time`, `location_id`, `sort_order`, `created_at`, `updated_at`
) VALUES
  (
    4001,
    2001,
    'photo',
    JSON_OBJECT(
      'url', 'https://example.com/content/yunnan/photo-01.jpg',
      'title', '到达丽江',
      'width', 3024,
      'height', 4032,
      'fileName', 'lijiang-arrival.jpg'
    ),
    '2025-07-01 10:20:00',
    3001,
    1,
    '2025-03-04 09:00:00',
    '2025-03-04 09:00:00'
  ),
  (
    4002,
    2001,
    'note',
    JSON_OBJECT(
      'title', '第一天见闻',
      'text', '上午抵达丽江古城，下午在四方街附近慢慢闲逛，记录旅途的第一段心情。',
      'tags', JSON_ARRAY('丽江', '古城', '日记')
    ),
    '2025-07-01 20:10:00',
    3001,
    2,
    '2025-03-04 09:05:00',
    '2025-03-04 09:05:00'
  ),
  (
    4003,
    2001,
    'audio',
    JSON_OBJECT(
      'url', 'https://example.com/content/yunnan/audio-01.mp3',
      'title', '古城街边环境音',
      'duration', 38,
      'transcript', '傍晚的古城很热闹，路边传来轻音乐和游客的谈笑声。'
    ),
    '2025-07-01 21:00:00',
    NULL,
    3,
    '2025-03-04 09:10:00',
    '2025-03-04 09:10:00'
  ),
  (
    4004,
    2001,
    'track',
    JSON_OBJECT(
      'distanceKm', 12.6,
      'durationMin', 52,
      'points', JSON_ARRAY(
        JSON_OBJECT('lng', 100.2334921, 'lat', 26.8795688, 'time', '2025-07-01 08:30:00'),
        JSON_OBJECT('lng', 100.1200000, 'lat', 26.8600000, 'time', '2025-07-01 09:10:00'),
        JSON_OBJECT('lng', 100.0812345, 'lat', 25.7033210, 'time', '2025-07-01 12:00:00')
      )
    ),
    '2025-07-01 12:00:00',
    3002,
    4,
    '2025-03-04 09:15:00',
    '2025-03-04 09:15:00'
  ),
  (
    4005,
    2002,
    'photo',
    JSON_OBJECT(
      'url', 'https://example.com/content/camping/photo-01.jpg',
      'title', '搭起帐篷',
      'width', 4032,
      'height', 3024,
      'fileName', 'camping-tent.jpg'
    ),
    '2025-08-16 15:30:00',
    3003,
    1,
    '2025-03-04 09:20:00',
    '2025-03-04 09:20:00'
  ),
  (
    4006,
    2002,
    'note',
    JSON_OBJECT(
      'title', '露营准备清单',
      'text', '帐篷、睡袋、折叠椅、照明灯和便携炉具都已准备完毕。',
      'tags', JSON_ARRAY('露营', '清单', '准备')
    ),
    '2025-08-16 18:20:00',
    3003,
    2,
    '2025-03-04 09:25:00',
    '2025-03-04 09:25:00'
  ),
  (
    4007,
    2003,
    'note',
    JSON_OBJECT(
      'title', '海边散步',
      'text', '鼓浪屿的傍晚很安静，适合慢慢拍照、看海、写几行字。',
      'tags', JSON_ARRAY('厦门', '海边', '慢旅行')
    ),
    '2025-09-10 17:40:00',
    3004,
    1,
    '2025-03-04 09:30:00',
    '2025-03-04 09:30:00'
  );

-- 5) 权限规则基础数据
INSERT INTO `permissions` (
  `permission_id`, `target_type`, `target_id`, `visibility`, `white_list`, `created_at`, `updated_at`
) VALUES
  (5001, 'project', 2001, 3, NULL, '2025-03-05 10:00:00', '2025-03-05 10:00:00'),
  (5002, 'project', 2002, 2, JSON_ARRAY(1002, 1003), '2025-03-05 10:05:00', '2025-03-05 10:05:00'),
  (5003, 'content', 4002, 1, NULL, '2025-03-05 10:10:00', '2025-03-05 10:10:00'),
  (5004, 'content', 4007, 3, NULL, '2025-03-05 10:15:00', '2025-03-05 10:15:00');

SET FOREIGN_KEY_CHECKS = 1;

-- 说明：
-- 1) 这份数据用于本地开发、演示和论文截图，覆盖了用户、项目、内容、位置和权限。
-- 2) 如需扩展，可以继续补充更多 content_type 为 photo / note / audio / track 的示例。