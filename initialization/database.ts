// initialization/database.ts
import db from '../config/database.ts';

/**
 * PostgreSQL 数据库初始化
 * 检查并修复表结构
 */
async function initializeDatabase(): Promise<boolean> {
  console.log('🚀 开始 PostgreSQL 数据库结构检查...');

  try {
    // 简单的连接测试
    await db.pool.query('SELECT NOW()');
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

async function checkAndCreateTables(): Promise<void> {
  console.log('📦 检查数据库表...');

  const tableDefinitions: Record<string, string> = {
    users: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        registration_order INTEGER,
        avatar_url TEXT,
        is_bot BOOLEAN DEFAULT FALSE,
        bot_owner_id INTEGER REFERENCES users(id),
        auto_accept_friends BOOLEAN DEFAULT TRUE,
        allow_topic_invites BOOLEAN DEFAULT TRUE,
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
        created_by INTEGER REFERENCES users(id),
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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, user_id)
      )
    `,

    topic_muted_users: `
      CREATE TABLE IF NOT EXISTS topic_muted_users (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        muted_by INTEGER REFERENCES users(id),
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, user_id)
      )
    `,

    messages: `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
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
        command_id VARCHAR(255),
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `,

    private_messages: `
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
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
        command_id VARCHAR(255),
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

    bot_tokens: `
      CREATE TABLE IF NOT EXISTS bot_tokens (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,

    bot_commands: `
      CREATE TABLE IF NOT EXISTS bot_commands (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        command_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bot_id, command_id)
      )
    `,

    forwarded_messages: `
      CREATE TABLE IF NOT EXISTS forwarded_messages (
        id SERIAL PRIMARY KEY,
        original_message_id INTEGER NOT NULL,
        forwarded_message_id INTEGER NOT NULL,
        forwarder_id INTEGER REFERENCES users(id),
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
        created_by INTEGER REFERENCES users(id),
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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
        user_id INTEGER REFERENCES users(id),
        subsection_id INTEGER REFERENCES subsections(id),
        category_id INTEGER,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        tags TEXT,
        attachment_urls TEXT,
        type VARCHAR(50) DEFAULT 'discussion',
        content_type VARCHAR(20) DEFAULT 'text',
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
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `,

    moments: `
      CREATE TABLE IF NOT EXISTS moments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT,
        type VARCHAR(50) DEFAULT 'public',
        visibility VARCHAR(50) DEFAULT 'public',
        media_urls TEXT,
        video_url TEXT,
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
        follower_id INTEGER REFERENCES users(id),
        following_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `,

    friends: `
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER REFERENCES users(id),
        user2_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(user1_id, user2_id)
      )
    `,

    comments: `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
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
        user_id INTEGER REFERENCES users(id),
        target_type VARCHAR(50) NOT NULL,
        target_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, target_type, target_id)
      )
    `,

    user_message_reads: `
      CREATE TABLE IF NOT EXISTS user_message_reads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_type VARCHAR(50) NOT NULL,
        source_id INTEGER NOT NULL,
        last_read_message_id INTEGER DEFAULT 0,
        UNIQUE(user_id, source_type, source_id)
      )
    `,

    message_mentions: `
      CREATE TABLE IF NOT EXISTS message_mentions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        mention_type VARCHAR(50) DEFAULT 'user'
      )
    `,

    file_records: `
      CREATE TABLE IF NOT EXISTS file_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        file_path TEXT NOT NULL,
        file_size BIGINT,
        original_name VARCHAR(500),
        mime_type VARCHAR(255),
        source_type VARCHAR(50) NOT NULL,
        topic_id INTEGER,
        is_private BOOLEAN DEFAULT FALSE,
        message_id INTEGER,
        moment_id INTEGER,
        post_type VARCHAR(50),
        expires_at TIMESTAMP,
        file_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  };

  // 按顺序检查并创建表
  const tableOrder = [
    'users', 'topics', 'topic_members', 'topic_muted_users',
    'messages', 'private_messages', 'message_versions', 'forwarded_messages',
    'communities', 'community_members', 'subsections', 'posts',
    'bot_tokens', 'bot_commands',
    'blog_categories', 'moments', 'follows', 'friends',
    'comments', 'likes', 'user_message_reads', 'message_mentions', 'file_records'
  ];

  for (const tableName of tableOrder) {
    try {
      await db.pool.query(tableDefinitions[tableName]);
    } catch (error) {
      console.error(`创建表 ${tableName} 失败:`, error);
      throw error;
    }
  }

  console.log('✅ 所有表检查完成');
}

