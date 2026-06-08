import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { initializeOIDCClient, getAuthorizationUrl, handleCallback } from '../utils/oidcClient.ts';
import oidcConfig from '../config/oidc.ts';
import User from '../models/User.ts';
import oidcSyncService from '../services/oidcSync.ts';
import time from '../utils/time.ts';
import appState from '../utils/AppState.ts';
import { generateToken } from '../utils/tokens.ts';

const router = Router();
initializeOIDCClient().catch(console.error);

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

// OIDC seamless pre-login
router.get('/auth/oidc/pre-login', async (req, res) => {
  try {
    const secureString = generateToken();
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);
    const { url } = await getAuthorizationUrl(state, nonce);
    // Store under both keys: secureString for MQTT/login lookup, state for callback lookup
    const sess = { state, nonce, authString: secureString, isVerified: false, oidcUrl: url, createdAt: Date.now() };
    await appState.setOidc(secureString, sess);
    await appState.setOidc(state, sess);
    res.json({ success: true, data: { secureString, authString: secureString } });
  } catch (e) { console.error('OIDC pre-login error:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/auth/oidc/login', async (req, res) => {
  try {
    const s = req.query.s as string | undefined;
    const isMobile = req.query.mobile === 'true';
    const returnUrl = req.query.returnUrl as string | undefined;

    if (s) {
      // Seamless popup flow — lookup session and redirect to stored OIDC URL
      const session = await appState.getOidc<{ oidcUrl: string }>(s);
      if (!session) return res.status(400).json({ success: false, message: '会话已过期' });
      res.redirect(session.oidcUrl);
      return;
    }
    // Default: generate new OIDC flow
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);
    const { url } = await getAuthorizationUrl(state, nonce);
    await appState.setOidc(state, { nonce, isMobile, returnUrl, createdAt: Date.now() });
    res.redirect(url);
  } catch (e) { console.error('OIDC login error:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/auth/oidc/mobile-login', async (req, res) => {
  try {
    const secureString = generateToken();
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);
    const { url } = await getAuthorizationUrl(state, nonce);
    const mSession = { state, nonce, authString: secureString, isVerified: false, oidcUrl: url, createdAt: Date.now() };
    await appState.setOidc(secureString, mSession);
    await appState.setOidc(state, mSession);
    res.json({ success: true, data: { secureString, url } });
  } catch (e) { console.error('OIDC mobile login error:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/auth/oidc/callback', async (req, res) => {
  try {
    const { code, state, error: oidcError, error_description } = req.query as { code: string; state: string; error?: string; error_description?: string };
    if (oidcError) return res.status(400).json({ success: false, message: 'OIDC认证失败', errorDetails: oidcError + (error_description ? ': ' + error_description : '') });
    if (!code || !state) return res.status(400).json({ success: false, message: '缺少参数' });
    const sessionData = await appState.getOidc<{ nonce: string; authString?: string; isMobile?: boolean; returnUrl?: string }>(state);
    if (!sessionData) return res.status(400).json({ success: false, message: '会话已过期' });
    const result = await handleCallback(code, oidcConfig.redirectURL, state, sessionData.nonce);
    const { userinfo } = result;

    // Find or create user
    let user = await User.findByEmail(userinfo.email);
    if (!user) {
      const newUser = await User.create({
        username: userinfo.preferred_username || userinfo.name || userinfo.sub,
        email: userinfo.email,
        isOidcUser: true,
        avatar_url: userinfo.picture || null
      });
      user = await User.findById(newUser.id);
    } else {
      await oidcSyncService.syncUserWithOidcData({ id: user.id, username: user.username, email: user.email }, userinfo);
    }

    if (!user) return res.status(500).json({ success: false, message: '用户创建失败' });
    const jwt = (await import('../utils/tokens.ts')).generateJWT({ id: user.id, username: user.username, email: user.email });
    // Push token via MQTT to the client (seamless flow)
    if (sessionData.authString) {
      const { broadcastToOidcSession } = await import('../services/mqtt.ts');
      broadcastToOidcSession(sessionData.authString, { success: true, token: jwt, user });
    }

    await appState.deleteOidc(state);

    // Mobile flow: redirect to custom scheme
    if (sessionData.isMobile) {
      const targetUrl = sessionData.returnUrl || `ideaura://token=${jwt}`;
      res.redirect(targetUrl);
      return;
    }

    res.json({ success: true, message: 'OIDC登录成功' });
  } catch (e) { console.error('OIDC callback error:', e); res.status(500).json({ success: false, message: '认证失败' }); }
});

router.get('/auth/oidc/userinfo', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified,
        avatarUrl: user.avatar_url,
        isBot: user.is_bot
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
