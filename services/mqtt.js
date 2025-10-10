const mqtt = require('mqtt');
const config = require('../config');
const crypto = require('crypto');

let mqttClient = null;

// 生成安全的私聊主题
function generatePrivateTopic(userId1, userId2) {
  // 对用户ID进行排序以确保一致性
  const sortedIds = [userId1, userId2].sort();
  // 使用HMAC生成安全的主题名称
  const hash = crypto
    .createHmac('sha256', config.jwtSecret || 'default-secret')
    .update(`${sortedIds[0]}-${sortedIds[1]}`)
    .digest('hex');
  
  return `${config.mqtt.topic}/private/${hash}`;
}

function initMQTT() {
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(config.mqtt.broker);
    
    mqttClient.on('connect', () => {
      console.log('MQTT Broker连接成功');
      
      // 订阅公共广播主题
      mqttClient.subscribe(config.mqtt.topic, (err) => {
        if (err) {
          console.error('MQTT订阅失败:', err);
          reject(err);
        } else {
          console.log('已订阅广播主题');
        }
      });
      
      global.mqttClient = mqttClient;
      resolve();
    });
    
    mqttClient.on('error', (err) => {
      console.error('MQTT连接错误:', err);
      reject(err);
    });
    
    mqttClient.on('message', (topic, message) => {
      if (topic === config.mqtt.topic) {
        handleBroadcastMessage(message);
      }
    });
  });
}

function handleBroadcastMessage(message) {
  try {
    const messageData = JSON.parse(message.toString());
    console.log('收到广播消息:', {
      id: messageData.id,
      sender: messageData.senderName,
      content: messageData.content
    });
  } catch (error) {
    console.error('处理广播消息错误:', error);
  }
}

function broadcastMessage(messageData) {
  if (mqttClient && mqttClient.connected) {
    // 如果是私聊消息，发送到安全的私聊主题
    if (messageData.messageType === 'private') {
      // 为发送者和接收者生成安全的私聊主题
      const privateTopic = generatePrivateTopic(
        messageData.sender_id, 
        messageData.receiver_id
      );
      
      // 发布到安全的私聊主题
      mqttClient.publish(
        privateTopic, 
        JSON.stringify(messageData), 
        { qos: 1 },
        (err) => {
          if (err) {
            console.error('广播私聊消息失败:', err);
          } else {
            console.log('私聊消息已广播:', messageData.id);
          }
        }
      );
    } else {
      // 公共消息广播到公共主题
      mqttClient.publish(
        config.mqtt.topic, 
        JSON.stringify(messageData), 
        { qos: 1 },
        (err) => {
          if (err) {
            console.error('广播消息失败:', err);
          } else {
            console.log('消息已广播:', messageData.id);
          }
        }
      );
    }
  }
}

module.exports = { 
  initMQTT, 
  broadcastMessage,
  generatePrivateTopic, // 导出以便其他模块使用
  getMQTTClient: () => mqttClient
};