async function checkAndRepairTableStructures(): Promise<void> {
  console.log('🔧 检查并修复表结构...');

  const indexDefinitions: { name: string; table: string; columns: string[] }[] = [
    { name: 'idx_messages_topic_id', table: 'messages', columns: ['topic_id'] },
    { name: 'idx_messages_user_id', table: 'messages', columns: ['user_id'] },
    { name: 'idx_messages_created_at', table: 'messages', columns: ['created_at'] },
    { name: 'idx_messages_topic_id_created_at', table: 'messages', columns: ['topic_id', 'created_at'] },
    { name: 'idx_messages_topic_id_id', table: 'messages', columns: ['topic_id', 'id'] },
    { name: 'idx_private_messages_sender_id', table: 'private_messages', columns: ['sender_id'] },
    { name: 'idx_private_messages_receiver_id', table: 'private_messages', columns: ['receiver_id'] },
    { name: 'idx_private_messages_sender_receiver', table: 'private_messages', columns: ['sender_id', 'receiver_id'] },
    { name: 'idx_message_versions_message_id', table: 'message_versions', columns: ['message_id'] },
    { name: 'idx_topics_name', table: 'topics', columns: ['name'] },
    { name: 'idx_topics_created_by', table: 'topics', columns: ['created_by'] },
    { name: 'idx_topic_members_topic_id', table: 'topic_members', columns: ['topic_id'] },
    { name: 'idx_topic_members_user_id', table: 'topic_members', columns: ['user_id'] },
    { name: 'idx_communities_topic_id', table: 'communities', columns: ['topic_id'] },
    { name: 'idx_communities_name', table: 'communities', columns: ['name'] },
    { name: 'idx_community_members_community_id', table: 'community_members', columns: ['community_id'] },
    { name: 'idx_community_members_user_id', table: 'community_members', columns: ['user_id'] },
    { name: 'idx_posts_community_id', table: 'posts', columns: ['community_id'] },
    { name: 'idx_posts_user_id', table: 'posts', columns: ['user_id'] },
    { name: 'idx_posts_subsection_id', table: 'posts', columns: ['subsection_id'] },
    { name: 'idx_posts_created_at', table: 'posts', columns: ['created_at'] },
    { name: 'idx_moments_user_id', table: 'moments', columns: ['user_id'] },
    { name: 'idx_moments_created_at', table: 'moments', columns: ['created_at'] },
    { name: 'idx_follows_follower_id', table: 'follows', columns: ['follower_id'] },
    { name: 'idx_follows_following_id', table: 'follows', columns: ['following_id'] },
    { name: 'idx_friends_user1_id', table: 'friends', columns: ['user1_id'] },
    { name: 'idx_friends_user2_id', table: 'friends', columns: ['user2_id'] },
    { name: 'idx_comments_target', table: 'comments', columns: ['target_type', 'target_id'] },
    { name: 'idx_comments_user_id', table: 'comments', columns: ['user_id'] },
    { name: 'idx_comments_parent_id', table: 'comments', columns: ['parent_id'] },
    { name: 'idx_likes_target', table: 'likes', columns: ['target_type', 'target_id'] },
    { name: 'idx_likes_user_id', table: 'likes', columns: ['user_id'] },
    { name: 'idx_message_mentions_message', table: 'message_mentions', columns: ['message_id'] },
    { name: 'idx_message_mentions_topic_user', table: 'message_mentions', columns: ['topic_id', 'user_id'] },
    { name: 'idx_bot_tokens_bot_id', table: 'bot_tokens', columns: ['bot_id'] },
    { name: 'idx_bot_tokens_token', table: 'bot_tokens', columns: ['token'] },
  ];

  for (const idx of indexDefinitions) {
    try {
      const colClause = idx.columns.join(', ');
      await db.pool.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} (${colClause})`);
    } catch (e) { console.warn(`[db] 索引创建跳过 ${idx.name}:`, (e as Error).message); }
  }

  console.log('✅ 表结构检查完成');
}

export { initializeDatabase };
export default initializeDatabase;
