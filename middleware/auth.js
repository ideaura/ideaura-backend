const { verifyJWT } = require('../utils/tokens');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '访问令牌必填' });
  }

  try {
    const user = verifyJWT(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: '无效的访问令牌' });
  }
}

module.exports = { authenticateToken };