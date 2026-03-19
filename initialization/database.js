// initialization/database.js
const db = require('../config/database');

/**
 * PostgreSQL 数据库初始化
 * 检查并修复表结构
 */
async function initializeDatabase() {
  console.log('🚀 开始 PostgreSQL 数据库结构检查...');

  try {
    // 简单的连接测试
    const result = await db.pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL 数据库连接验证成功');

    // 检查并创建所有表
    await checkAndCreateTables();

    // 验证表是否创建成功
    const tables = await db.pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    console.log(`📡 数据库中共有 ${tables.rowCount} 个表`);

    // 检查并修复表结构
    await checkAndRepairTableStructures();

    console.log('✅ 数据库结构检查完成');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL 数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 检查表是否存在，不存在则创建
 */
async function checkAndCreateTables() {
  console.log('📦 检查数据库表...');

  // 定义所有表的创建语句
  const tableDefinitions = {
    users: `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        registration_order INTEGER,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(email)
      )
    `,

    topics: `
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        announcement TEXT,
        created_by VARCHAR(255) REFERENCES users(id),
        is_private BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        message_count INTEGER DEFAULT 0,
        last_activity TIMESTAMP,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    topic_members: `
      CREATE TABLE IF NOT EXISTS topic_members (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, user_id)
      )
    `,

    topic_muted_users: `
      CREATE TABLE IF NOT EXISTS topic_muted_users (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        muted_by VARCHAR(255) REFERENCES users(id),
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, user_id)
      )
    `,

    messages: `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id),
        content TEXT,
        message_type VARCHAR(50) DEFAULT 'normal',
        message_subtype VARCHAR(50) DEFAULT 'text',
        source_type VARCHAR(50) DEFAULT 'chatroom',
        forward_source_id INTEGER,
        quoted_message_id INTEGER,
        file_url TEXT,
        file_name VARCHAR(255),
        file_size INTEGER,
        file_type VARCHAR(255),
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    private_messages: `
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) REFERENCES users(id),
        receiver_id VARCHAR(255) REFERENCES users(id),
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        message_type VARCHAR(50) DEFAULT 'normal',
        message_subtype VARCHAR(50) DEFAULT 'text',
        source_type VARCHAR(50) DEFAULT 'private',
        forward_source_id INTEGER,
        quoted_message_id INTEGER,
        file_url TEXT,
        file_name VARCHAR(255),
        file_size INTEGER,
        file_type VARCHAR(255),
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    message_versions: `
      CREATE TABLE IF NOT EXISTS message_versions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_type VARCHAR(50) DEFAULT 'public'
      )
    `,

    forwarded_messages: `
      CREATE TABLE IF NOT EXISTS forwarded_messages (
        id SERIAL PRIMARY KEY,
        original_message_id INTEGER NOT NULL,
        forwarded_message_id INTEGER NOT NULL,
        forwarder_id VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_type VARCHAR(50) DEFAULT 'public'
      )
    `,

    communities: `
      CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        tags TEXT,
        avatar_url TEXT,
        cover_image_url TEXT,
        created_by VARCHAR(255) REFERENCES users(id),
        type VARCHAR(50) DEFAULT 'public',
        join_policy VARCHAR(50) DEFAULT 'open',
        member_count INTEGER DEFAULT 0,
        post_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(name)
      )
    `,

    community_members: `
      CREATE TABLE IF NOT EXISTS community_members (
        id SERIAL PRIMARY KEY,
        community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        join_reason TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        UNIQUE(community_id, user_id)
      )
    `,

    subsections: `
      CREATE TABLE IF NOT EXISTS subsections (
        id SERIAL PRIMARY KEY,
        community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        order_num INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(community_id, name)
      )
    `,

    posts: `
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        community_id INTEGER REFERENCES communities(id),
        user_id VARCHAR(255) REFERENCES users(id),
        subsection_id INTEGER REFERENCES subsections(id),
        category_id INTEGER,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        tags TEXT,
        attachment_urls TEXT,
        type VARCHAR(50) DEFAULT 'discussion',
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'published',
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    blog_categories: `
      CREATE TABLE IF NOT EXISTS blog_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `,

    moments: `
      CREATE TABLE IF NOT EXISTS moments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        content TEXT,
        type VARCHAR(50) DEFAULT 'public',
        visibility VARCHAR(50) DEFAULT 'public',
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    follows: `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id VARCHAR(255) REFERENCES users(id),
        following_id VARCHAR(255) REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `,

    friends: `
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user1_id VARCHAR(255) REFERENCES users(id),
        user2_id VARCHAR(255) REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(user1_id, user2_id)
      )
    `,

    comments: `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        target_type VARCHAR(50) NOT NULL,
        target_id INTEGER NOT NULL,
        content TEXT,
        parent_id INTEGER REFERENCES comments(id),
        status VARCHAR(50) DEFAULT 'active',
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    likes: `
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        target_type VARCHAR(50) NOT NULL,
        target_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, target_type, target_id)
      )
    `
  };

  // 按依赖顺序检查并创建表
  const tableOrder = [
    'users', 'topics', 'topic_members', 'topic_muted_users',
    'messages', 'private_messages', 'message_versions', 'forwarded_messages',
    'communities', 'community_members', 'subsections', 'posts',
    'blog_categories', 'moments', 'follows', 'friends',
    'comments', 'likes'
  ];

  for (const tableName of tableOrder) {
    try {
      // 检查表是否存在
      const tableExists = await db.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);

      if (!tableExists.rows[0].exists) {
        console.log(`  ➕ 创建表: ${tableName}`);
        await db.pool.query(tableDefinitions[tableName]);
      } else {
        console.log(`  ✅ 表已存在: ${tableName}`);
      }
    } catch (error) {
      console.error(`  ❌ 处理表 ${tableName} 时出错:`, error.message);
      throw error;
    }
  }
}

