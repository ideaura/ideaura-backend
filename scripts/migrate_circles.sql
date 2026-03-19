BEGIN TRANSACTION;

-- 1. 解除 topics 表名 UNIQUE 约束
CREATE TABLE new_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  announcement TEXT,
  created_by INTEGER NOT NULL,
  is_private BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  message_count INTEGER DEFAULT 0,
  avatar_url TEXT,
  last_activity DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 通过明确指定列名进行插入，并且由于旧 topics 表缺少 avatar_url 列，因此直接填充 NULL 防止偏移错位
INSERT INTO new_topics (id, name, description, announcement, created_by, is_private, is_active, message_count, avatar_url, last_activity, created_at)
SELECT 
  id, 
  name, 
  description, 
  announcement, 
  created_by, 
  is_private, 
  is_active, 
  message_count, 
  NULL AS avatar_url, 
  last_activity, 
  created_at 
FROM topics;

DROP TABLE topics;
ALTER TABLE new_topics RENAME TO topics;
CREATE INDEX idx_topics_name ON topics(name);
CREATE INDEX idx_topics_created_by ON topics(created_by);
CREATE INDEX idx_topics_is_private ON topics(is_private);
CREATE INDEX idx_topics_is_active ON topics(is_active);
CREATE INDEX idx_topics_last_activity ON topics(last_activity);
CREATE INDEX idx_topics_created_at ON topics(created_at);

-- 2. 修改 communities 表解除 UNIQUE 限制并新增 topic_id
CREATE TABLE new_communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  avatar_url TEXT,
  cover_image_url TEXT,
  created_by INTEGER NOT NULL,
  type TEXT DEFAULT 'public',
  join_policy TEXT DEFAULT 'open',
  is_active BOOLEAN DEFAULT 1,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 构建对应的新圈子 (插入到 new_communities 中)
-- 使用左连接将旧版 communities 表对应保留的 avatar_url 以及 tags 等值成功迁移过去
INSERT INTO new_communities (
  id, topic_id, name, description, tags, avatar_url, cover_image_url, 
  created_by, type, join_policy, is_active, member_count, post_count, 
  created_at, updated_at
)
SELECT 
  t.id, 
  t.id AS topic_id,
  t.name, 
  t.description, 
  c.tags, 
  c.avatar_url, 
  c.cover_image_url, 
  t.created_by, 
  COALESCE(c.type, CASE WHEN t.is_private = 1 THEN 'private' ELSE 'public' END) AS type, 
  COALESCE(c.join_policy, 'open') AS join_policy, 
  t.is_active, 
  COALESCE(c.member_count, 0) AS member_count, 
  COALESCE(c.post_count, 0) AS post_count, 
  t.created_at, 
  datetime('now', 'localtime') AS updated_at
FROM topics t
LEFT JOIN communities c ON c.name = t.name;

DROP TABLE communities;
ALTER TABLE new_communities RENAME TO communities;
CREATE INDEX idx_communities_name ON communities(name);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_communities_type ON communities(type);
CREATE INDEX idx_communities_join_policy ON communities(join_policy);
CREATE INDEX idx_communities_is_active ON communities(is_active);
CREATE INDEX idx_communities_created_at ON communities(created_at);

-- 清洗合并后的残留尾缀 “圈” （在合并之后进行以防止联表时由于有一方被修改过而错位匹配不上）
UPDATE communities SET name = SUBSTR(name, 1, LENGTH(name) - 1) WHERE name LIKE '%圈';
UPDATE topics SET name = SUBSTR(name, 1, LENGTH(name) - 1) WHERE name LIKE '%圈';

-- 4. 重新同步建立成员表
DELETE FROM community_members;
INSERT INTO community_members (community_id, user_id, role, status, joined_at)
SELECT 
    topic_id AS community_id,
    user_id,
    CASE 
        WHEN role = 'creator' THEN 'owner'
        WHEN role = 'admin' THEN 'admin'
        ELSE 'member' 
    END AS role,
    'active' AS status,
    joined_at
FROM topic_members;

-- 5. 更新圈子的成员数量
UPDATE communities 
SET member_count = (
    SELECT COUNT(*) 
    FROM community_members 
    WHERE community_members.community_id = communities.id
);

COMMIT;
