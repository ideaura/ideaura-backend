# 花枫咖啡馆后端

https://cofe.allons-y.uk

## 功能特性

### 话题系统
- 所有话题默认为私有，必须加入后才能查看和参与
- 支持创建者、管理员和普通成员三种角色
- 提供话题搜索功能，可按名称或ID搜索所有话题
- 提供推荐话题功能，按消息数、近期活跃度和新创建时间分类推荐

### 消息系统
- 支持公共聊天室消息
- 支持话题内消息
- 支持一对一私聊消息
- 实时消息通过MQTT广播

### 权限管理
- 话题创建者拥有最高权限
- 创建者可以设置和取消话题管理员
- 只有创建者和管理员可以修改话题信息
- 用户可以加入和退出话题（创建者不能退出自己创建的话题）

### 安全特性
- 话题消息通过安全的频道广播，只有加入话题的用户才能接收
- 私聊消息通过安全的私聊频道传输
- 用户认证基于JWT令牌

## API端点

### 话题相关
- `POST /api/chat/topics` - 创建话题
- `GET /api/chat/topics` - 获取用户加入的话题列表
- `GET /api/chat/topics/all` - 获取所有用户加入的话题
- `GET /api/chat/topics/search` - 搜索话题
- `GET /api/chat/topics/recommended` - 获取推荐话题
- `POST /api/chat/topics/:topicId/join` - 加入话题
- `POST /api/chat/topics/:topicId/leave` - 退出话题
- `PUT /api/chat/topics/:topicId` - 修改话题信息
- `POST /api/chat/topics/:topicId/admins/:adminId` - 设置话题管理员
- `DELETE /api/chat/topics/:topicId/admins/:adminId` - 取消话题管理员
- `GET /api/chat/topics/:topicId/members` - 获取话题成员列表

### 消息相关
- `POST /api/chat/messages` - 发送公共消息
- `GET /api/chat/messages` - 获取公共消息历史
- `POST /api/chat/topics/:topicId/messages` - 发送话题消息
- `GET /api/chat/topics/:topicId/messages` - 获取话题消息历史
- `POST /api/chat/private-messages` - 发送私聊消息
- `GET /api/chat/private-messages/:userId` - 获取与指定用户的私聊历史
- `GET /api/chat/private-messages/unread` - 获取未读私聊消息
- `GET /api/chat/private-messages/unread/count` - 获取未读私聊消息数量

### 用户相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify-email` - 邮箱验证
- `GET /api/users/profile` - 获取用户信息
- `GET /api/users/search` - 搜索用户
- `GET /api/users/recent` - 获取最近注册用户