/**
 * 检查并修复表结构（添加缺失的索引和约束）
 */
async function checkAndRepairTableStructures() {
  console.log('🔧 检查并修复表结构...');

  // 定义所有需要检查的索引
  const indexDefinitions = [
    // users 表索引
    { name: 'idx_users_username', table: 'users', column: 'username' },
    { name: 'idx_users_email', table: 'users', column: 'email' },
    { name: 'idx_users_verification_token', table: 'users', column: 'verification_token' },
    { name: 'idx_users_reset_token', table: 'users', column: 'reset_token' },

    // topics 表索引
    { name: 'idx_topics_name', table: 'topics', column: 'name' },
    { name: 'idx_topics_created_by', table: 'topics', column: 'created_by' },
    { name: 'idx_topics_last_activity', table: 'topics', column: 'last_activity' },

    // topic_members 索引
    { name: 'idx_topic_members_topic_id', table: 'topic_members', column: 'topic_id' },
    { name: 'idx_topic_members_user_id', table: 'topic_members', column: 'user_id' },

    // messages 索引
    { name: 'idx_messages_topic_id', table: 'messages', column: 'topic_id' },
    { name: 'idx_messages_user_id', table: 'messages', column: 'user_id' },
    { name: 'idx_messages_created_at', table: 'messages', column: 'created_at' },
    { name: 'idx_messages_topic_id_created_at', table: 'messages', columns: ['topic_id', 'created_at'] },

    // private_messages 索引
    { name: 'idx_private_messages_sender_id', table: 'private_messages', column: 'sender_id' },
    { name: 'idx_private_messages_receiver_id', table: 'private_messages', column: 'receiver_id' },
    { name: 'idx_private_messages_sender_receiver', table: 'private_messages', columns: ['sender_id', 'receiver_id'] },
    { name: 'idx_private_messages_created_at', table: 'private_messages', column: 'created_at' },

    // message_versions 索引
    { name: 'idx_message_versions_message_id', table: 'message_versions', column: 'message_id' },

    // communities 索引
    { name: 'idx_communities_name', table: 'communities', column: 'name' },
    { name: 'idx_communities_topic_id', table: 'communities', column: 'topic_id' },
    { name: 'idx_communities_created_by', table: 'communities', column: 'created_by' },

    // community_members 索引
    { name: 'idx_community_members_community_id', table: 'community_members', column: 'community_id' },
    { name: 'idx_community_members_user_id', table: 'community_members', column: 'user_id' },

    // posts 索引
    { name: 'idx_posts_community_id', table: 'posts', column: 'community_id' },
    { name: 'idx_posts_user_id', table: 'posts', column: 'user_id' },
    { name: 'idx_posts_subsection_id', table: 'posts', column: 'subsection_id' },
    { name: 'idx_posts_created_at', table: 'posts', column: 'created_at' },
    { name: 'idx_posts_type', table: 'posts', column: 'type' },

    // moments 索引
    { name: 'idx_moments_user_id', table: 'moments', column: 'user_id' },
    { name: 'idx_moments_created_at', table: 'moments', column: 'created_at' },
    { name: 'idx_moments_visibility', table: 'moments', column: 'visibility' },

    // follows 索引
    { name: 'idx_follows_follower_id', table: 'follows', column: 'follower_id' },
    { name: 'idx_follows_following_id', table: 'follows', column: 'following_id' },

    // friends 索引
    { name: 'idx_friends_user1_id', table: 'friends', column: 'user1_id' },
    { name: 'idx_friends_user2_id', table: 'friends', column: 'user2_id' },
    { name: 'idx_friends_status', table: 'friends', column: 'status' },

    // comments 索引
    { name: 'idx_comments_target', table: 'comments', columns: ['target_type', 'target_id'] },
    { name: 'idx_comments_user_id', table: 'comments', column: 'user_id' },
    { name: 'idx_comments_parent_id', table: 'comments', column: 'parent_id' },

    // likes 索引
    { name: 'idx_likes_target', table: 'likes', columns: ['target_type', 'target_id'] },
    { name: 'idx_likes_user_id', table: 'likes', column: 'user_id' }
  ];

  for (const indexDef of indexDefinitions) {
    try {
      // 检查索引是否存在
      const indexExists = await db.pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename = $1 
          AND indexname = $2
        )
      `, [indexDef.table, indexDef.name]);

      if (!indexExists.rows[0].exists) {
        // 检查表是否存在
        const tableExists = await db.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [indexDef.table]);

        if (tableExists.rows[0].exists) {
          // 创建索引
          let columnClause = indexDef.column || indexDef.columns.join(', ');
          console.log(`  🔨 创建索引: ${indexDef.name} ON ${indexDef.table}(${columnClause})`);

          await db.pool.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexDef.name} 
            ON ${indexDef.table} (${columnClause})
          `);
        }
      }
    } catch (error) {
      console.error(`  ⚠️ 处理索引 ${indexDef.name} 时出错:`, error.message);
      // 继续处理下一个索引，不中断流程
    }
  }
}

module.exports = { initializeDatabase };