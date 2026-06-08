import db from '../config/database.ts';
import type { UserRow, UserPublic, DbRow } from '../types/index.ts';
import { generateToken } from '../utils/tokens.ts';
import time from '../utils/time.ts';

class User {
  static async create(userData: {
    id?: number;
    username: string;
    email: string;
    password?: string;
    isOidcUser?: boolean;
    avatar_url?: string | null;
  }): Promise<{
    id: number;
    username: string;
    email: string;
    verificationToken: string;
    registrationOrder: number;
    avatar_url: string | null;
    createdAt: string;
  }> {
    const { id, username, email, password, isOidcUser = false, avatar_url = null } = userData;
    const verificationToken = generateToken();

    const countRow = await db.get<{ total: string }>(
      "SELECT COUNT(*) as total FROM users"
    );
    const registrationOrder = parseInt(countRow?.total ?? '0') + 1;

    const hashedPassword = password
      ? await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })
      : '';

    const currentTime = time.currentDbString();

    let query: string;
    let params: unknown[];

    if (id) {
      query = "INSERT INTO users (id, username, email, password, email_verified, verification_token, registration_order, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
      params = [id, username, email, hashedPassword, isOidcUser ? true : false, verificationToken, registrationOrder, avatar_url, currentTime];
    } else {
      query = "INSERT INTO users (username, email, password, email_verified, verification_token, registration_order, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
      params = [username, email, hashedPassword, isOidcUser ? true : false, verificationToken, registrationOrder, avatar_url, currentTime];
    }

    const result = await db.run(query, params);

    return {
      id: id ?? result.lastID ?? 0,
      username,
      email,
      verificationToken,
      registrationOrder,
      avatar_url,
      createdAt: currentTime
    };
  }

  static async findByUsername(username: string): Promise<UserPublic | undefined> {
    const row = await db.get<UserRow>(
      "SELECT id, username, email, password, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE username = ?",
      [username]
    );
    if (!row) return undefined;
    return mapRowToPublic(row);
  }

  static async updateUsername(userId: number, newUsername: string): Promise<{ changes: number }> {
    const currentTime = time.currentDbString();
    const result = await db.run(
      "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
      [newUsername, currentTime, userId]
    );
    return { changes: result.changes };
  }

  static async checkUsernameExists(username: string): Promise<boolean> {
    const row = await db.get<{ 1?: number }>(
      "SELECT 1 FROM users WHERE username = ?",
      [username]
    );
    return !!row;
  }

  static async findByEmailWithPassword(email: string): Promise<UserRow | undefined> {
    return db.get<UserRow>("SELECT id, username, email, password, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE email = ?", [email]);
  }

  /** 返回完整行含 password，仅用于认证 */
  static async findByEmailWithPassword(email: string): Promise<UserRow | undefined> {
    return db.get<UserRow>("SELECT id, username, email, password, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE email = ?", [email]);
  }

  static async findByEmail(email: string): Promise<UserPublic | undefined> {
    const row = await db.get<UserRow>(
      "SELECT id, username, email, password, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE email = ?",
      [email]
    );
    if (!row) return undefined;
    return mapRowToPublic(row);
  }

  static async findById(id: number): Promise<UserPublic | undefined> {
    const row = await db.get<UserRow>(
      "SELECT id, username, email, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE id = ?",
      [id]
    );
    if (!row) return undefined;
    return mapRowToPublic(row);
  }

  static async verifyEmail(token: string): Promise<{ id: number; email: string } | null> {
    const row = await db.get<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE verification_token = ?",
      [token]
    );
    if (!row) return null;

    await db.run(
      "UPDATE users SET email_verified = true, verification_token = NULL WHERE id = ?",
      [row.id]
    );
    return row;
  }

  static async updateVerificationToken(userId: number, token: string): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE users SET verification_token = ? WHERE id = ?",
      [token, userId]
    );
    return { changes: result.changes };
  }

  static async createPasswordResetToken(email: string): Promise<string | null> {
    const resetToken = generateToken();

    const result = await db.run(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?",
      [resetToken, time.currentDbString(time.nowMs() + 3600 * 1000), email]
    );
    if (result.changes === 0) return null;
    return resetToken;
  }

  static async validatePasswordResetToken(token: string): Promise<{ id: number; email: string } | undefined> {
    const row = await db.get<{ id: number; email: string; reset_token_expires: string }>(
      "SELECT id, email, reset_token_expires FROM users WHERE reset_token = ?",
      [token]
    );
    if (!row) return undefined;

    const expiry = time.parseDatabaseTime(row.reset_token_expires);
    if (expiry && expiry.getTime() < time.nowMs()) return undefined;

    return { id: row.id, email: row.email };
  }

  static async resetPassword(userId: number, newPassword: string): Promise<{ changes: number }> {
    const hashedPassword = await Bun.password.hash(newPassword, { algorithm: 'bcrypt', cost: 10 });
    const result = await db.run(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [hashedPassword, userId]
    );
    return { changes: result.changes };
  }

  static async cleanExpiredResetTokens(): Promise<void> {
    await db.run(
      "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE reset_token_expires < ?",
      [time.currentDbString()]
    );
  }

  static async verifyPassword(userId: number, password: string): Promise<boolean> {
    const row = await db.get<{ password: string }>(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );
    if (!row) return false;
    return Bun.password.verify(password, row.password);
  }

  static async update(id: number, fields: Partial<Pick<UserRow, 'username' | 'email' | 'avatar_url' | 'is_bot' | 'bot_owner_id' | 'auto_accept_friends' | 'allow_topic_invites'>>): Promise<void> {
    const setStatements: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setStatements.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setStatements.length === 0) return;

    setStatements.push("updated_at = ?");
    values.push(time.currentDbString());
    values.push(id);

    await db.run(
      `UPDATE users SET ${setStatements.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async countByEmail(email: string): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE email = ?",
      [email]
    );
    return parseInt(row?.count ?? '0');
  }

  static async countAll(): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM users"
    );
    return parseInt(row?.count ?? '0');
  }

  static async searchUsers(query: string, limit: number = 20): Promise<UserPublic[]> {
    const rows = await db.all<UserRow>(
      "SELECT id, username, email, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users WHERE username LIKE ? LIMIT ?",
      [`%${query}%`, limit]
    );
    return rows.map(mapRowToPublic);
  }

  static async findAll(page: number = 1, limit: number = 20): Promise<{ users: UserPublic[]; total: number }> {
    const offset = (page - 1) * limit;
    const countRow = await db.get<{ count: string }>("SELECT COUNT(*) as count FROM users");
    const total = parseInt(countRow?.count ?? '0');

    const rows = await db.all<UserRow>(
      "SELECT id, username, email, email_verified, avatar_url, is_bot, bot_owner_id, auto_accept_friends, allow_topic_invites, created_at, registration_order FROM users ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );

    return { users: rows.map(mapRowToPublic), total };
  }

  static async getTotalUsers(): Promise<{ total: number }> {
    const row = await db.get<{ count: string }>("SELECT COUNT(*) as count FROM users");
    return { total: row ? parseInt(row.count) : 0 };
  }
}

function mapRowToPublic(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    email_verified: row.email_verified,
    registration_order: row.registration_order,
    avatar_url: row.avatar_url,
    is_bot: row.is_bot,
    bot_owner_id: row.bot_owner_id,
    auto_accept_friends: row.auto_accept_friends,
    allow_topic_invites: row.allow_topic_invites,
    created_at: time.formatLocalTime(row.created_at)
  };
}

export default User;
