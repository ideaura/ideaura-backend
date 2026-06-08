import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/tokens.ts';
import db from '../config/database.ts';
import type { UserPublic, JwtPayload } from '../types/index.ts';

// Express module augmentation
declare global {
  namespace Express {
    interface Request {
      user: UserPublic | null;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: '访问令牌必填' });
    return;
  }

  if (token.startsWith('bot-token-')) {
    try {
      const botTokenRow = await db.get<{ bot_id: number }>('SELECT bot_id FROM bot_tokens WHERE token = ?', [token]);
      if (!botTokenRow) {
        res.status(403).json({ success: false, message: '无效的机器人令牌' });
        return;
      }

      const user = await db.get<UserPublic>('SELECT id, username, email, is_bot, bot_owner_id FROM users WHERE id = ?', [botTokenRow.bot_id]);
      if (!user || !user.is_bot) {
        res.status(403).json({ success: false, message: '该机器人账号状态异常' });
        return;
      }

      req.user = user;
      next();
      return;
    } catch (err) {
      console.error('Bot Token Error:', err);
      res.status(500).json({ success: false, message: '服务器错误' });
      return;
    }
  }

  try {
    const decoded = verifyJWT(token) as JwtPayload;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      email_verified: false,
      registration_order: null,
      avatar_url: null,
      is_bot: false,
      bot_owner_id: null,
      auto_accept_friends: true,
      allow_topic_invites: true,
      created_at: ''
    };
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: '无效的访问令牌' });
  }
}

export async function authenticateOptionalToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    if (token.startsWith('bot-token-')) {
      try {
        const botTokenRow = await db.get<{ bot_id: number }>('SELECT bot_id FROM bot_tokens WHERE token = ?', [token]);
        if (botTokenRow) {
          const user = await db.get<UserPublic>('SELECT id, username, email, is_bot, bot_owner_id FROM users WHERE id = ?', [botTokenRow.bot_id]);
          req.user = (user && user.is_bot) ? user : null;
        } else {
          req.user = null;
        }
      } catch (e) {
        console.debug('[auth] Bot token验证失败, 降级:', (e as Error).message);
        req.user = null;
      }
    } else {
      try {
        const decoded = verifyJWT(token);
        req.user = {
          id: (decoded as JwtPayload).id,
          username: (decoded as JwtPayload).username,
          email: (decoded as JwtPayload).email,
          email_verified: false,
          registration_order: null,
          avatar_url: null,
          is_bot: false,
          bot_owner_id: null,
          auto_accept_friends: true,
          allow_topic_invites: true,
          created_at: ''
        };
      } catch (e) {
        console.debug('[auth] JWT验证失败, 降级:', (e as Error).message);
        req.user = null;
      }
    }
  } else {
    req.user = null;
  }

  next();
}
