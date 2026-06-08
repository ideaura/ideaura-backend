import db from '../config/database.ts';
import time from '../utils/time.ts';

interface BlogCategoryRow {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  created_at: string;
  updated_at: string | null;
}

class BlogCategory {
  static async create(userId: number, name: string, description: string | null = null): Promise<{ id: number; name: string }> {
    const currentTime = time.currentDbString();

    const result = await db.run(
      "INSERT INTO blog_categories (name, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [name, description, userId, currentTime, currentTime]
    );

    return { id: result.lastID ?? 0, name };
  }

  static async getAll(userId: number): Promise<BlogCategoryRow[]> {
    const rows = await db.all<BlogCategoryRow>(
      "SELECT * FROM blog_categories WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );
    return rows;
  }

  static async getById(id: number, userId: number): Promise<BlogCategoryRow | undefined> {
    return db.get<BlogCategoryRow>(
      "SELECT * FROM blog_categories WHERE id = ? AND user_id = ?",
      [id, userId]
    );
  }

  static async update(id: number, userId: number, name: string, description: string | null = null): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE blog_categories SET name = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [name, description, time.currentDbString(), id, userId]
    );
    return { changes: result.changes };
  }

  static async delete(id: number, userId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "DELETE FROM blog_categories WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    return { changes: result.changes };
  }
}

export default BlogCategory;
