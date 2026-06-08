import { Router } from 'express';
import db from '../config/database.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { generateBotToken } from '../utils/tokens.ts';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', authenticateToken, async (req, res) => {
  const { ownerId } = req.body as { ownerId: number };
  const botId = req.user!.id;
  if (!ownerId) return res.status(400).json({ success: false, message: '请指定机器人拥有者ID' });
  if (+botId === +ownerId) return res.status(400).json({ success: false, message: '不能将自己设为拥有者' });
  try {
    const currentUser = await db.get<{ is_bot: boolean }>('SELECT is_bot FROM users WHERE id = ?', [botId]);
    if (currentUser?.is_bot) return res.status(400).json({ success: false, message: '当前账号已经是机器人' });
    const hasBots = await db.get<{ 1?: number }>('SELECT 1 FROM users WHERE bot_owner_id = ?', [botId]);
    if (hasBots) return res.status(400).json({ success: false, message: '当前已是其他机器人的拥有者' });
    const owner = await db.get<{ id: number; is_bot: boolean }>('SELECT id, is_bot FROM users WHERE id = ?', [ownerId]);
    if (!owner) return res.status(404).json({ success: false, message: '拥有者账号不存在' });
    if (owner.is_bot) return res.status(400).json({ success: false, message: '拥有者不能是机器人' });
    await db.run('UPDATE users SET is_bot = true, bot_owner_id = ?, auto_accept_friends = true, allow_topic_invites = true WHERE id = ?', [ownerId, botId]);
    res.json({ success: true, message: '成功转为机器人账号' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const bots = await db.all('SELECT id, username, email, avatar_url, auto_accept_friends, allow_topic_invites, created_at FROM users WHERE bot_owner_id = ?', [req.user!.id]);
    res.json({ success: true, data: bots });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:id/tokens', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    const token = generateBotToken();
    await db.run('INSERT INTO bot_tokens (bot_id, token, name, created_at) VALUES (?, ?, ?, NOW())', [bot.id, token, req.body.name || null]);
    res.json({ success: true, data: { token } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:id/commands', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    const commandId = uuidv4();
    await db.run('INSERT INTO bot_commands (bot_id, command_id, name, description, created_at) VALUES (?, ?, ?, ?, NOW())', [bot.id, commandId, req.body.name, req.body.description || null]);
    res.json({ success: true, data: { command_id: commandId } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    const { auto_accept_friends, allow_topic_invites } = req.body as { auto_accept_friends?: boolean; allow_topic_invites?: boolean };
    const sets: string[] = []; const vals: unknown[] = [];
    if (auto_accept_friends !== undefined) { sets.push('auto_accept_friends = ?'); vals.push(auto_accept_friends ? 1 : 0); }
    if (allow_topic_invites !== undefined) { sets.push('allow_topic_invites = ?'); vals.push(allow_topic_invites ? 1 : 0); }
    if (sets.length) { vals.push(bot.id); await db.run(`UPDATE users SET ${sets.join(',')} WHERE id = ?`, vals); }
    res.json({ success: true, message: '更新成功' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id/revert', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; is_bot: boolean; bot_owner_id: number }>('SELECT id, is_bot, bot_owner_id FROM users WHERE id = ?', [+req.params.id]);
    if (!bot?.is_bot) return res.status(404).json({ success: false, message: '无效的机器人账号' });
    if (req.user!.id !== bot.id && req.user!.id !== bot.bot_owner_id) return res.status(403).json({ success: false, message: '无权操作' });
    await db.run('UPDATE users SET is_bot = false, bot_owner_id = NULL WHERE id = ?', [bot.id]);
    res.json({ success: true, message: '已还原' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id/tokens', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    const tokens = await db.all('SELECT id, name, created_at FROM bot_tokens WHERE bot_id = ?', [bot.id]);
    res.json({ success: true, data: tokens });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:id/tokens/:tokenId', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    await db.run('DELETE FROM bot_tokens WHERE id = ? AND bot_id = ?', [+req.params.tokenId, bot.id]);
    res.json({ success: true, message: '已删除' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id/commands', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ bot_owner_id: number }>('SELECT bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot) return res.status(404).json({ success: false, message: '机器人不存在' });
    const isOwner = bot.bot_owner_id === req.user!.id;
    const sql = isOwner ? 'SELECT id, command_id, name, description, is_hidden, created_at FROM bot_commands WHERE bot_id = ?'
      : 'SELECT id, command_id, name, description, is_hidden, created_at FROM bot_commands WHERE bot_id = ? AND is_hidden = false';
    const commands = await db.all(sql, [+req.params.id]);
    res.json({ success: true, data: commands });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id/commands/:commandId', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    const { name, description, is_hidden } = req.body as { name?: string; description?: string; is_hidden?: boolean };
    const sets: string[] = []; const vals: unknown[] = [];
    if (name) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (is_hidden !== undefined) { sets.push('is_hidden = ?'); vals.push(is_hidden ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ success: false, message: '没有要更新的字段' });
    vals.push(req.params.commandId, bot.id);
    await db.run(`UPDATE bot_commands SET ${sets.join(',')} WHERE command_id = ? AND bot_id = ?`, vals);
    res.json({ success: true, message: '更新成功' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:id/commands/:commandId', authenticateToken, async (req, res) => {
  try {
    const bot = await db.get<{ id: number; bot_owner_id: number }>('SELECT id, bot_owner_id FROM users WHERE id = ? AND is_bot = true', [+req.params.id]);
    if (!bot || bot.bot_owner_id !== req.user!.id) return res.status(403).json({ success: false, message: '无权操作' });
    await db.run('DELETE FROM bot_commands WHERE command_id = ? AND bot_id = ?', [req.params.commandId, bot.id]);
    res.json({ success: true, message: '已删除' });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
