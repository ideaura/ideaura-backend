import type { RedisOptions } from 'ioredis';

export interface Config {
  port: number;
  jwtSecret: string;
  timezoneOffset: number;
  database: {
    type: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
  };
  mqtt: {
    broker: string;
    topic: string;
    inboxSecret: string;
    heartbeatTimeout?: number;
    checkInterval?: number;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  ssl: {
    enabled: string;
    keyPath: string;
    certPath: string;
    caPath?: string;
  };
  redis: RedisOptions & {
    keyPrefix: string;
  };
  upload: {
    chatImageExpiryDays: number;
    chatVideoExpiryDays: number;
    chatFileExpiryDays: number;
    chatDownloadSpeedLimitKBps: number;
    videoDownloadSpeedLimitKBps: number;
    maxFileSizeMB: number;
  };
  app: {
    name: string;
    baseUrl: string;
  };
}

const config: Config = {
  port: Number(process.env.PORT) || 3009,
  jwtSecret: process.env.JWT_SECRET || 'XxX',
  timezoneOffset: Number(process.env.TIMEZONE_OFFSET) || 8,
  database: {
    type: 'postgres',
    host: '192.168.124.9',
    port: 1145,
    database: 'xxx',
    user: 'xxx',
    password: 'xxx',
    max: 20
  },
  mqtt: {
    broker: process.env.MQTT_BROKER || 'wss://api-cofe.allons-y.uk:3009',
    topic: 'rockychat/broadcast',
    inboxSecret: 'XxX'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'ybrinpds@icloud.com',
      pass: process.env.SMTP_PASS || 'xxx'
    },
    from: process.env.SMTP_USER || 'ybrinpds@icloud.com'
  },
  ssl: {
    enabled: process.env.SSL_ENABLED || 'true',
    keyPath: process.env.SSL_KEY_PATH || './ssl/api-cofe-allons-y-uk-1102130026_key.key',
    certPath: process.env.SSL_CERT_PATH || './ssl/api-cofe-allons-y-uk-1102130026_chain.pem'
  },
  redis: {
    host: '192.168.124.9',
    port: 1919,
    password: 'xxx',
    db: 0,
    keyPrefix: 'fmc:',
    retryStrategy(times: number): number {
      return Math.min(times * 200, 5000);
    }
  },
  upload: {
    chatImageExpiryDays: 365,
    chatVideoExpiryDays: 60,
    chatFileExpiryDays: 30,
    chatDownloadSpeedLimitKBps: 2048,
    videoDownloadSpeedLimitKBps: 1024,
    maxFileSizeMB: 50
  },
  app: {
    name: '花枫咖啡馆',
    baseUrl: process.env.BASE_URL || 'https://api-cofe.allons-y.uk:3009'
  }
};

export default config;
