import nodemailer from 'nodemailer';

const config = await import('../config/index.ts');
const cfg = config.default;

const transporter = nodemailer.createTransport(cfg.email);

export function sendVerificationEmail(email: string, username: string, verificationToken: string): Promise<unknown> {
  const verificationLink = `${cfg.app.baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: cfg.email.auth.user,
    to: email,
    subject: `验证您的邮箱 - ${cfg.app.name}`,
    html: `
      <h2>欢迎加入${cfg.app.name}</h2>
      <p>请点击以下链接验证您的邮箱地址：</p>
      <a href="${verificationLink}">${verificationLink}</a>
      <p>如果您没有注册${cfg.app.name}，请忽略此邮件。</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

export function sendPasswordResetEmail(email: string, resetToken: string): Promise<unknown> {
  const resetLink = `${cfg.app.baseUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: cfg.email.auth.user,
    to: email,
    subject: `重置密码 - ${cfg.app.name}`,
    html: `
      <h2>密码重置请求</h2>
      <p>请点击以下链接重置您的密码：</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>如果您没有请求重置密码，请忽略此邮件。</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

export { transporter };
