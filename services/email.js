const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport(config.email);

function sendVerificationEmail(email, username, verificationToken) {
  const verificationLink = `${config.app.baseUrl}/api/auth/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: config.email.auth.user,
    to: email,
    subject: `验证您的邮箱 - ${config.app.name}`,
    html: `
      <h2>欢迎加入${config.app.name}</h2>
      <p>请点击以下链接验证您的邮箱地址：</p>
      <a href="${verificationLink}">${verificationLink}</a>
      <p>如果您没有注册${config.app.name}，请忽略此邮件。</p>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

function sendPasswordResetEmail(email, resetToken) {
  const resetLink = `${config.app.baseUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: config.email.auth.user,
    to: email,
    subject: `重置密码 - ${config.app.name}`,
    html: `
      <h2>密码重置请求</h2>
      <p>请点击以下链接重置您的密码：</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>如果您没有请求重置密码，请忽略此邮件。</p>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  transporter
};