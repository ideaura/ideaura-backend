export default {
  issuer: process.env.OIDC_ISSUER || 'https://api-coin.allons-y.uk',
  authorizationURL: process.env.OIDC_AUTHORIZATION_URL || 'https://api-coin.allons-y.uk/oauth/authorize',
  tokenURL: process.env.OIDC_TOKEN_URL || 'https://api-coin.allons-y.uk/oauth/token',
  userInfoURL: process.env.OIDC_USERINFO_URL || 'https://api-coin.allons-y.uk/userinfo',
  jwksURL: process.env.OIDC_JWKS_URL || 'https://api-coin.allons-y.uk/jwks',
  clientID: process.env.OIDC_CLIENT_ID || 'xxx',
  clientSecret: process.env.OIDC_CLIENT_SECRET || 'xxx',
  redirectURL: process.env.OIDC_REDIRECT_URL || 'https://api-cofe.allons-y.uk:3009/api/auth/oidc/callback',
  scope: process.env.OIDC_SCOPE || 'openid profile email'
} as const;
