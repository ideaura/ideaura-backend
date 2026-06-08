import oidcConfig from '../config/oidc.ts';

let oidcClientInstance: import('openid-client').Client | null = null;

async function loadOpenIdClient() {
  const { Issuer, generators } = await import('openid-client');
  return { Issuer, generators };
}

export async function initializeOIDCClient() {
  try {
    const { Issuer } = await loadOpenIdClient();

    const issuer = await Issuer.discover(`${oidcConfig.issuer}/.well-known/openid-configuration`);

    oidcClientInstance = new issuer.Client({
      client_id: oidcConfig.clientID,
      client_secret: oidcConfig.clientSecret,
      redirect_uris: [oidcConfig.redirectURL],
      response_types: ['code'],
    });

    const { custom } = await import('openid-client');

    oidcClientInstance[custom.http_options] = () => ({
      timeout: 15000,
      headers: {
        'User-Agent': 'FlowerMapleChat-Backend/1.0',
        'Accept': 'application/json'
      }
    });

    oidcClientInstance[custom.clock_tolerance] = 30;

    console.log('✅ OIDC客户端初始化成功');
    return oidcClientInstance;
  } catch (error) {
    console.error('❌ OIDC客户端初始化失败:', (error as Error).message);
    console.error('💡 检查 OIDC 服务器是否运行:', `${oidcConfig.issuer}/.well-known/openid-configuration`);
    throw error;
  }
}

export function getOIDCClient() {
  if (!oidcClientInstance) {
    throw new Error('OIDC客户端尚未初始化，请先调用initializeOIDCClient()');
  }
  return oidcClientInstance;
}

// 生成授权URL
export async function getAuthorizationUrl(state: string | null = null, nonce: string | null = null) {
  const { generators } = await loadOpenIdClient();
  const client = getOIDCClient();

  if (!state) {
    state = generators.state();
  }

  if (!nonce) {
    nonce = generators.nonce();
  }

  const url = client.authorizationUrl({
    redirect_uri: oidcConfig.redirectURL,
    scope: oidcConfig.scope,
    state,
    nonce,
  });

  return { url, state, nonce };
}

// 处理授权回调并获取用户信息
export async function handleCallback(
  code: string,
  redirectUri: string,
  expectedState: string,
  expectedNonce: string
) {
  const client = getOIDCClient();

  try {
    const tokenSet = await client.callback(
      redirectUri,
      { code, state: expectedState },
      { state: expectedState, nonce: expectedNonce }
    );

    const userinfo = await client.userinfo(tokenSet.access_token!);

    return {
      tokenSet,
      userinfo,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt: tokenSet.expires_at,
    };
  } catch (error) {
    console.error('处理OIDC回调失败:', error);

    if ((error as Error).message.includes('validate JWT signature')) {
      console.log('JWT签名验证失败，尝试使用访问令牌直接获取用户信息');

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);

      const credentials = btoa(`${oidcConfig.clientID}:${oidcConfig.clientSecret}`);

      const tokenResponse = await fetch(oidcConfig.tokenURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: params
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
      }

      const tokenData = await tokenResponse.json();

      const userinfoResponse = await fetch(oidcConfig.userInfoURL, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!userinfoResponse.ok) {
        throw new Error(`Userinfo request failed: ${userinfoResponse.status} ${await userinfoResponse.text()}`);
      }

      const userinfo = await userinfoResponse.json();

      return {
        tokenSet: tokenData,
        userinfo,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
        expiresAt: tokenData.expires_at,
      };
    }

    throw error;
  }
}

// 刷新访问令牌
export async function refreshAccessToken(refreshToken: string) {
  const client = getOIDCClient();

  try {
    const tokenSet = await client.refresh(refreshToken);
    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt: tokenSet.expires_at,
    };
  } catch (error) {
    console.error('刷新令牌失败:', error);
    throw error;
  }
}

// 撤销令牌
export async function revokeToken(token: string) {
  const client = getOIDCClient();
  try {
    await client.revoke(token);
    console.log('令牌撤销成功');
  } catch (error) {
    console.error('撤销令牌失败:', error);
  }
}
