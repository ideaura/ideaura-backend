// 初始化连接客户端集合
const appState = require('../utils/AppState');


function loggingMiddleware(req, res, next) {
  const clientId = req.headers['x-client-id'] || req.ip || 'unknown';
  appState.addClient(clientId);
  console.log(`客户端连接: ${clientId}, 总连接数: ${appState.getOnlineCount()}`);

  res.on('finish', () => {
    // 保持连接计数，不自动移除
  });

  next();
}

module.exports = loggingMiddleware;