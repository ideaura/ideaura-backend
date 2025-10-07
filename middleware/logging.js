// 初始化连接客户端集合
if (!global.connectedClients) {
  global.connectedClients = new Set();
}

function loggingMiddleware(req, res, next) {
  const clientId = req.headers['x-client-id'] || req.ip || 'unknown';
  global.connectedClients.add(clientId);
  console.log(`客户端连接: ${clientId}, 总连接数: ${global.connectedClients.size}`);
  
  res.on('finish', () => {
    // 保持连接计数，不自动移除
  });
  
  next();
}

module.exports = loggingMiddleware;