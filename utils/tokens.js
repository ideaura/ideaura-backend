const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateJWT(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

function verifyJWT(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  generateToken,
  generateJWT,
  verifyJWT
};