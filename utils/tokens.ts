import type { JwtPayload } from '../types/index.ts';

// Bun 原生支持 node:crypto，直接用
const jwt = await import('jsonwebtoken');
const { sign, verify } = jwt.default;

const config = await import('../config/index.ts');
const jwtSecret: string = config.default.jwtSecret;

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateJWT(payload: JwtPayload): string {
  return sign(payload, jwtSecret, { expiresIn: '90d' });
}

export function verifyJWT(token: string): JwtPayload {
  return verify(token, jwtSecret) as JwtPayload;
}

export function generateBotToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let result = 'bot-token-';
  for (let i = 0; i < 32; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
