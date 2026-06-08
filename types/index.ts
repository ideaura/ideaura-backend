// ─── 用户 ───
export interface UserRow {
  id: number;
  username: string;
  email: string;
  password: string;
  email_verified: boolean;
  verification_token: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  registration_order: number | null;
  avatar_url: string | null;
  is_bot: boolean;
  bot_owner_id: number | null;
  auto_accept_friends: boolean;
  allow_topic_invites: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  registration_order: number | null;
  avatar_url: string | null;
  is_bot: boolean;
  bot_owner_id: number | null;
  auto_accept_friends: boolean;
  allow_topic_invites: boolean;
  created_at: string;
}

// ─── 消息 ───
export type MessageType = 'normal' | 'system' | 'command';
export type MessageSubtype = 'text' | 'image' | 'video' | 'file' | 'markdown' | 'html';
export type MessageSourceType = 'chatroom' | 'private';

export interface MessageRow {
  id: number;
  topic_id: number | null;
  user_id: number;
  content: string | null;
  message_type: MessageType;
  message_subtype: MessageSubtype;
  source_type: MessageSourceType;
  forward_source_id: number | null;
  quoted_message_id: number | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  command_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PrivateMessageRow {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string | null;
  is_read: boolean;
  message_type: MessageType;
  message_subtype: MessageSubtype;
  source_type: MessageSourceType;
  forward_source_id: number | null;
  quoted_message_id: number | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  command_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

// ─── 话题 ───
export interface TopicRow {
  id: number;
  name: string;
  description: string | null;
  announcement: string | null;
  created_by: number;
  is_private: boolean;
  is_active: boolean;
  message_count: number;
  last_activity: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TopicMemberRow {
  id: number;
  topic_id: number;
  user_id: number;
  role: string;
  joined_at: string;
}

// ─── 好友 ───
export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface FriendRow {
  id: number;
  user_id: number;
  friend_id: number;
  status: FriendStatus;
  created_at: string;
  updated_at: string | null;
}

// ─── 评论 ───
export interface CommentRow {
  id: number;
  content: string;
  user_id: number;
  target_type: string;
  target_id: number;
  parent_id: number | null;
  created_at: string;
  updated_at: string | null;
}

// ─── 点赞 ───
export interface LikeRow {
  id: number;
  user_id: number;
  target_type: string;
  target_id: number;
  created_at: string;
}

// ─── 关注 ───
export interface FollowRow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: string;
}

// ─── 动态 ───
export interface MomentRow {
  id: number;
  user_id: number;
  content: string;
  images: string | null;
  video: string | null;
  location: string | null;
  visibility: string;
  created_at: string;
  updated_at: string | null;
}

// ─── 社区 ───
export interface CommunityRow {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  created_by: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

// ─── 帖子 ───
export type PostContentType = 'text' | 'markdown' | 'html';

export interface PostRow {
  id: number;
  title: string;
  content: string;
  content_type: PostContentType;
  user_id: number;
  community_id: number | null;
  subsection_id: number | null;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  created_at: string;
  updated_at: string | null;
}

// ─── 博客分类 ───
export interface BlogCategoryRow {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

// ─── 文件记录 ───
export interface FileRecordRow {
  id: number;
  file_path: string;
  file_size: number;
  mime_type: string;
  original_name: string;
  md5: string;
  uploader_id: number | null;
  expires_at: string | null;
  created_at: string;
}

// ─── API 响应 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

// ─── JWT Payload ───
export interface JwtPayload {
  id: number;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── 数据库操作结果 ───
export interface DbRunResult {
  lastID: number | null;
  changes: number;
}

// ─── 分页参数 ───
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
