const mqtt = require('mqtt');
const config = require('../config');

let mqttClient = null;

function initMQTT() {
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(config.mqtt.broker);
    
    mqttClient.on('connect', () => {
      console.log('MQTT Broker连接成功');
      
      mqttClient.subscribe(config.mqtt.topic, (err) => {
        if (err) {
          console.error('MQTT订阅失败:', err);
          reject(err);
        } else {
          console.log('已订阅广播主题');
          global.mqttClient = mqttClient;
          resolve();
        }
      });
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

module.exports = { 
  initMQTT, 
  broadcastMessage,
  getMQTTClient: () => mqttClient
};