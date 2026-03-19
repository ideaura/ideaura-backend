# 花枫咖啡馆 API 文档

## 基础信息

- **基础URL**: `https://api-cofe.allons-y.uk:3009`
- **WebSocket地址**: `wss://api-cofe.allons-y.uk:3009/mqtt`

## 认证相关

### 用户注册
**POST** `/api/auth/register`

用户注册接口，用于创建新账户。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| username | string | 是 | 用户显示名称（可包含任意字符） |
| email | string | 是 | 用户邮箱地址 |
| password | string | 是 | 用户密码（最少8个字符） |

#### 请求示例
```json
{
  "username": "张三",
  "email": "zhangsan@example.com",
  "password": "password123"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "注册成功，请查收验证邮件"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "用户名、邮箱和密码为必填项"
}
```

---

### 用户登录
**POST** `/api/auth/login`

用户登录接口，用于获取访问令牌。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| email | string | 是 | 用户邮箱 |
| password | string | 是 | 密码 |

#### 请求示例
```json
{
  "email": "zhangsan@example.com",
  "password": "password123"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "username": "张三",
      "email": "zhangsan@example.com"
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "邮箱或密码错误"
}
```

---

### 邮箱验证
**GET** `/api/auth/verify-email`

邮箱验证接口，用于激活账户。

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| token | string | 是 | 验证令牌 |

#### 响应
返回HTML页面，显示验证结果。

---

### 重新发送验证邮件
**POST** `/api/auth/resend-verification`

重新发送邮箱验证邮件。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| email | string | 是 | 用户邮箱地址 |

#### 请求示例
```json
{
  "email": "zhangsan@example.com"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "验证邮件已发送"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "邮箱未注册"
}
```

---

### 忘记密码（通过邮箱）
**POST** `/api/auth/forgot-password/email`

通过邮箱地址发送密码重置链接。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| email | string | 是 | 用户邮箱地址 |

#### 请求示例
```json
{
  "email": "zhangsan@example.com"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "如果该邮箱已注册，重置密码的链接已发送到您的邮箱"
}
```

---

### 忘记密码（通过用户名）
**POST** `/api/auth/forgot-password/username`

通过用户名发送密码重置链接到注册邮箱。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| username | string | 是 | 用户名 |

#### 请求示例
```json
{
  "username": "张三"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "如果该用户名已注册，重置密码的链接已发送到注册邮箱"
}
```

---

### 验证重置密码令牌
**GET** `/api/auth/reset-password/validate`

验证重置密码的令牌是否有效。

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| token | string | 是 | 重置密码令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "重置链接有效",
  "data": {
    "username": "张三"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "重置链接已过期或无效"
}
```

---

### 重置密码
**POST** `/api/auth/reset-password`

使用令牌重置用户密码。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| token | string | 是 | 重置密码令牌 |
| password | string | 是 | 新密码 |

#### 请求示例
```json
{
  "token": "reset-token-12345",
  "password": "newpassword123"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "密码重置成功，您现在可以使用新密码登录"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "重置链接已过期或无效"
}
```

---

### 用户登录
**POST** `/api/auth/login`

用户登录接口，传统邮箱/密码登录。

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| email | string | 否 | 用户邮箱（传统登录时必填） |
| password | string | 否 | 密码（传统登录时必填） |


#### 请求示例（传统登录）
```json
{
  "email": "zhangsan@example.com",
  "password": "password123"
}
```



#### 成功响应示例（传统登录）
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "username": "张三",
      "email": "zhangsan@example.com"
    }
  }
}
```


```

#### 失败响应示例
```json
{
  "success": false,
  "message": "邮箱或密码错误"
}
```

---

### OIDC登录入口点
**GET** `/api/auth/oidc/login`

OIDC登录入口点，用于获取跳转链接。

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| returnUrl | string | 否 | 登录后的跳转URL |
| s | string | 否 | MQTT SecureString (用于无缝登录) |

#### 响应
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://oidc-provider.com/auth...",
    "state": "..."
  }
}
```

---

### OIDC登录回调
**GET** `/api/auth/oidc/callback`

处理来自OIDC提供者的登录回调。

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| code | string | 是 | 授权码 |
| state | string | 是 | 状态参数 |
| error | string | 否 | 错误代码 |
| error_description | string | 否 | 错误描述 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "OIDC登录成功",
  "data": {
    "token": "eyJhbGci...",
    "user": { ... },
    "oidcInfo": { ... }
  }
}
```
*注：如果是MQTT无缝登录流程，此接口会返回HTML页面并关闭窗口，Token通过MQTT发送。*

#### 失败响应示例
```json
{
  "success": false,
  "message": "OIDC认证失败: access_denied"
}
```

---

### OIDC用户信息
**GET** `/api/auth/oidc/userinfo`

获取经过OIDC认证的用户信息。这是 `/api/users/me` 的别名/变体。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "username": "张三",
      "email": "zhangsan@example.com",
      "emailVerified": true,
      "createdAt": "..."
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "无效的访问令牌"
}
```

---

## 用户资料

### 获取当前用户信息
**GET** `/api/users/me`

获取当前登录用户的详细信息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "uid": 123,
    "username": "张三",
    "email": "zhangsan@example.com",
    "emailVerified": true,
    "registrationOrder": 456,
    "registrationDate": "2023-05-15 10:30:00",
    "joinDuration": "2个月"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "访问令牌必填"
}
```

---

### 更新用户名
**PUT** `/api/users/username`

更新用户显示名称。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| newUsername | string | 是 | 新的显示名称 |

#### 请求示例
```json
{
  "newUsername": "李四"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "用户名更新成功",
  "data": {
    "newUsername": "李四"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "用户名不能为空"
}
```

---

### 获取用户统计信息
**GET** `/api/users/stats`

获取系统用户统计信息，包括总用户数和最近注册的用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "recentRegistrations": [
      {
        "username": "新用户1",
        "registrationDate": "2023-05-20 14:40:00",
        "registrationOrder": 1250
      },
      {
        "username": "新用户2",
        "registrationDate": "2023-05-20 14:35:00",
        "registrationOrder": 1249
      },
      {
        "username": "新用户3",
        "registrationDate": "2023-05-20 14:30:00",
        "registrationOrder": 1248
      },
      {
        "username": "新用户4",
        "registrationDate": "2023-05-20 14:25:00",
        "registrationOrder": 1247
      },
      {
        "username": "新用户5",
        "registrationDate": "2023-05-20 14:20:00",
        "registrationOrder": 1246
      }
    ]
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取用户公开信息
**GET** `/api/users/{id}/public`

根据用户ID获取其公开信息。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "uid": 123,
    "username": "张三",
    "registrationOrder": 456,
    "registrationDate": "2023-05-15 10:30:00",
    "joinDuration": "2个月",
    "isEmailVerified": true
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "用户不存在"
}
```

---

### 搜索用户
**GET** `/api/users/search`

根据用户名搜索用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| username | string | 是 | 搜索关键词 |
| limit | number | 否 | 最大返回结果数，默认10 |

#### 请求示例
```
GET /api/users/search?username=张&limit=5
```

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "uid": 123,
      "username": "张三",
      "registrationOrder": 456,
      "registrationDate": "2023-05-15 10:30:00"
    },
    {
      "uid": 124,
      "username": "张四",
      "registrationOrder": 457,
      "registrationDate": "2023-05-16 11:45:00"
    }
  ]
}
```

## 好友功能 API

### 1. 发送好友请求

**POST** `/friends/request`

发送好友请求给其他用户。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 请求体
```json
{
  "userId": 2
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "pending"
  },
  "message": "好友请求已发送"
}
```

### 2. 接受好友请求

**POST** `/friends/request/:requestId/accept`

接受指定的好友请求。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 路径参数
- `requestId` - 好友请求ID

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "accepted"
  },
  "message": "好友请求已接受"
}
```

### 3. 拒绝好友请求

**DELETE** `/friends/request/:requestId`

拒绝指定的好友请求。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 路径参数
- `requestId` - 好友请求ID

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "deleted": true
  },
  "message": "好友请求已拒绝"
}
```

### 4. 获取收到的好友请求

**GET** `/friends/requests/received`

获取当前用户收到的好友请求列表。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 响应
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "requesterId": 2,
      "requesterName": "user2",
      "requesterRegistrationOrder": 2,
      "status": "pending",
      "createdAt": "2023-01-01 12:00:00",
      "updatedAt": "2023-01-01 12:00:00"
    }
  ],
  "total": 1
}
```

### 5. 获取发送的好友请求

**GET** `/friends/requests/sent`

获取当前用户发送的好友请求列表。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 响应
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "receiverId": 3,
      "receiverName": "user3",
      "receiverRegistrationOrder": 3,
      "status": "pending",
      "createdAt": "2023-01-01 12:00:00",
      "updatedAt": "2023-01-01 12:00:00"
    }
  ],
  "total": 1
}
```

### 6. 获取好友列表

**GET** `/friends`

获取当前用户的好友列表。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 响应
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "friendId": 2,
      "friendName": "user2",
      "friendRegistrationOrder": 2,
      "status": "accepted",
      "createdAt": "2023-01-01 12:00:00",
      "updatedAt": "2023-01-01 12:00:00"
    }
  ],
  "total": 1
}
```

### 7. 删除好友

**DELETE** `/friends/:friendId`

删除指定的好友。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 路径参数
- `friendId` - 好友用户ID

#### 响应
```json
{
  "success": true,
  "data": {
    "changes": 1
  },
  "message": "好友已删除"
}
```

### 8. 检查是否为好友

**GET** `/friends/check/:userId`

检查与指定用户是否为好友。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 路径参数
- `userId` - 用户ID

#### 响应
```json
{
  "success": true,
  "data": {
    "areFriends": true
  }
}
```

### 9. 获取好友总数

**GET** `/friends/count`

获取当前用户的好友总数。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 响应
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

### 10. 获取待处理好友请求数

**GET** `/friends/requests/pending/count`

获取当前用户收到的待处理好友请求数。

#### 请求头
- `Authorization: Bearer <token>` - 认证令牌

#### 响应
```json
{
  "success": true,
  "data": {
    "count": 2
  }
}
```

### 私聊消息限制

从好友功能实施后，用户只能向其好友发送私聊消息。如果尝试向非好友发送私聊消息，将收到以下错误响应：

```json
{
  "success": false,
  "message": "您必须先添加对方为好友才能发送私聊消息"
}
```

## 话题相关

### 创建话题
**POST** `/api/chat/topics`

创建新的聊天话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求示例
```json
{
  "name": "技术讨论",
  "description": "讨论各种技术问题"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题创建成功",
  "data": {
    "topicId": 789
  }
}
```

---

### 获取用户加入的话题
**GET** `/api/chat/topics`

获取当前用户加入的所有话题，包含每个话题的最新消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |

#### 响应字段说明
除了话题的基本信息外，还包含以下字段：
- `latestMessage`: 对象，包含该话题的最新消息信息
  - `content`: string，最新消息内容，格式为"发送者用户名：消息内容"
  - `createdAt`: string，消息创建时间

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "avatar_url": "/uploads/avatars/d41d8cd98f00b204e9800998ecf8427e.jpg",
      "created_by": 123,
      "creatorName": "张三",
      "creatorAvatar": "https://example.com/user_avatar.jpg",
      "is_private": 1,
      "is_active": 1,
      "message_count": 25,
      "last_activity": "2023-05-20 14:30:00",
      "created_at": "2023-05-15 10:30:00",
      "linked_community_id": 456,
      "latestMessage": {
        "content": "张三：这个技术问题很有意思！",
        "createdAt": "2023-05-20 14:30:00"
      }
    }
  ],
  "total": 1
}
```

---

### 获取所有话题
**GET** `/api/chat/topics/all`

获取用户加入的所有话题列表，包含每个话题的最新消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 25,
      "last_activity": "2023-05-20 14:30:00",
      "created_at": "2023-05-15 10:30:00",
      "linked_community_id": 456,
      "latestMessage": {
        "content": "张三：这个技术问题很有意思！",
        "createdAt": "2023-05-20 14:30:00"
      }
    }
  ],
  "total": 1
}
```

---

### 搜索话题
**GET** `/api/chat/topics/search`

根据名称或ID搜索话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |
| limit | number | 否 | 最大返回结果数，默认50 |

#### 请求示例
```
GET /api/chat/topics/search?query=技术&limit=10
```

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 25,
      "last_activity": "2023-05-20 14:30:00",
      "created_at": "2023-05-15 10:30:00",
      "linked_community_id": 456,
      "is_member": true
    }
  ]
}
```

---

### 获取推荐话题
**GET** `/api/chat/topics/recommended`

获取推荐话题，包括热门话题、近期活跃话题和新创建话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 每类话题的最大返回结果数，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "popular": [
      {
        "id": 789,
        "name": "技术讨论",
        "description": "讨论各种技术问题",
        "created_by": 123,
        "creatorName": "张三",
        "is_private": 1,
        "is_active": 1,
        "message_count": 100,
        "last_activity": "2023-05-20 14:30:00",
        "created_at": "2023-05-15 10:30:00",
        "latestMessage": {
          "content": "张三：这个技术问题很有意思！",
          "createdAt": "2023-05-20 14:30:00"
        }
      }
    ],
    "recentActive": [
      {
        "id": 790,
        "name": "最新动态",
        "description": "分享最新资讯",
        "created_by": 124,
        "creatorName": "李四",
        "is_private": 0,
        "is_active": 1,
        "message_count": 50,
        "last_activity": "2023-05-20 14:25:00",
        "created_at": "2023-05-18 09:15:00",
        "latestMessage": {
          "content": "李四：这里有最新消息！",
          "createdAt": "2023-05-20 14:25:00"
        }
      }
    ],
    "new": [
      {
        "id": 791,
        "name": "新话题",
        "description": "新创建的话题",
        "created_by": 125,
        "creatorName": "王五",
        "is_private": 1,
        "is_active": 1,
        "message_count": 5,
        "last_activity": "2023-05-20 14:20:00",
        "created_at": "2023-05-20 10:00:00",
        "latestMessage": {
          "content": "王五：欢迎加入新话题！",
          "createdAt": "2023-05-20 14:20:00"
        }
      }
    ]
  }
}
```

---

### 加入话题
**POST** `/api/chat/topics/{topicId}/join`

加入指定话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功加入话题"
}
```

---

### 退出话题
**POST** `/api/chat/topics/{topicId}/leave`

退出指定话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功退出话题"
}
```

---

### 获取话题成员列表
**GET** `/api/chat/topics/{topicId}/members`

获取指定话题的成员列表。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 123,
        "username": "张三",
        "avatar_url": "https://example.com/avatar1.jpg",
        "registration_order": 456,
        "joined_at": "2023-05-15 10:30:00",
        "role": "creator",
        "isMuted": false
      },
      {
        "id": 124,
        "username": "李四",
        "avatar_url": null,
        "registration_order": 457,
        "joined_at": "2023-05-16 11:45:00",
        "role": "member",
        "isMuted": true
      }
    ],
    "count": 2
  }
}
```

---

### 设置话题管理员
**POST** `/api/chat/topics/{topicId}/admins/{adminId}`

将指定用户设置为话题管理员。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| adminId | number | 是 | 要设置为管理员的用户ID |

#### 权限规则
- 仅话题创建者可以设置管理员
- 不能设置自己为管理员（如果已经是创建者或管理员）

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功设置管理员",
  "data": {
    "changes": 1
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以设置管理员"
}
```

---

### 取消话题管理员
**DELETE** `/api/chat/topics/{topicId}/admins/{adminId}`

取消指定用户的管理员身份。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| adminId | number | 是 | 要取消管理员身份的用户ID |

#### 权限规则
- 仅话题创建者可以取消管理员
- 不能取消自己的管理员身份（如果自己是创建者）

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功取消管理员",
  "data": {
    "changes": 1
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以取消管理员"
}
```

---

### 修改话题信息
**PUT** `/api/chat/topics/{topicId}`

修改指定话题的信息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 否 | 话题名称 |
| description | string | 否 | 话题描述 |

#### 权限规则
- 仅话题创建者和管理员可以修改话题信息

#### 请求示例
```json
{
  "name": "更新后的技术讨论",
  "description": "更新后的描述"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题信息更新成功",
  "data": {
    "id": 789,
    "name": "更新后的技术讨论",
    "description": "更新后的描述",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 1,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以修改话题信息"
}
```

---

### 修改话题私有状态
**PUT** `/api/chat/topics/{topicId}/private`

修改话题的私有状态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| is_private | boolean | 是 | 是否为私有话题 |

#### 权限规则
- 仅话题创建者可以修改话题私有状态

#### 请求示例
```json
{
  "is_private": false
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题已设置为公开",
  "data": {
    "id": 789,
    "name": "技术讨论",
    "description": "讨论各种技术问题",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 0,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以修改话题私有状态"
}
```

---

### 上传话题头像
**POST** `/api/chat/topics/{topicId}/avatar`

上传并设置话题的头像图片。仅话题创建者和管理员可以操作。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求体 (multipart/form-data)
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| file | file | 是 | 头像图片文件 (最大5MB) |

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题头像已更新",
  "data": {
    "id": 789,
    "name": "技术讨论",
    "description": "讨论各种技术问题",
    "avatar_url": "/uploads/avatars/d41d8cd98f00b204e9800998ecf8427e.jpg",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 0,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以修改话题头像"
}
```

---

### 移除话题成员
**DELETE** `/api/chat/topics/{topicId}/members/{memberId}`

从指定话题中移除成员，仅话题创建者和管理员可以操作。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| memberId | number | 是 | 要移除的成员用户ID |

#### 权限规则
- 仅话题创建者和管理员可以移除成员
- 管理员不能移除创建者或其他管理员
- 话题创建者可以移除任何成员（包括管理员和其他创建者）
- 不能移除自己

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功移除成员"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以移除成员"
}
```

---

### 禁言用户
**POST** `/api/chat/topics/{topicId}/muted/{userId}`

禁言指定用户，使其无法在话题中发送消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| userId | number | 是 | 要禁言的用户ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| reason | string | 否 | 禁言原因 |

#### 权限规则
- 仅话题创建者和管理员可以禁言用户
- 管理员不能禁言创建者或其他管理员
- 话题创建者可以禁言任何人（包括管理员）
- 不能禁言自己

#### 请求示例
```json
{
  "reason": "违反话题规则"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功禁言用户"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "管理员不能禁言创建者或其他管理员"
}
```

---

### 解除禁言
**DELETE** `/api/chat/topics/{topicId}/muted/{userId}`

解除指定用户的禁言状态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| userId | number | 是 | 要解除禁言的用户ID |

#### 权限规则
- 仅话题创建者和管理员可以解除禁言
- 话题创建者可以解除任何人的禁言
- 管理员只能解除普通成员的禁言

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功解除禁言"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "管理员只能解除普通成员的禁言"
}
```

---

### 检查禁言状态
**GET** `/api/chat/topics/{topicId}/muted/check`

检查当前用户是否被禁言。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "isMuted": true,
    "muteInfo": {
      "id": 123,
      "topic_id": 456,
      "user_id": 789,
      "muted_by": 123,
      "mutedByUsername": "管理员",
      "reason": "违反话题规则",
      "created_at": "2023-05-20 14:30:00"
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

## 消息相关（发送、编辑、撤回、转发、引用）

### 消息类型字段说明

消息历史API现在返回不同结构的消息对象，用于区分不同类型的消息：

#### 普通消息 (normal message)
- `messageType`: 消息类型，值为 `normal`
- `messageSubtype`: 基本消息类型，值为 `text`、`image`、`video`、`file`、`markdown` 或 `html`
- 包含完整的消息内容和其他字段
- 包含 `content`、`created_at`、`senderId`、`senderName` 等基本字段
- 包含 `fileInfo` 对象（当messageSubtype为image、video或file时）

#### 编辑消息 (edited message)
- `messageType`: 消息类型，值为 `edited`
- `messageSubtype`: 基本消息类型，值为 `text`、`image`、`video`、`file`、`markdown` 或 `html`
- 包含完整的消息内容和其他字段
- 包含 `editHistory` 数组，包含消息的编辑历史
- 包含 `updated_at` 字段，表示最后编辑时间
- 包含 `fileInfo` 对象（当messageSubtype为image、video或file时）

#### 转发消息 (forwarded message)
- `messageType`: 消息类型，值为 `forwarded`
- `messageSubtype`: 基本消息类型，值为 `text`、`image`、`video`、`file`、`markdown` 或 `html`
- 包含完整的消息内容和其他字段
- 包含 `originalMessageId` 字段，表示原始消息ID
- 包含 `originalMessage` 对象，包含原始消息的详细信息，包括发送者、内容等
- 包含 `fileInfo` 对象（当messageSubtype为image、video或file时）

#### 引用消息 (quoted message)
- `messageType`: 消息类型，值为 `quoted`
- `messageSubtype`: 基本消息类型，值为 `text`、`image`、`video`、`file`、`markdown` 或 `html`
- 包含完整的消息内容和其他字段
- 包含 `quotedMessageId` 字段，表示被引用消息的ID
- 包含 `quotedMessage` 对象，包含被引用消息的详细信息
- 包含 `fileInfo` 对象（当messageSubtype为image、video或file时）

#### 撤回消息 (recalled message)
- `messageType`: 消息类型，值为 `recalled`
- `messageSubtype`: 基本消息类型，值为 `text`、`image`、`video`、`file`、`markdown` 或 `html`
- 仅包含基本的元数据信息，不包含原始消息内容
- 包含 `id`、`isRecalled`、`recallTime`、`created_at`、`messageTime`、`relativeTime`、`messageType`、`senderId`、`senderName` 等字段
- 撤回消息的内容被隐藏，显示为"[消息已被撤回]"，其他敏感信息（如引用消息）将被清除

这些不同的数据结构可以帮助前端更好地展示不同类型的消息。


### 基本消息类型字段说明

新增的 `messageSubtype` 字段用于区分消息的基本类型：

- `text`: 文本消息，最常见类型，内容以纯文本形式存储和显示
- `image`: 图片消息，用于发送图片文件，前端应以图片形式展示
- `video`: 视频消息，用于发送视频文件，前端应以视频播放器形式展示
- `file`: 文件消息，用于发送任意文件，前端应提供下载链接
- `markdown`: Markdown消息，内容为Markdown格式，前端应解析并渲染为富文本
- `html`: HTML消息，内容为HTML格式，前端应解析并渲染为富文本

当 `messageSubtype` 为 `image`、`video` 或 `file` 时，消息对象会包含 `fileInfo` 对象，包含以下字段：
- `url`: 文件访问URL
- `name`: 原始文件名
- `size`: 文件大小（字节）
- `type`: 文件MIME类型

###


### 发送消息
**POST** `/api/chat/messages`

发送消息到公共聊天室或指定话题。通过在请求参数中指定topicId来发送到话题，不指定或设置为null则发送到公共聊天室。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 消息内容（当messageSubtype为text、markdown或html时必填） |
| topicId | number | 否 | 话题ID（为null或不提供则发送到公共聊天室） |
| messageType | string | 否 | 消息类型：normal(默认)、forwarded |
| messageSubtype | string | 否 | 基本消息类型：text(默认)、image、video、file、markdown、html |
| forwardSourceId | number | 否 | 转发来源消息ID |
| quotedMessageId | number | 否 | 引用消息ID |
| file | file | 否 | 要上传的文件（当messageSubtype为image、video或file时必填）|

#### 请求示例
发送到公共聊天室：
```json
{
  "content": "大家好，这是一个测试消息！"
}
```

发送到话题：
```json
{
  "content": "这个技术问题很有意思！",
  "topicId": 2
}
```

发送图片消息：
```json
// 使用 multipart/form-data 格式
{
  "file": "<file_data>",
  "messageSubtype": "image",
  "content": "这是一张图片",
  "topicId": 2
}
```

发送文件消息：
```json
// 使用 multipart/form-data 格式
{
  "file": "<file_data>",
  "messageSubtype": "file",
  "content": "这是一个重要文档",
  "topicId": 2
}
```

#### 成功响应示例
发送到公共聊天室的响应：
```json
{
  "success": true,
  "message": "消息已发送到聊天室",
  "data": {
    "id": 1001,
    "topic_id": null,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "大家好，这是一个测试消息！",
    "messageSubtype": "text",
    "fileInfo": null,
    "created_at": "2023-05-20 14:30:00",
    "messageTime": "14:30",
    "relativeTime": "5分钟前",
    "isTopicMessage": false,
    "messageType": "normal"
  }
}
```

发送到话题的响应：
```json
{
  "success": true,
  "message": "话题消息已发送",
  "data": {
    "id": 1002,
    "topic_id": 2,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "这个技术问题很有意思！",
    "messageSubtype": "text",
    "fileInfo": null,
    "created_at": "2023-05-20 14:35:00",
    "messageTime": "14:35",
    "relativeTime": "刚刚",
    "isTopicMessage": true,
    "messageType": "normal"
  }
}
```

发送图片消息的响应：
```json
{
  "success": true,
  "message": "话题消息已发送",
  "data": {
    "id": 1003,
    "topic_id": 2,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "这是一张图片",
    "messageSubtype": "image",
    "fileInfo": {
      "url": "/uploads/image-123456789.jpg",
      "name": "screenshot.jpg",
      "size": 123456,
      "type": "image/jpeg"
    },
    "created_at": "2023-05-20 14:40:00",
    "messageTime": "14:40",
    "relativeTime": "刚刚",
    "isTopicMessage": true,
    "messageType": "normal"
  }
}
```

发送文件消息的响应：
```json
{
  "success": true,
  "message": "话题消息已发送",
  "data": {
    "id": 1004,
    "topic_id": 2,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "这是一个重要文档",
    "messageSubtype": "file",
    "fileInfo": {
      "url": "/uploads/document-987654321.pdf",
      "name": "report.pdf",
      "size": 2048576,
      "type": "application/pdf"
    },
    "created_at": "2023-05-20 14:45:00",
    "messageTime": "14:45",
    "relativeTime": "刚刚",
    "isTopicMessage": true,
    "messageType": "normal"
  }
}
```

---

### 获取公共消息历史
**GET** `/api/chat/messages`

获取公共聊天室的历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1001,
      "topic_id": null,
      "user_id": 123,
      "senderId": 123,
      "senderName": "张三",
      "content": "大家好，这是一个测试消息！",
      "messageSubtype": "text",
      "fileInfo": null,
      "created_at": "2023-05-20 14:30:00",
      "messageTime": "14:30",
      "relativeTime": "5分钟前",
      "isTopicMessage": false,
      "messageType": "normal"
    },
    {
      "id": 1002,
      "topic_id": null,
      "user_id": 124,
      "senderId": 124,
      "senderName": "李四",
      "content": "这是编辑后的消息内容",
      "messageSubtype": "text",
      "fileInfo": null,
      "created_at": "2023-05-20 14:32:00",
      "updated_at": "2023-05-20 14:35:00",
      "messageTime": "14:32",
      "relativeTime": "3分钟前",
      "isTopicMessage": false,
      "messageType": "edited",
      "editHistory": [
        {
          "id": 1,
          "message_id": 1002,
          "content": "原始消息内容",
          "messageSubtype": "text",
          "fileInfo": null,
          "created_at": "2023-05-20 14:32:00",
          "message_type": "public"
        }
      ]
    },
    {
      "id": 1003,
      "topic_id": null,
      "user_id": 125,
      "senderId": 125,
      "senderName": "王五",
      "content": "这是引用消息的内容",
      "messageSubtype": "text",
      "fileInfo": null,
      "created_at": "2023-05-20 14:36:00",
      "messageTime": "14:36",
      "relativeTime": "1分钟前",
      "isTopicMessage": false,
      "messageType": "quoted",
      "quotedMessageId": 1001,
      "quotedMessage": {
        "id": 1001,
        "content": "大家好，这是一个测试消息！",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:30:00",
        "senderName": "张三",
        "messageTime": "14:30",
        "relativeTime": "6分钟前",
        "messageType": "normal"
      }
    },
    {
      "id": 1004,
      "topic_id": null,
      "user_id": 126,
      "senderId": 126,
      "senderName": "赵六",
      "content": "这是转发的消息内容",
      "messageSubtype": "text",
      "fileInfo": null,
      "created_at": "2023-05-20 14:37:00",
      "messageTime": "14:37",
      "relativeTime": "刚刚",
      "isTopicMessage": false,
      "messageType": "forwarded",
      "originalMessageId": 1002,
      "originalMessage": {
        "id": 1002,
        "topic_id": null,
        "user_id": 124,
        "senderId": 124,
        "senderName": "李四",
        "content": "这是编辑后的消息内容",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:32:00",
        "messageTime": "14:32",
        "relativeTime": "5分钟前",
        "isTopicMessage": false,
        "messageType": "normal"
      }
    },
    {
      "id": 1005,
      "isRecalled": true,
      "recallTime": "2023-05-20 14:40:00",
      "created_at": "2023-05-20 14:38:00",
      "messageTime": "14:38",
      "relativeTime": "1分钟前",
      "messageType": "recalled",
      "messageSubtype": "text",
      "fileInfo": null,
      "senderId": 127,
      "senderName": "孙七"
    }
  ],
  "total": 5
}
```

---

### 发送话题消息
**POST** `/api/chat/messages`

向指定话题发送消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 消息内容（当messageSubtype为text、markdown或html时必填） |
| topicId | number | 是 | 话题ID（为null或不提供则发送到公共聊天室） |
| messageType | string | 否 | 消息类型：normal(默认)、forwarded |
| messageSubtype | string | 否 | 基本消息类型：text(默认)、image、video、file、markdown、html |
| forwardSourceId | number | 否 | 转发来源消息ID |
| quotedMessageId | number | 否 | 引用消息ID |
| file | file | 否 | 要上传的文件（当messageSubtype为image、video或file时必填）|

#### 请求示例
```json
{
  "content": "这个技术问题很有意思！",
  "topicId": 2
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题消息已发送",
  "data": {
    "messageId": 1002
  }
}
```

---

### 获取话题消息历史
**GET** `/api/chat/topics/{topicId}/messages`

获取指定话题的历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "topic": {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 29,
      "last_activity": "2023-05-20 14:40:00",
      "created_at": "2023-05-15 10:30:00"
    },
    "messages": [
      {
        "id": 1002,
        "topic_id": 789,
        "user_id": 123,
        "senderId": 123,
        "senderName": "张三",
        "content": "这个技术问题很有意思！",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:35:00",
        "messageTime": "14:35",
        "relativeTime": "刚刚",
        "messageType": "normal"
      },
      {
        "id": 1006,
        "topic_id": 789,
        "user_id": 124,
        "senderId": 124,
        "senderName": "李四",
        "content": "我来补充一些观点",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:36:00",
        "updated_at": "2023-05-20 14:37:00",
        "messageTime": "14:36",
        "relativeTime": "刚刚",
        "messageType": "edited",
        "editHistory": [
          {
            "id": 1,
            "message_id": 1006,
            "content": "我想说一些观点",
            "messageSubtype": "text",
            "fileInfo": null,
            "created_at": "2023-05-20 14:36:00",
            "message_type": "topic"
          }
        ]
      },
      {
        "id": 1007,
        "topic_id": 789,
        "user_id": 125,
        "senderId": 125,
        "senderName": "王五",
        "content": "我同意这个看法",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:38:00",
        "messageTime": "14:38",
        "relativeTime": "刚刚",
        "messageType": "quoted",
        "quotedMessageId": 1002,
        "quotedMessage": {
          "id": 1002,
          "content": "这个技术问题很有意思！",
          "messageSubtype": "text",
          "fileInfo": null,
          "created_at": "2023-05-20 14:35:00",
          "senderName": "张三",
          "messageTime": "14:35",
          "relativeTime": "3分钟前",
          "messageType": "normal"
        }
      },
      {
        "id": 1008,
        "topic_id": 789,
        "user_id": 126,
        "senderId": 126,
        "senderName": "赵六",
        "content": "这个消息是转发的",
        "messageSubtype": "text",
        "fileInfo": null,
        "created_at": "2023-05-20 14:39:00",
        "messageTime": "14:39",
        "relativeTime": "刚刚",
        "messageType": "forwarded",
        "originalMessageId": 1006,
        "originalMessage": {
          "id": 1006,
          "topic_id": 789,
          "user_id": 124,
          "senderId": 124,
          "senderName": "李四",
          "content": "我来补充一些观点",
          "messageSubtype": "text",
          "fileInfo": null,
          "created_at": "2023-05-20 14:36:00",
          "messageTime": "14:36",
          "relativeTime": "3分钟前",
          "messageType": "normal"
        }
      },
      {
        "id": 1009,
        "isRecalled": true,
        "recallTime": "2023-05-20 14:40:00",
        "created_at": "2023-05-20 14:39:30",
        "messageTime": "14:39",
        "relativeTime": "刚刚",
        "messageType": "recalled",
        "messageSubtype": "text",
        "fileInfo": null,
        "senderId": 127,
        "senderName": "孙七"
      }
    ]
  },
  "total": 5
}
```

---

### 发送私聊消息
**POST** `/api/chat/private-messages`

向指定用户发送私聊消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| receiverId | number | 是 | 接收者用户ID |
| content | string | 是 | 消息内容（当messageSubtype为text、markdown或html时必填） |
| messageType | string | 否 | 消息类型：normal(默认)、forwarded |
| messageSubtype | string | 否 | 基本消息类型：text(默认)、image、video、file、markdown、html |
| forwardSourceId | number | 否 | 转发来源消息ID |
| quotedMessageId | number | 否 | 引用消息ID |
| file | file | 否 | 要上传的文件（当messageSubtype为image、video或file时必填）|

#### 请求示例
```json
{
  "receiverId": 124,
  "content": "你好，我想和你私下聊聊。"
}
```

发送私聊图片消息：
```json
// 使用 multipart/form-data 格式
{
  "file": "<file_data>",
  "receiverId": 124,
  "messageSubtype": "image",
  "content": "给你看一张图片"
}
```

发送私聊文件消息：
```json
// 使用 multipart/form-data 格式
{
  "file": "<file_data>",
  "receiverId": 124,
  "messageSubtype": "file",
  "content": "这是一个重要文档，请查收"
}
```

#### 成功响应示例
文本消息响应：
```json
{
  "success": true,
  "message": "私聊消息发送成功",
  "data": {
    "message": {
      "id": 2001,
      "sender_id": 123,
      "receiver_id": 124,
      "senderId": 123,
      "senderName": "张三",
      "receiverId": 124,
      "receiverName": "李四",
      "content": "你好，我想和你私下聊聊。",
      "messageSubtype": "text",
      "fileInfo": null,
      "is_read": 0,
      "created_at": "2023-05-20 14:40:00",
      "messageTime": "14:40",
      "relativeTime": "刚刚",
      "messageType": "private"
    }
  }
}
```

图片消息响应：
```json
{
  "success": true,
  "message": "私聊消息发送成功",
  "data": {
    "message": {
      "id": 2002,
      "sender_id": 123,
      "receiver_id": 124,
      "senderId": 123,
      "senderName": "张三",
      "receiverId": 124,
      "receiverName": "李四",
      "content": "给你看一张图片",
      "messageSubtype": "image",
      "fileInfo": {
        "url": "/uploads/image-123456789.jpg",
        "name": "photo.jpg",
        "size": 512000,
        "type": "image/jpeg"
      },
      "is_read": 0,
      "created_at": "2023-05-20 14:45:00",
      "messageTime": "14:45",
      "relativeTime": "刚刚",
      "messageType": "private"
    }
  }
}
```

文件消息响应：
```json
{
  "success": true,
  "message": "私聊消息发送成功",
  "data": {
    "message": {
      "id": 2003,
      "sender_id": 123,
      "receiver_id": 124,
      "senderId": 123,
      "senderName": "张三",
      "receiverId": 124,
      "receiverName": "李四",
      "content": "这是一个重要文档，请查收",
      "messageSubtype": "file",
      "fileInfo": {
        "url": "/uploads/document-987654321.pdf",
        "name": "report.pdf",
        "size": 1024000,
        "type": "application/pdf"
      },
      "is_read": 0,
      "created_at": "2023-05-20 14:50:00",
      "messageTime": "14:50",
      "relativeTime": "刚刚",
      "messageType": "private"
    }
  }
}
```

---

### 获取私聊消息历史
**GET** `/api/chat/private-messages/{userId}`

获取与指定用户的私聊历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 对方用户ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 2001,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "你好，我想和你私下聊聊。",
        "messageSubtype": "text",
        "fileInfo": null,
        "is_read": 1,
        "created_at": "2023-05-20 14:40:00",
        "messageTime": "14:40",
        "relativeTime": "5分钟前",
        "messageType": "normal"
      },
      {
        "id": 2002,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "我修改一下之前的消息",
        "messageSubtype": "text",
        "fileInfo": null,
        "is_read": 0,
        "created_at": "2023-05-20 14:42:00",
        "updated_at": "2023-05-20 14:43:00",
        "messageTime": "14:42",
        "relativeTime": "3分钟前",
        "messageType": "edited",
        "editHistory": [
          {
            "id": 1,
            "message_id": 2002,
            "content": "我之前的内容",
            "messageSubtype": "text",
            "fileInfo": null,
            "created_at": "2023-05-20 14:42:00",
            "message_type": "private"
          }
        ]
      },
      {
        "id": 2003,
        "sender_id": 124,
        "receiver_id": 123,
        "senderId": 124,
        "senderName": "李四",
        "receiverId": 123,
        "receiverName": "张三",
        "content": "这是对之前消息的回复",
        "messageSubtype": "text",
        "fileInfo": null,
        "is_read": 1,
        "created_at": "2023-05-20 14:44:00",
        "messageTime": "14:44",
        "relativeTime": "1分钟前",
        "messageType": "quoted",
        "quotedMessageId": 2001,
        "quotedMessage": {
          "id": 2001,
          "content": "你好，我想和你私下聊聊。",
          "messageSubtype": "text",
          "fileInfo": null,
          "created_at": "2023-05-20 14:40:00",
          "senderName": "张三",
          "messageTime": "14:40",
          "relativeTime": "5分钟前",
          "messageType": "normal"
        }
      },
      {
        "id": 2004,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "转发一个重要的消息给你",
        "messageSubtype": "text",
        "fileInfo": null,
        "is_read": 0,
        "created_at": "2023-05-20 14:45:00",
        "messageTime": "14:45",
        "relativeTime": "刚刚",
        "messageType": "forwarded",
        "originalMessageId": 2002,
        "originalMessage": {
          "id": 2002,
          "sender_id": 123,
          "receiver_id": 124,
          "senderId": 123,
          "senderName": "张三",
          "receiverId": 124,
          "receiverName": "李四",
          "content": "我修改一下之前的消息",
          "messageSubtype": "text",
          "fileInfo": null,
          "is_read": 0,
          "created_at": "2023-05-20 14:42:00",
          "messageTime": "14:42",
          "relativeTime": "3分钟前",
          "messageType": "normal"
        }
      },
      {
        "id": 2005,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "给你看看这张图片",
        "messageSubtype": "image",
        "fileInfo": {
          "url": "/uploads/image-123456789.jpg",
          "name": "screenshot.jpg",
          "size": 245760,
          "type": "image/jpeg"
        },
        "is_read": 0,
        "created_at": "2023-05-20 14:46:00",
        "messageTime": "14:46",
        "relativeTime": "刚刚",
        "messageType": "normal"
      },
      {
        "id": 2006,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "重要文档，请查收",
        "messageSubtype": "file",
        "fileInfo": {
          "url": "/uploads/document-987654321.pdf",
          "name": "contract.pdf",
          "size": 1048576,
          "type": "application/pdf"
        },
        "is_read": 0,
        "created_at": "2023-05-20 14:47:00",
        "messageTime": "14:47",
        "relativeTime": "刚刚",
        "messageType": "normal"
      },
      {
        "id": 2007,
        "isRecalled": true,
        "recallTime": "2023-05-20 14:48:00",
        "created_at": "2023-05-20 14:47:30",
        "messageTime": "14:47",
        "relativeTime": "刚刚",
        "messageType": "recalled",
        "messageSubtype": "text",
        "fileInfo": null,
        "senderId": 124,
        "senderName": "李四",
        "receiverId": 123,
        "receiverName": "张三"
      }
    ]
  },
  "total": 6
}
```

---

### 获取私聊过的用户列表
**GET** `/api/chat/private-messages/users`

获取当前用户曾经私聊过的所有用户列表，包含每个用户的最新私聊消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 响应字段说明
除了用户的基本信息外，还包含以下字段：
- `latestMessage`: 对象，包含与该用户的最新私聊消息信息
  - `content`: string，最新消息内容，格式为"发送者用户名：消息内容"
  - `createdAt`: string，消息创建时间

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 124,
      "username": "李四",
      "registration_order": 2,
      "created_at": "2023-05-15 10:30:00",
      "latestMessage": {
        "content": "李四：你好，我想和你私下聊聊。",
        "createdAt": "2023-05-20 14:40:00"
      }
    }
  ],
  "total": 1
}
```

---

### 获取未读私聊消息
**GET** `/api/chat/private-messages/unread`

获取所有未读的私聊消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 2002,
        "sender_id": 125,
        "receiver_id": 123,
        "senderId": 125,
        "senderName": "王五",
        "content": "你在线吗？",
        "is_read": 0,
        "created_at": "2023-05-20 14:45:00",
        "messageTime": "14:45",
        "relativeTime": "刚刚",
        "messageType": "normal",
        "isEdited": false,
        "isRecalled": false,
        "isQuoted": false
      }
    ]
  },
  "total": 1
}
```

---

### 获取未读私聊消息数量
**GET** `/api/chat/private-messages/unread/count`

获取当前用户的未读私聊消息数量。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取在线用户数
**GET** `/api/chat/online-users`

获取当前在线用户数量。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "onlineCount": 15,
    "timestamp": "2023-05-20T14:40:00.000Z"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 检查禁言状态
**GET** `/api/chat/topics/{topicId}/muted/check`

检查当前用户是否被禁言。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "isMuted": true,
    "muteInfo": {
      "id": 123,
      "topic_id": 456,
      "user_id": 789,
      "muted_by": 123,
      "mutedByUsername": "管理员",
      "reason": "违反话题规则",
      "created_at": "2023-05-20 14:30:00"
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 设置话题公告
**PUT** `/api/chat/topics/{topicId}/announcement`

设置话题公告，仅话题创建者和管理员可以操作。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| announcement | string | 否 | 话题公告内容，为空或不提供则清空公告 |

#### 权限规则
- 仅话题创建者和管理员可以设置话题公告

#### 请求示例
```json
{
  "announcement": "这是一个重要公告，请大家注意。"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "公告设置成功",
  "data": {
    "id": 789,
    "name": "技术讨论",
    "description": "讨论各种技术问题",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 1,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00",
    "announcement": "这是一个重要公告，请大家注意。"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以设置话题公告"
}
```

---

### 获取话题公告
**GET** `/api/chat/topics/{topicId}/announcement`

获取话题公告内容。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 权限规则
- 公开话题：所有用户可以查看
- 私有话题：仅话题成员可以查看

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "announcement": "这是一个重要公告，请大家注意。"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "您没有权限查看此私有话题的公告"
}
```

---

### 撤回消息
**DELETE** `/api/chat/messages/{messageId}`

撤回指定消息，遵循以下权限规则：
- 发送者：可以撤回自己的消息
- 管理员：可以撤回话题成员的消息（不能撤回其他管理员或创建者的消息）
- 话题创建者：可以撤回话题内任何消息

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| messageId | number | 是 | 消息ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| isPrivate | string | 否 | 是否为私聊消息，值为"true"或"false" |
| topicId | number | 否 | 话题ID，如果是话题消息 |

#### 权限规则
- 消息发送者可以撤回自己的消息
- 话题管理员可以撤回普通成员的消息
- 话题创建者可以撤回话题内任何消息
- 公共聊天室消息只能由发送者撤回

#### 成功响应示例
```json
{
  "success": true,
  "message": "消息已撤回"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "无法撤回消息，权限不足"
}
```

---

### 编辑消息
**PUT** `/api/chat/messages/{messageId}`

编辑指定消息，只有消息发送者可以编辑自己的消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| messageId | number | 是 | 消息ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 新的消息内容 |
| isPrivate | string | 否 | 是否为私聊消息，值为"true"或"false" |

#### 权限规则
- 仅消息发送者可以编辑自己的消息
- 不能编辑其他用户的消息
- 不能编辑已撤回的消息

#### 请求示例
```json
{
  "content": "这是修改后的消息内容",
  "isPrivate": "false"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "消息已更新",
  "data": {
    "id": 1001,
    "topic_id": null,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "这是修改后的消息内容",
    "created_at": "2023-05-20 14:30:00",
    "updated_at": "2023-05-20 14:35:00",
    "messageTime": "14:30",
    "relativeTime": "5分钟前",
    "isTopicMessage": false,
    "messageType": "edited",
    "editHistory": [
      {
        "id": 1,
        "message_id": 1001,
        "content": "原始消息内容",
        "created_at": "2023-05-20 14:30:00",
        "message_type": "public"
      }
    ]
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "无法编辑消息，仅消息发送者可以编辑自己的消息"
}
```

---

### 获取消息历史版本
**GET** `/api/chat/messages/{messageId}/versions`

获取指定消息的编辑历史版本。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| messageId | number | 是 | 消息ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| isPrivate | string | 否 | 是否为私聊消息，值为"true"或"false" |

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "message_id": 1001,
      "content": "原始消息内容",
      "created_at": "2023-05-20 14:30:00",
      "message_type": "public"
    },
    {
      "id": 2,
      "message_id": 1001,
      "content": "第一次编辑后的内容",
      "created_at": "2023-05-20 14:32:00",
      "message_type": "public"
    },
    {
      "id": 3,
      "message_id": 1001,
      "content": "最终编辑后的内容",
      "created_at": "2023-05-20 14:35:00",
      "message_type": "public"
    }
  ]
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 转发消息
**POST** `/api/chat/messages/forward`

转发一条或多条消息到指定话题或用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| messageIds | array | 是 | 要转发的消息ID数组 |
| targetTopicId | number | 否 | 目标话题ID（与targetReceiverId二选一） |
| targetReceiverId | number | 否 | 目标接收者ID（与targetTopicId二选一） |

#### 权限规则
- 用户只能转发自己有权访问的消息
- 不能转发已撤回的消息

#### 请求示例
```json
{
  "messageIds": [1001, 1002],
  "targetTopicId": 789
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功转发 2 条消息",
  "data": [
    {
      "id": 2001,
      "topic_id": 789,
      "user_id": 123,
      "senderId": 123,
      "senderName": "张三",
      "content": "转发的消息内容",
      "created_at": "2023-05-20 14:40:00",
      "messageTime": "14:40",
      "relativeTime": "刚刚",
      "messageType": "forwarded",
      "originalMessageId": 1001,
      "originalMessage": {
        "id": 1001,
        "content": "原始消息内容",
        "created_at": "2023-05-20 14:30:00",
        "senderName": "张三",
        "messageTime": "14:30",
        "relativeTime": "10分钟前",
        "messageType": "normal"
      }
    }
  ]
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "必须指定转发目标（话题ID或接收者ID）"
}
```

---

### 发送引用消息
**POST** `/api/chat/messages/quote`

发送引用指定消息的新消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 新消息内容 |
| quotedMessageId | number | 是 | 被引用的消息ID |
| topicId | number | 否 | 目标话题ID（与receiverId二选一，都不提供则发送到公共聊天室） |
| receiverId | number | 否 | 目标接收者ID（与topicId二选一，都不提供则发送到公共聊天室） |

#### 权限规则
- 用户只能引用自己有权访问的消息
- 不能引用已撤回的消息

#### 请求示例
```json
{
  "content": "我同意这个观点",
  "quotedMessageId": 1001,
  "topicId": 789
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题引用消息已发送",
  "data": {
    "id": 2001,
    "topic_id": 789,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "我同意这个观点",
    "created_at": "2023-05-20 14:40:00",
    "messageTime": "14:40",
    "relativeTime": "刚刚",
    "messageType": "quoted",
    "quotedMessageId": 1001,
    "quotedMessage": {
      "id": 1001,
      "content": "原始被引用消息内容",
      "created_at": "2023-05-20 14:30:00",
      "senderName": "李四",
      "messageTime": "14:30",
      "relativeTime": "10分钟前",
      "messageType": "normal"
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "引用消息ID无效"
}
```

---

### 移除话题成员
**DELETE** `/api/chat/topics/{topicId}/members/{memberId}`

从指定话题中移除成员，仅话题创建者和管理员可以操作。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| memberId | number | 是 | 要移除的成员用户ID |

#### 权限规则
- 仅话题创建者和管理员可以移除成员
- 管理员不能移除创建者或其他管理员
- 话题创建者可以移除任何成员（包括管理员和其他创建者）
- 不能移除自己

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功移除成员"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以移除成员"
}
```

---

### 禁言用户
**POST** `/api/chat/topics/{topicId}/muted/{userId}`

禁言指定用户，使其无法在话题中发送消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| userId | number | 是 | 要禁言的用户ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| reason | string | 否 | 禁言原因 |

#### 权限规则
- 仅话题创建者和管理员可以禁言用户
- 管理员不能禁言创建者或其他管理员
- 话题创建者可以禁言任何人（包括管理员）
- 不能禁言自己

#### 请求示例
```json
{
  "reason": "违反话题规则"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功禁言用户"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "管理员不能禁言创建者或其他管理员"
}
```

---

### 解除禁言
**DELETE** `/api/chat/topics/{topicId}/muted/{userId}`

解除指定用户的禁言状态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| userId | number | 是 | 要解除禁言的用户ID |

#### 权限规则
- 仅话题创建者和管理员可以解除禁言
- 话题创建者可以解除任何人的禁言
- 管理员只能解除普通成员的禁言

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功解除禁言"
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "管理员只能解除普通成员的禁言"
}
```

---

### 检查用户是否被禁言
**GET** `/api/chat/topics/{topicId}/muted/check`

检查当前用户是否被禁言。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "isMuted": true,
    "muteInfo": {
      "id": 123,
      "topic_id": 456,
      "user_id": 789,
      "muted_by": 123,
      "mutedByUsername": "管理员",
      "reason": "违反话题规则",
      "created_at": "2023-05-20 14:30:00"
    }
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取所有话题
**GET** `/api/chat/topics/all`

获取用户加入的所有话题列表，包含每个话题的最新消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 25,
      "last_activity": "2023-05-20 14:30:00",
      "created_at": "2023-05-15 10:30:00",
      "latestMessage": {
        "content": "张三：这个技术问题很有意思！",
        "createdAt": "2023-05-20 14:30:00"
      }
    }
  ],
  "total": 1
}
```

---

### 获取推荐话题
**GET** `/api/chat/topics/recommended`

获取推荐话题，包括热门话题、近期活跃话题和新创建话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 每类话题的最大返回结果数，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "popular": [
      {
        "id": 789,
        "name": "技术讨论",
        "description": "讨论各种技术问题",
        "created_by": 123,
        "creatorName": "张三",
        "is_private": 1,
        "is_active": 1,
        "message_count": 100,
        "last_activity": "2023-05-20 14:30:00",
        "created_at": "2023-05-15 10:30:00",
        "latestMessage": {
          "content": "张三：这个技术问题很有意思！",
          "createdAt": "2023-05-20 14:30:00"
        }
      }
    ],
    "recentActive": [
      {
        "id": 790,
        "name": "最新动态",
        "description": "分享最新资讯",
        "created_by": 124,
        "creatorName": "李四",
        "is_private": 0,
        "is_active": 1,
        "message_count": 50,
        "last_activity": "2023-05-20 14:25:00",
        "created_at": "2023-05-18 09:15:00",
        "latestMessage": {
          "content": "李四：这里有最新消息！",
          "createdAt": "2023-05-20 14:25:00"
        }
      }
    ],
    "new": [
      {
        "id": 791,
        "name": "新话题",
        "description": "新创建的话题",
        "created_by": 125,
        "creatorName": "王五",
        "is_private": 1,
        "is_active": 1,
        "message_count": 5,
        "last_activity": "2023-05-20 14:20:00",
        "created_at": "2023-05-20 10:00:00",
        "latestMessage": {
          "content": "王五：欢迎加入新话题！",
          "createdAt": "2023-05-20 14:20:00"
        }
      }
    ]
  }
}
```

---

### 搜索话题
**GET** `/api/chat/topics/search`

根据名称或ID搜索话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |
| limit | number | 否 | 最大返回结果数，默认50 |

#### 请求示例
```
GET /api/chat/topics/search?query=技术&limit=10
```

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 25,
      "last_activity": "2023-05-20 14:30:00",
      "created_at": "2023-05-15 10:30:00",
      "is_member": true
    }
  ]
}
```

---

### 获取用户个人收件箱主题
**GET** `/api/chat/user-inbox-topic`

获取当前用户的个人收件箱主题名称，用于订阅MQTT消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "inboxTopic": "yunhu-chat/broadcast/inbox/abcd1234...",
    "userId": 123
  }
}
```

---

### 获取与当前用户有过私聊的所有用户
**GET** `/api/chat/private-messages/users`

获取当前用户曾经私聊过的所有用户列表，包含每个用户的最新私聊消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 响应字段说明
除了用户的基本信息外，还包含以下字段：
- `latestMessage`: 对象，包含与该用户的最新私聊消息信息
  - `content`: string，最新消息内容，格式为"发送者用户名：消息内容"
  - `createdAt`: string，消息创建时间

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 124,
      "username": "李四",
      "registration_order": 2,
      "created_at": "2023-05-15 10:30:00",
      "latestMessage": {
        "content": "李四：你好，我想和你私下聊聊。",
        "createdAt": "2023-05-20 14:40:00"
      }
    }
  ],
  "total": 1
}
```

---

### 获取未读私聊消息
**GET** `/api/chat/private-messages/unread`

获取所有未读的私聊消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 2002,
        "sender_id": 125,
        "receiver_id": 123,
        "senderId": 125,
        "senderName": "王五",
        "content": "你在线吗？",
        "is_read": 0,
        "created_at": "2023-05-20 14:45:00",
        "messageTime": "14:45",
        "relativeTime": "刚刚",
        "messageType": "normal",
        "isEdited": false,
        "isRecalled": false,
        "isQuoted": false
      }
    ]
  },
  "total": 1
}
```

---

### 获取未读私聊消息数量
**GET** `/api/chat/private-messages/unread/count`

获取当前用户的未读私聊消息数量。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取在线用户数
**GET** `/api/chat/online-users`

获取当前在线用户数量。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "onlineCount": 15,
    "timestamp": "2023-05-20T14:40:00.000Z"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取公共消息历史
**GET** `/api/chat/messages`

获取公共聊天室的历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1001,
      "topic_id": null,
      "user_id": 123,
      "senderId": 123,
      "senderName": "张三",
      "content": "大家好，这是一个测试消息！",
      "created_at": "2023-05-20 14:30:00",
      "messageTime": "14:30",
      "relativeTime": "5分钟前",
      "isTopicMessage": false,
      "messageType": "normal"
    }
  ],
  "total": 1
}
```

---

### 获取话题消息历史
**GET** `/api/chat/topics/{topicId}/messages`

获取指定话题的历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "topic": {
      "id": 789,
      "name": "技术讨论",
      "description": "讨论各种技术问题",
      "created_by": 123,
      "creatorName": "张三",
      "is_private": 1,
      "is_active": 1,
      "message_count": 29,
      "last_activity": "2023-05-20 14:40:00",
      "created_at": "2023-05-15 10:30:00"
    },
    "messages": [
      {
        "id": 1002,
        "topic_id": 789,
        "user_id": 123,
        "senderId": 123,
        "senderName": "张三",
        "content": "这个技术问题很有意思！",
        "created_at": "2023-05-20 14:35:00",
        "messageTime": "14:35",
        "relativeTime": "刚刚",
        "messageType": "normal"
      }
    ]
  },
  "total": 1
}
```

---

### 获取与指定用户的私聊消息历史
**GET** `/api/chat/private-messages/{userId}`

获取与指定用户的私聊历史消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 对方用户ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |
| offset | number | 否 | 跳过的消息数，默认0 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 2001,
        "sender_id": 123,
        "receiver_id": 124,
        "senderId": 123,
        "senderName": "张三",
        "receiverId": 124,
        "receiverName": "李四",
        "content": "你好，我想和你私下聊聊。",
        "is_read": 1,
        "created_at": "2023-05-20 14:40:00",
        "messageTime": "14:40",
        "relativeTime": "5分钟前",
        "messageType": "normal"
      }
    ]
  },
  "total": 1
}
```

---

### 加入话题
**POST** `/api/chat/topics/{topicId}/join`

加入指定话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功加入话题"
}
```

---

### 退出话题
**POST** `/api/chat/topics/{topicId}/leave`

退出指定话题。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功退出话题"
}
```

---

### 获取话题成员列表
**GET** `/api/chat/topics/{topicId}/members`

获取指定话题的成员列表。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 最大返回结果数，默认50 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 123,
        "username": "张三",
        "registration_order": 456,
        "joined_at": "2023-05-15 10:30:00",
        "role": "creator",
        "isMuted": false
      },
      {
        "id": 124,
        "username": "李四",
        "registration_order": 457,
        "joined_at": "2023-05-16 11:45:00",
        "role": "member",
        "isMuted": true
      }
    ],
    "count": 2
  }
}
```

---

### 设置话题管理员
**POST** `/api/chat/topics/{topicId}/admins/{adminId}`

将指定用户设置为话题管理员。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| adminId | number | 是 | 要设置为管理员的用户ID |

#### 权限规则
- 仅话题创建者可以设置管理员
- 不能设置自己为管理员（如果已经是创建者或管理员）

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功设置管理员",
  "data": {
    "changes": 1
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以设置管理员"
}
```

---

### 取消话题管理员
**DELETE** `/api/chat/topics/{topicId}/admins/{adminId}`

取消指定用户的管理员身份。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |
| adminId | number | 是 | 要取消管理员身份的用户ID |

#### 权限规则
- 仅话题创建者可以取消管理员
- 不能取消自己的管理员身份（如果自己是创建者）

#### 成功响应示例
```json
{
  "success": true,
  "message": "成功取消管理员",
  "data": {
    "changes": 1
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以取消管理员"
}
```

---

### 修改话题信息
**PUT** `/api/chat/topics/{topicId}`

修改指定话题的信息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 否 | 话题名称 |
| description | string | 否 | 话题描述 |

#### 权限规则
- 仅话题创建者和管理员可以修改话题信息

#### 请求示例
```json
{
  "name": "更新后的技术讨论",
  "description": "更新后的描述"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题信息更新成功",
  "data": {
    "id": 789,
    "name": "更新后的技术讨论",
    "description": "更新后的描述",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 1,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者和管理员可以修改话题信息"
}
```

---

### 修改话题私有状态
**PUT** `/api/chat/topics/{topicId}/private`

修改话题的私有状态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| topicId | number | 是 | 话题ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| is_private | boolean | 是 | 是否为私有话题 |

#### 权限规则
- 仅话题创建者可以修改话题私有状态

#### 请求示例
```json
{
  "is_private": false
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "话题已设置为公开",
  "data": {
    "id": 789,
    "name": "技术讨论",
    "description": "讨论各种技术问题",
    "created_by": 123,
    "creatorName": "张三",
    "is_private": 0,
    "is_active": 1,
    "message_count": 25,
    "last_activity": "2023-05-20 14:30:00",
    "created_at": "2023-05-15 10:30:00"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "只有话题创建者可以修改话题私有状态"
}
```

---

### 获取用户统计信息
**GET** `/api/users/stats`

获取系统用户统计信息，包括总用户数和最近注册的用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "recentRegistrations": [
      {
        "username": "新用户1",
        "registrationDate": "2023-05-20 14:40:00",
        "registrationOrder": 1250
      },
      {
        "username": "新用户2",
        "registrationDate": "2023-05-20 14:35:00",
        "registrationOrder": 1249
      },
      {
        "username": "新用户3",
        "registrationDate": "2023-05-20 14:30:00",
        "registrationOrder": 1248
      },
      {
        "username": "新用户4",
        "registrationDate": "2023-05-20 14:25:00",
        "registrationOrder": 1247
      },
      {
        "username": "新用户5",
        "registrationDate": "2023-05-20 14:20:00",
        "registrationOrder": 1246
      }
    ]
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "服务器错误"
}
```

---

### 获取用户公开信息
**GET** `/api/users/{id}/public`

根据用户ID获取其公开信息。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "uid": 123,
    "username": "张三",
    "registrationOrder": 456,
    "registrationDate": "2023-05-15 10:30:00",
    "joinDuration": "2个月",
    "isEmailVerified": true
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "用户不存在"
}
```

---

### 搜索用户
**GET** `/api/users/search`

根据用户名搜索用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| username | string | 是 | 搜索关键词 |
| limit | number | 否 | 最大返回结果数，默认10 |

#### 请求示例
```
GET /api/users/search?username=张&limit=5
```

#### 成功响应示例
```json
{
  "success": true,
  "data": [
    {
      "uid": 123,
      "username": "张三",
      "registrationOrder": 456,
      "registrationDate": "2023-05-15 10:30:00"
    },
    {
      "uid": 124,
      "username": "张四",
      "registrationOrder": 457,
      "registrationDate": "2023-05-16 11:45:00"
    }
  ]
}
```

---

### 更新用户名
**PUT** `/api/users/username`

更新用户显示名称。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| newUsername | string | 是 | 新的显示名称 |

#### 请求示例
```json
{
  "newUsername": "李四"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "用户名更新成功",
  "data": {
    "newUsername": "李四"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "用户名不能为空"
}
```

---

### 获取当前用户信息
**GET** `/api/users/me`

获取当前登录用户的详细信息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "uid": 123,
    "username": "张三",
    "email": "zhangsan@example.com",
    "emailVerified": true,
    "registrationOrder": 456,
    "registrationDate": "2023-05-15 10:30:00",
    "joinDuration": "2个月"
  }
}
```

#### 失败响应示例
```json
{
  "success": false,
  "message": "访问令牌必填"
}
```

---

## MQTT实时消息

### 概述
系统使用MQTT over WebSocket实现实时消息推送。所有实时消息都会推送到用户的个人收件箱主题中。

### MQTT WebSocket连接机制

#### 连接建立
客户端通过WebSocket连接到 `/mqtt` 端点以建立MQTT连接：

```
ws://api-cofe.allons-y-uk:3009/mqtt
```

或

```
wss://api-cofe.allons-y-uk:3009/mqtt
```

#### 连接认证
客户端需要在建立连接时发送认证请求，使用JWT令牌进行身份验证：

**连接请求格式：**
```json
{
  "type": "connect",
  "token": "JWT访问令牌"
}
```

**连接响应格式：**
```json
{
  "type": "connack",
  "returnCode": 0 // 0表示成功，1表示认证失败
}
```

认证成功后，服务器会保存用户ID，用于后续的订阅和消息发送验证。服务器使用JWT验证机制确保连接的安全性。

#### 安全主题订阅机制
客户端只能订阅自己的个人收件箱主题，系统采用安全的主题生成机制防止用户订阅不属于自己的主题：

**主题生成算法：**
```javascript
// 服务器端生成用户收件箱主题
function generateUserInboxTopic(userId) {
  // 使用HMAC生成安全的用户收件箱主题名称
  const hash = crypto
    .createHmac('sha256', config.jwtSecret || 'default-secret')
    .update(`user-inbox-${userId}`)
    .digest('hex');
  
  return `${config.mqtt.topic}/inbox/${hash}`;
}
```

**订阅请求格式：**
```json
{
  "type": "subscribe",
  "topics": ["yunhu-chat/broadcast/inbox/abcd1234..."],
  "messageId": 1
}
```

**订阅响应格式：**
```json
{
  "type": "suback",
  "messageId": 1,
  "granted": [1] // 1表示订阅成功，0表示拒绝
}
```

服务器会验证JWT令牌并生成对应的安全主题名称，确保客户端只能订阅自己的收件箱主题。

#### 消息接收
服务器会将实时消息推送到用户的收件箱主题：

**推送消息格式：**
```json
{
  "type": "publish",
  "topic": "yunhu-chat/broadcast/inbox/abcd1234...",
  "payload": {
    // 消息内容
  },
  "qos": 1
}
```

#### 心跳机制
客户端可以发送心跳请求以维持连接：

**心跳请求格式：**
```json
{
  "type": "pingreq"
}
```

**心跳响应格式：**
```json
{
  "type": "pingresp"
}
```

### 获取个人收件箱主题
**GET** `/api/chat/user-inbox-topic`

获取当前用户的个人收件箱主题名称，用于订阅MQTT消息。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 成功响应示例
```json
{
  "success": true,
  "data": {
    "inboxTopic": "yunhu-chat/broadcast/inbox/abcd1234...",
    "userId": 123
  }
}
```

### 消息类型和子类型说明

系统支持多种消息类型和基本消息类型组合，以下是完整的分类说明：

#### MessageType（消息类型）
- `normal`: 普通消息（包括公共聊天室、话题内、私聊消息）
- `forwarded`: 转发消息
- `edited`: 编辑消息（包含编辑历史）
- `quoted`: 引用消息（包含被引用的消息内容）
- `recalled`: 撤回消息（内容被隐藏）

#### MessageSubtype（基本消息类型）
- `text`: 文本消息
- `image`: 图片消息
- `video`: 视频消息
- `file`: 文件消息
- `markdown`: Markdown格式消息
- `html`: HTML格式消息

### 消息格式说明

所有通过MQTT推送的消息都遵循以下格式，其中增加了`isSelf`字段用于区分消息来源。现在统一使用`normal`作为普通消息的`messageType`，并使用`sourceType`字段标识消息来源（sourceType为chatroom代表公共聊天室消息，为topic代表话题内消息，为private代表私聊消息）。其他特殊消息类型如edited、recalled、forwarded等仍保持其原有messageType。

#### 公共聊天室消息
```json
{
  "id": 1001,
  "topic_id": null,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "大家好，这是一个测试消息！",
  "created_at": "2023-05-20 14:30:00",
  "messageTime": "14:30",
  "relativeTime": "5分钟前",
  "isTopicMessage": false,
  "messageType": "normal",
  "sourceType": "chatroom",
  "isSelf": true
}
```

#### 话题消息
```json
{
  "id": 1002,
  "topic_id": 789,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "这个技术问题很有意思！",
  "created_at": "2023-05-20 14:35:00",
  "messageTime": "14:35",
  "relativeTime": "刚刚",
  "messageType": "normal",
  "sourceType": "topic",
  "isSelf": false
}
```

#### 私聊消息
```json
{
  "id": 2001,
  "sender_id": 123,
  "receiver_id": 124,
  "senderId": 123,
  "senderName": "张三",
  "receiverId": 124,
  "receiverName": "李四",
  "content": "你好，我想和你私下聊聊。",
  "is_read": 0,
  "created_at": "2023-05-20 14:40:00",
  "messageTime": "14:40",
  "relativeTime": "刚刚",
  "messageType": "normal",
  "sourceType": "private",
  "isSelf": true
}
```

### 完整的消息类型示例

#### 1. 普通文本消息 (normal + text)
```json
{
  "id": 1001,
  "topic_id": null,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "大家好，这是一个普通的文本消息！",
  "created_at": "2023-05-20 14:30:00",
  "messageTime": "14:30",
  "relativeTime": "5分钟前",
  "isTopicMessage": false,
  "messageType": "normal",
  "sourceType": "chatroom",
  "messageSubtype": "text",
  "isSelf": true
}
```

#### 2. Markdown消息 (normal + markdown)
```json
{
  "id": 1002,
  "topic_id": 789,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "# 标题\n\n这是一个**加粗**的Markdown消息。\n\n- 列表项1\n- 列表项2",
  "created_at": "2023-05-20 14:35:00",
  "messageTime": "14:35",
  "relativeTime": "刚刚",
  "isTopicMessage": true,
  "messageType": "normal",
  "sourceType": "topic",
  "messageSubtype": "markdown",
  "isSelf": false
}
```

#### 3. HTML消息 (normal + html)
```json
{
  "id": 1003,
  "topic_id": null,
  "user_id": 124,
  "senderId": 124,
  "senderName": "李四",
  "content": "<h1>HTML标题</h1><p>这是一个<span style=\"color: red\">红色</span>的HTML消息。</p>",
  "created_at": "2023-05-20 14:40:00",
  "messageTime": "14:40",
  "relativeTime": "刚刚",
  "isTopicMessage": false,
  "messageType": "normal",
  "sourceType": "chatroom",
  "messageSubtype": "html",
  "isSelf": false
}
```

#### 4. 图片消息 (normal + image)
```json
{
  "id": 1004,
  "topic_id": 789,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "这是一张美丽的风景照片",
  "created_at": "2023-05-20 14:45:00",
  "messageTime": "14:45",
  "relativeTime": "刚刚",
  "isTopicMessage": true,
  "messageType": "normal",
  "sourceType": "topic",
  "messageSubtype": "image",
  "fileInfo": {
    "url": "/uploads/image-1684576500123.jpg",
    "name": "scenery.jpg",
    "size": 2048576,
    "type": "image/jpeg"
  },
  "isSelf": true
}
```

#### 5. 视频消息 (normal + video)
```json
{
  "id": 1005,
  "topic_id": null,
  "user_id": 125,
  "senderId": 125,
  "senderName": "王五",
  "content": "分享一个有趣的视频",
  "created_at": "2023-05-20 14:50:00",
  "messageTime": "14:50",
  "relativeTime": "刚刚",
  "isTopicMessage": false,
  "messageType": "normal",
  "sourceType": "chatroom",
  "messageSubtype": "video",
  "fileInfo": {
    "url": "/uploads/video-1684576800456.mp4",
    "name": "funny_video.mp4",
    "size": 10485760,
    "type": "video/mp4"
  },
  "isSelf": false
}
```

#### 6. 文件消息 (normal + file)
```json
{
  "id": 1006,
  "topic_id": 789,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "这是重要的项目文档，请查收",
  "created_at": "2023-05-20 14:55:00",
  "messageTime": "14:55",
  "relativeTime": "刚刚",
  "isTopicMessage": true,
  "messageType": "normal",
  "sourceType": "topic",
  "messageSubtype": "file",
  "fileInfo": {
    "url": "/uploads/document-1684577100789.pdf",
    "name": "project_document.pdf",
    "size": 4194304,
    "type": "application/pdf"
  },
  "isSelf": true
}
```

#### 7. 编辑后的文本消息 (edited + text)
```json
{
  "id": 1007,
  "topic_id": null,
  "user_id": 123,
  "senderId": 123,
  "senderName": "张三",
  "content": "这是修改后的消息内容",
  "created_at": "2023-05-20 15:00:00",
  "updated_at": "2023-05-20 15:05:00",
  "messageTime": "15:00",
  "relativeTime": "刚刚",
  "isTopicMessage": false,
  "messageType": "edited",
  "messageSubtype": "text",
  "editHistory": [
    {
      "id": 1,
      "message_id": 1007,
      "content": "这是原始的消息内容",
      "created_at": "2023-05-20 15:00:00",
      "message_type": "normal"
    }
  ],
  "isSelf": true
}
```

#### 8. 转发的图片消息 (forwarded + image)
```json
{
  "id": 1008,
  "topic_id": 789,
  "user_id": 124,
  "senderId": 124,
  "senderName": "李四",
  "content": "转发一张有趣的图片",
  "created_at": "2023-05-20 15:10:00",
  "messageTime": "15:10",
  "relativeTime": "刚刚",
  "isTopicMessage": true,
  "messageType": "forwarded",
  "messageSubtype": "image",
  "originalMessageId": 1004,
  "originalMessage": {
    "id": 1004,
    "senderId": 123,
    "senderName": "张三",
    "content": "这是一张美丽的风景照片",
    "created_at": "2023-05-20 14:45:00",
    "messageType": "normal",
    "messageSubtype": "image",
    "fileInfo": {
      "url": "/uploads/image-1684576500123.jpg",
      "name": "scenery.jpg",
      "size": 2048576,
      "type": "image/jpeg"
    }
  },
  "fileInfo": {
    "url": "/uploads/image-1684576500123.jpg",
    "name": "scenery.jpg",
    "size": 2048576,
    "type": "image/jpeg"
  },
  "isSelf": false
}
```

#### 9. 引用的文件消息 (quoted + file)
```json
{
  "id": 1009,
  "topic_id": null,
  "user_id": 125,
  "senderId": 125,
  "senderName": "王五",
  "content": "关于这份文档，我有一些疑问",
  "created_at": "2023-05-20 15:15:00",
  "messageTime": "15:15",
  "relativeTime": "刚刚",
  "isTopicMessage": false,
  "messageType": "quoted",
  "messageSubtype": "text",
  "quotedMessageId": 1006,
  "quotedMessage": {
    "id": 1006,
    "senderId": 123,
    "senderName": "张三",
    "content": "这是重要的项目文档，请查收",
    "created_at": "2023-05-20 14:55:00",
    "messageType": "normal",
    "messageSubtype": "file",
    "fileInfo": {
      "url": "/uploads/document-1684577100789.pdf",
      "name": "project_document.pdf",
      "size": 4194304,
      "type": "application/pdf"
    }
  },
  "isSelf": true
}
```

#### 10. 撤回的消息 (recalled)
```json
{
  "id": 1010,
  "isRecalled": true,
  "recallTime": "2023-05-20 15:20:00",
  "created_at": "2023-05-20 15:18:00",
  "messageTime": "15:18",
  "relativeTime": "2分钟前",
  "messageType": "recalled",
  "senderId": 123,
  "senderName": "张三",
  "isTopicMessage": true,
  "topic_id": 789
}
```

### isSelf 字段说明
- `isSelf: true` 表示该消息是由当前用户发送的
- `isSelf: false` 表示该消息是由其他用户发送的

客户端可以根据此字段来区分消息来源，从而采用不同的UI展示方式。

### 消息操作事件

当消息被编辑、撤回或转发时，系统会通过MQTT推送相应的事件通知到相关用户的收件箱。

#### 消息编辑事件
```json
{
  "type": "message_event",
  "eventType": "edit",
  "messageId": 1001,
  "userId": 123,
  "content": "修改后的消息内容",
  "updatedMessage": {
    "id": 1001,
    "topic_id": null,
    "user_id": 123,
    "senderId": 123,
    "senderName": "张三",
    "content": "修改后的消息内容",
    "created_at": "2023-05-20 14:30:00",
    "updated_at": "2023-05-20 14:35:00",
    "messageTime": "14:30",
    "relativeTime": "5分钟前",
    "messageType": "edited",
    "sourceType": "chatroom",
    "messageSubtype": "text",
    "editHistory": [
      {
        "id": 1,
        "message_id": 1001,
        "content": "原始消息内容",
        "created_at": "2023-05-20 14:30:00",
        "message_type": "normal",
        "message_subtype": "text"
      }
    ]
  },
  "messageType": "normal",
  "sourceType": "chatroom",
  "timestamp": "2023-05-20T14:35:00.000Z"
}
```

#### 消息撤回事件
```json
{
  "type": "message_event",
  "eventType": "recall",
  "messageId": 1001,
  "userId": 123,
  "messageType": "normal",
  "sourceType": "chatroom",
  "topicId": 789,
  "timestamp": "2023-05-20T14:40:00.000Z",
  "isRecalled": true
}
```

#### 消息转发事件
```json
{
  "type": "message_event",
  "eventType": "forward",
  "originalMessageId": 1001,
  "forwardedMessageId": 1003,
  "forwarderId": 123,
  "messageType": "normal",
  "sourceType": "chatroom",
  "topicId": 789,
  "timestamp": "2023-05-20T14:45:00.000Z"
}
```

#### 私聊消息已读事件
```json
{
  "type": "message_event",
  "eventType": "read",
  "messageId": 2001,
  "readerId": 124,
  "senderId": 123,
  "timestamp": "2023-05-20T14:50:00.000Z",
  "messageType": "normal",
  "sourceType": "private"
}
```

#### 用户在线状态变更事件
```json
{
  "type": "user_event",
  "eventType": "status_change",
  "userId": 123,
  "username": "张三",
  "status": "online", // online, offline, away
  "timestamp": "2023-05-20T14:55:00.000Z"
}
```

#### 用户加入话题事件
```json
{
  "type": "topic_event",
  "eventType": "user_joined",
  "topicId": 789,
  "topicName": "技术讨论",
  "userId": 125,
  "username": "王五",
  "timestamp": "2023-05-20T15:00:00.000Z"
}
```

#### 话题创建事件
```json
{
  "type": "topic_event",
  "eventType": "created",
  "topicId": 790,
  "topicName": "新产品讨论",
  "creatorId": 123,
  "creatorName": "张三",
  "description": "讨论新产品的功能和设计",
  "timestamp": "2023-05-20T15:05:00.000Z"
}
```

### 好友功能事件

#### 好友请求事件
```json
{
  "type": "friend_event",
  "eventType": "request_sent",
  "requestId": 1,
  "senderId": 123,
  "senderName": "张三",
  "receiverId": 124,
  "receiverName": "李四",
  "timestamp": "2023-05-20T15:10:00.000Z"
}
```

#### 好友请求接受事件
```json
{
  "type": "friend_event",
  "eventType": "request_accepted",
  "requestId": 1,
  "senderId": 123,
  "senderName": "张三",
  "receiverId": 124,
  "receiverName": "李四",
  "friendshipId": 5,
  "timestamp": "2023-05-20T15:15:00.000Z"
}
```

#### 好友请求拒绝事件
```json
{
  "type": "friend_event",
  "eventType": "request_rejected",
  "requestId": 1,
  "senderId": 123,
  "senderName": "张三",
  "receiverId": 124,
  "receiverName": "李四",
  "timestamp": "2023-05-20T15:20:00.000Z"
}
```

#### 删除好友事件
```json
{
  "type": "friend_event",
  "eventType": "removed",
  "removerId": 123,
  "removerName": "张三",
  "removedUserId": 124,
  "removedUserName": "李四",
  "timestamp": "2023-05-20T15:25:00.000Z"
}
```

## 动态功能 API

### 1. 发布动态

**POST** `/api/moments`

发布新的动态，支持公共动态和好友动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 动态内容 |
| type | string | 否 | 动态类型：public(默认)、friend |
| visibility | string | 否 | 可见性：public(默认)、friends、private |

#### 权限规则
- 仅登录用户可以发布动态

#### 请求示例
```json
{
  "content": "今天天气真不错！",
  "type": "public",
  "visibility": "public"
}
```

#### 成功响应示例
```json
{
  "success": true,
  "message": "动态发布成功",
  "data": {
    "id": 1,
    "userId": 123,
    "content": "今天天气真不错！",
    "type": "public",
    "visibility": "public",
    "createdAt": "2023-05-20 15:00:00"
  }
}
```

---

### 2. 获取公共动态

**GET** `/api/moments/public`

获取所有公共动态，无需登录即可访问。

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取公共动态成功",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "username": "张三",
      "userAvatar": "https://example.com/avatar1.jpg",
      "content": "今天天气真不错！",
      "type": "public",
      "visibility": "public",
      "createdAt": "2023-05-20 15:00:00",
      "likeCount": 5,
      "commentCount": 2
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 3. 获取我的动态

**GET** `/api/moments/my`

获取当前用户发布的所有动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取我的动态成功",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "username": "张三",
      "userAvatar": "https://example.com/avatar1.jpg",
      "content": "今天天气真不错！",
      "type": "public",
      "visibility": "public",
      "createdAt": "2023-05-20 15:00:00",
      "likeCount": 5,
      "commentCount": 2
    }
  ]
}
```

---

### 4. 获取特定用户动态

**GET** `/api/moments/user/{userId}`

获取指定用户发布的公共动态。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取用户动态成功",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "username": "张三",
      "userAvatar": "https://example.com/avatar1.jpg",
      "content": "今天天气真不错！",
      "type": "public",
      "visibility": "public",
      "createdAt": "2023-05-20 15:00:00",
      "likeCount": 5,
      "commentCount": 2
    }
  ]
}
```

---

### 5. 获取好友动态

**GET** `/api/moments/friends`

获取当前用户及其好友发布的动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取好友动态成功",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "username": "张三",
      "userAvatar": "https://example.com/avatar1.jpg",
      "content": "今天天气真不错！",
      "type": "friend",
      "visibility": "friends",
      "createdAt": "2023-05-20 15:00:00",
      "likeCount": 5,
      "commentCount": 2
    }
  ]
}
```

---

### 6. 获取关注用户动态

**GET** `/api/moments/following`

获取当前用户关注的用户发布的公共动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取关注用户动态成功",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "username": "张三",
      "userAvatar": "https://example.com/avatar1.jpg",
      "content": "今天天气真不错！",
      "type": "public",
      "visibility": "public",
      "createdAt": "2023-05-20 15:00:00",
      "likeCount": 5,
      "commentCount": 2
    }
  ]
}
```

---

### 7. 获取动态详情

**GET** `/api/moments/{momentId}`

获取指定动态的详细信息。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 是 | 动态ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取动态详情成功",
  "data": {
    "id": 1,
    "userId": 123,
    "username": "张三",
    "userAvatar": "https://example.com/avatar1.jpg",
    "content": "今天天气真不错！",
    "type": "public",
    "visibility": "public",
    "createdAt": "2023-05-20 15:00:00",
    "likeCount": 5,
    "commentCount": 2
  }
}
```

---

### 8. 更新动态

**PUT** `/api/moments/{momentId}`

更新当前用户发布的动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 是 | 动态ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 否 | 动态内容 |
| type | string | 否 | 动态类型：public、friend |
| visibility | string | 否 | 可见性：public、friends、private |

#### 权限规则
- 仅动态发布者可以更新动态

#### 成功响应示例
```json
{
  "success": true,
  "message": "动态更新成功"
}
```

---

### 9. 删除动态

**DELETE** `/api/moments/{momentId}`

删除当前用户发布的动态。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 是 | 动态ID |

#### 权限规则
- 仅动态发布者可以删除动态

#### 成功响应示例
```json
{
  "success": true,
  "message": "动态删除成功"
}
```

---

## 关注功能 API

### 1. 关注用户

**POST** `/api/follow`

关注指定用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| followingId | number | 是 | 被关注用户ID |

#### 权限规则
- 不能关注自己

#### 成功响应示例
```json
{
  "success": true,
  "message": "关注成功",
  "data": {
    "id": 1,
    "status": "active"
  }
}
```

---

### 2. 取消关注

**DELETE** `/api/follow/{followingId}`

取消关注指定用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| followingId | number | 是 | 被取消关注用户ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "取消关注成功"
}
```

---

### 3. 检查关注状态

**GET** `/api/follow/check/{followingId}`

检查当前用户是否关注了指定用户。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| followingId | number | 是 | 被检查用户ID |

#### 成功响应示例
```json
{
  "success": true,
  "message": "检查关注状态成功",
  "data": {
    "isFollowing": true
  }
}
```

---

### 4. 获取关注列表

**GET** `/api/follow/following/{userId}`

获取指定用户的关注列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取关注列表成功",
  "data": {
    "followingList": [
      {
        "id": 1,
        "followingId": 124,
        "username": "李四",
        "registration_order": 2,
        "createdAt": "2023-05-20 15:00:00"
      }
    ],
    "followingCount": 5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 5,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

### 5. 获取粉丝列表

**GET** `/api/follow/followers/{userId}`

获取指定用户的粉丝列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取粉丝列表成功",
  "data": {
    "followerList": [
      {
        "id": 1,
        "followerId": 125,
        "username": "王五",
        "registration_order": 3,
        "createdAt": "2023-05-20 15:00:00"
      }
    ],
    "followerCount": 10,
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 10,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## 评论功能 API

### 1. 创建评论

**POST** `/api/comments`

对动态或帖子发表评论或回复评论。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 否 | 动态ID（与postId二选一） |
| postId | number | 否 | 帖子ID（与momentId二选一） |
| content | string | 是 | 评论内容 |
| parentId | number | 否 | 回复的评论ID（如果不为空则是回复评论） |

#### 成功响应示例
```json
{
  "success": true,
  "message": "评论创建成功",
  "data": {
    "id": 1,
    "userId": 123,
    "momentId": 1,
    "content": "不错的动态！",
    "parentId": null,
    "createdAt": "2023-05-20 15:30:00"
  }
}
```

---

### 2. 获取动态评论

**GET** `/api/comments/moment/{momentId}`

获取指定动态的评论列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 是 | 动态ID |

### 3. 获取帖子评论

**GET** `/api/comments/post/{postId}`

获取指定帖子的评论列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| postId | number | 是 | 帖子ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取评论成功",
  "data": [
    {
      "id": 1,
      "userId": 124,
      "username": "李四",
      "userAvatar": "https://example.com/avatar2.jpg",
      "content": "不错的动态！",
      "createdAt": "2023-05-20 15:30:00"
    }
  ]
}
```

---

### 4. 获取评论回复

**GET** `/api/comments/reply/{commentId}`

获取指定评论的回复列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| commentId | number | 是 | 评论ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取回复成功",
  "data": [
    {
      "id": 2,
      "userId": 125,
      "username": "王五",
      "userAvatar": "https://example.com/avatar3.jpg",
      "content": "我也这么认为",
      "createdAt": "2023-05-20 15:35:00"
    }
  ]
}
```

---

### 5. 更新评论

**PUT** `/api/comments/{commentId}`

更新当前用户发布的评论。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| commentId | number | 是 | 评论ID |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| content | string | 是 | 新的评论内容 |

#### 权限规则
- 仅评论发布者可以更新评论

#### 成功响应示例
```json
{
  "success": true,
  "message": "评论更新成功"
}
```

---

### 6. 删除评论

**DELETE** `/api/comments/{commentId}`

删除当前用户发布的评论。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| commentId | number | 是 | 评论ID |

#### 权限规则
- 仅评论发布者可以删除评论

#### 成功响应示例
```json
{
  "success": true,
  "message": "评论删除成功"
}
```

---

## 点赞功能 API

### 1. 点赞动态或帖子

**POST** `/api/likes`

对动态或帖子点赞。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 否 | 动态ID（与postId二选一） |
| postId | number | 否 | 帖子ID（与momentId二选一） |

#### 成功响应示例
```json
{
  "success": true,
  "message": "点赞成功",
  "data": {
    "id": 1,
    "status": "active"
  }
}
```

---

### 2. 取消点赞动态或帖子

**DELETE** `/api/likes/{targetId}`

取消对动态或帖子的点赞。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| targetId | number | 是 | 目标ID（动态ID或帖子ID） |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| targetType | string | 是 | 目标类型（moment或post） |

#### 成功响应示例
```json
{
  "success": true,
  "message": "取消点赞成功"
}
```

---

### 3. 检查点赞状态

**GET** `/api/likes/check/{targetId}`

检查当前用户是否对指定动态或帖子点赞。

#### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| targetId | number | 是 | 目标ID（动态ID或帖子ID） |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| targetType | string | 是 | 目标类型（moment或post） |

#### 成功响应示例
```json
{
  "success": true,
  "message": "检查点赞状态成功",
  "data": {
    "isLiked": true
  }
}
```

---

### 4. 获取动态点赞列表

**GET** `/api/likes/moment/{momentId}`

获取对指定动态点赞的用户列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| momentId | number | 是 | 动态ID |

### 5. 获取帖子点赞列表

**GET** `/api/likes/post/{postId}`

获取对指定帖子点赞的用户列表。

#### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| postId | number | 是 | 帖子ID |

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认10 |

#### 成功响应示例
```json
{
  "success": true,
  "message": "获取点赞列表成功",
  "data": {
    "likes": [
      {
        "id": 1,
        "userId": 124,
        "username": "李四",
        "registration_order": 2,
        "createdAt": "2023-05-20 15:40:00"
      }
    ],
    "likeCount": 5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 5,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

### MQTT WebSocket客户端实现示例

以下是一个简单的MQTT WebSocket客户端实现示例：

```javascript
class MQTTWebSocketClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.messageHandlers = [];
    this.messageId = 1;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      // 发送连接认证请求
      this.ws.send(JSON.stringify({
        type: 'connect',
        token: this.token
      }));
    };

    this.ws.onmessage = (event) => {
      const packet = JSON.parse(event.data);
      
      switch(packet.type) {
        case 'connack':
          if (packet.returnCode === 0) {
            console.log('MQTT连接认证成功');
          } else {
            console.error('MQTT连接认证失败');
          }
          break;
          
        case 'publish':
          // 处理收到的消息
          this.handleMessage(packet.payload);
          break;
          
        case 'suback':
          console.log('订阅操作完成');
          break;
          
        case 'pingresp':
          console.log('收到心跳响应');
          break;
      }
    };

    this.ws.onclose = () => {
      console.log('MQTT连接已关闭');
    };
  }

  subscribe(topic) {
    const messageId = this.messageId++;
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      topics: [topic],
      messageId: messageId
    }));
  }

  handleMessage(message) {
    // 触发消息处理函数
    this.messageHandlers.forEach(handler => handler(message));
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
const client = new MQTTWebSocketClient('wss://api-cofe.allons-y-uk:3009/mqtt', 'your-jwt-token');

client.connect();

// 订阅个人收件箱主题
fetch('/api/chat/user-inbox-topic', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
})
.then(response => response.json())
.then(data => {
  const inboxTopic = data.data.inboxTopic;
  client.subscribe(inboxTopic);
});

// 处理收到的消息
client.onMessage(message => {
  console.log('收到消息:', message);
});
```

### 消息类型组合参考表

下表展示了系统支持的所有 messageType 和 messageSubtype 组合：

| MessageType | MessageSubtype | 说明 | 是否支持文件信息 |
|-------------|----------------|------|------------------|
| `normal` | `text` | 普通文本消息 | ❌ |
| `normal` | `image` | 普通图片消息 | ✅ |
| `normal` | `video` | 普通视频消息 | ✅ |
| `normal` | `file` | 普通文件消息 | ✅ |
| `normal` | `markdown` | 普通Markdown消息 | ❌ |
| `normal` | `html` | 普通HTML消息 | ❌ |
| `edited` | `text` | 编辑的文本消息 | ❌ |
| `edited` | `image` | 编辑的图片消息 | ✅ |
| `edited` | `video` | 编辑的视频消息 | ✅ |
| `edited` | `file` | 编辑的文件消息 | ✅ |
| `edited` | `markdown` | 编辑的Markdown消息 | ❌ |
| `edited` | `html` | 编辑的HTML消息 | ❌ |
| `forwarded` | `text` | 转发的文本消息 | ❌ |
| `forwarded` | `image` | 转发的图片消息 | ✅ |
| `forwarded` | `video` | 转发的视频消息 | ✅ |
| `forwarded` | `file` | 转发的文件消息 | ✅ |
| `forwarded` | `markdown` | 转发的Markdown消息 | ❌ |
| `forwarded` | `html` | 转发的HTML消息 | ❌ |
| `quoted` | `text` | 引用的文本消息 | ❌ |
| `quoted` | `image` | 引用的图片消息 | ✅ |
| `quoted` | `video` | 引用的视频消息 | ✅ |
| `quoted` | `file` | 引用的文件消息 | ✅ |
| `quoted` | `markdown` | 引用的Markdown消息 | ❌ |
| `quoted` | `html` | 引用的HTML消息 | ❌ |
| `recalled` | `text` | 撤回的文本消息 | ❌ |
| `recalled` | `image` | 撤回的图片消息 | ❌ |
| `recalled` | `video` | 撤回的视频消息 | ❌ |
| `recalled` | `file` | 撤回的文件消息 | ❌ |
| `recalled` | `markdown` | 撤回的Markdown消息 | ❌ |
| `recalled` | `html` | 撤回的HTML消息 | ❌ |

### 消息来源类型参考表

| SourceType | 说明 |
|------------|------|
| `chatroom` | 来自公共聊天室的消息 |
| `topic` | 来自特定话题的消息 |
| `private` | 来自私聊的消息 |

### 注意事项

1. **文件信息字段**：当 messageSubtype 为 `image`、`video` 或 `file` 时，消息对象会包含 `fileInfo` 字段
2. **撤回消息**：撤回消息只保留基本元数据，不包含原始内容
3. **编辑消息**：包含 `editHistory` 数组记录编辑历史
4. **转发消息**：包含 `originalMessage` 对象记录原始消息信息
5. **引用消息**：包含 `quotedMessage` 对象记录被引用的消息信息
6. **消息来源标识**：使用 `sourceType` 字段标识消息来源（chatroom、topic、private）

## 社区功能 API

### 社区管理

#### 创建社区
**POST** `/api/communities`

创建一个新的社区。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 是 | 社区名称（1-100字符） |
| description | string | 否 | 社区描述（最多500字符） |
| type | string | 否 | 社区类型（public/private，默认public） |
| join_policy | string | 否 | 加入方式（open/approval/invitation_only，默认open） |
| avatar_url | string | 否 | 社区头像URL |
| banner_url | string | 否 | 社区横幅URL |

##### 请求示例
```json
{
  "name": "技术交流社区",
  "description": "一个关于技术交流的社区",
  "type": "public",
  "join_policy": "open"
}
```

##### 成功响应示例
```json
{
  "message": "社区创建成功",
  "community": {
    "id": 1,
    "name": "技术交流社区",
    "description": "一个关于技术交流的社区",
    "type": "public",
    "join_policy": "open",
    "avatar_url": null,
    "banner_url": null,
    "member_count": 1,
    "post_count": 0,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 获取社区详情
**GET** `/api/communities/:id`

获取指定社区的详细信息。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 成功响应示例
```json
{
  "community": {
    "id": 1,
    "name": "技术交流社区",
    "description": "一个关于技术交流的社区",
    "type": "public",
    "join_policy": "open",
    "avatar_url": null,
    "banner_url": null,
    "member_count": 5,
    "post_count": 10,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1,
    "user_role": "member", // 当前用户的角色，如果没有登录则为null
    "linked_topic_id": 789
  }
}
```

---

#### 获取社区列表
**GET** `/api/communities`

获取所有活跃社区的列表。

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大100 |

##### 成功响应示例
```json
{
  "communities": [
    {
      "id": 1,
      "name": "技术交流社区",
      "description": "一个关于技术交流的社区",
      "type": "public",
      "join_policy": "open",
      "avatar_url": null,
      "banner_url": null,
      "member_count": 5,
      "post_count": 10,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

---

#### 搜索社区
**GET** `/api/communities/search/:query`

根据关键词搜索社区。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大100 |

##### 成功响应示例
```json
{
  "communities": [
    {
      "id": 1,
      "name": "技术交流社区",
      "description": "一个关于技术交流的社区",
      "type": "public",
      "join_policy": "open",
      "avatar_url": null,
      "banner_url": null,
      "member_count": 5,
      "post_count": 10,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

#### 获取推荐社区
**GET** `/api/communities/recommended`

获取推荐的社区列表。

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| limit | number | 否 | 返回数量，默认为10，最大50 |

##### 成功响应示例
```json
{
  "communities": [
    {
      "id": 1,
      "name": "技术交流社区",
      "description": "一个关于技术交流的社区",
      "type": "public",
      "join_policy": "open",
      "avatar_url": null,
      "banner_url": null,
      "member_count": 100,
      "post_count": 50,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 获取用户创建的社区
**GET** `/api/communities/my/created`

获取当前用户创建的社区列表。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大100 |

##### 成功响应示例
```json
{
  "communities": [
    {
      "id": 1,
      "name": "我的技术社区",
      "description": "我创建的技术交流社区",
      "type": "public",
      "join_policy": "open",
      "avatar_url": null,
      "banner_url": null,
      "member_count": 5,
      "post_count": 10,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 获取用户加入的社区
**GET** `/api/communities/my/joined`

获取当前用户加入的社区列表。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大100 |

##### 成功响应示例
```json
{
  "communities": [
    {
      "id": 1,
      "name": "技术交流社区",
      "description": "一个关于技术交流的社区",
      "type": "public",
      "join_policy": "open",
      "avatar_url": null,
      "banner_url": null,
      "member_count": 5,
      "post_count": 10,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1,
      "user_role": "member"
    }
  ]
}
```

---

#### 更新社区信息
**PUT** `/api/communities/:id`

更新社区信息（仅社区所有者或管理员可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 否 | 社区名称（1-100字符） |
| description | string | 否 | 社区描述（最多500字符） |
| type | string | 否 | 社区类型（public/private） |
| join_policy | string | 否 | 加入方式（open/approval/invitation_only） |

##### 成功响应示例
```json
{
  "message": "社区更新成功",
  "community": {
    "id": 1,
    "name": "更新后的技术交流社区",
    "description": "更新后的社区描述",
    "type": "public",
    "join_policy": "approval",
    "avatar_url": null,
    "banner_url": null,
    "member_count": 5,
    "post_count": 10,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 上传圈子头像
**POST** `/api/communities/:id/avatar`

上传并设置指定社区（圈子）的头像图片。此接口要求使用者是该圈子的创作者或管理员。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 请求体 (multipart/form-data)
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| file | file | 是 | 头像图片文件 (最大5MB) |

##### 成功响应示例
```json
{
  "message": "圈子头像已更新",
  "community": {
    "id": 1,
    "name": "更新后的技术交流社区",
    "description": "更新后的社区描述",
    "type": "public",
    "join_policy": "approval",
    "avatar_url": "/uploads/avatars/e2a1bd76dbccdd98b7f8.jpg",
    "banner_url": null,
    "member_count": 5,
    "post_count": 10,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 加入社区
**POST** `/api/communities/:id/join`

加入指定社区。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 成功响应示例
```json
{
  "message": "成功加入社区"
}
```

---

#### 退出社区
**DELETE** `/api/communities/:id/leave`

退出指定社区。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 成功响应示例
```json
{
  "message": "成功退出社区"
}
```

---

#### 获取社区成员列表
**GET** `/api/communities/:id/members`

获取社区成员列表。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大100 |

##### 成功响应示例
```json
{
  "members": [
    {
      "id": 1,
      "user_id": 1,
      "username": "张三",
      "role": "owner",
      "joined_at": "2023-01-01 00:00:00",
      "is_active": 1
    },
    {
      "id": 2,
      "user_id": 2,
      "username": "李四",
      "role": "member",
      "joined_at": "2023-01-02 00:00:00",
      "is_active": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

#### 获取社区管理员列表
**GET** `/api/communities/:id/admins`

获取社区管理员列表（包括所有者、管理员和版主）。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 社区ID |

##### 成功响应示例
```json
{
  "admins": [
    {
      "id": 1,
      "user_id": 1,
      "username": "张三",
      "role": "owner",
      "joined_at": "2023-01-01 00:00:00",
      "is_active": 1
    },
    {
      "id": 2,
      "user_id": 2,
      "username": "李四",
      "role": "admin",
      "joined_at": "2023-01-02 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 设置成员角色
**POST** `/api/communities/:communityId/members/:userId/role`

设置社区成员的角色（仅社区所有者可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 是 | 社区ID |
| userId | number | 是 | 用户ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| role | string | 是 | 角色（admin/moderator/member） |

##### 成功响应示例
```json
{
  "message": "成员角色更新成功"
}
```

---

#### 移除社区成员
**DELETE** `/api/communities/:communityId/members/:userId`

从社区中移除成员（仅社区所有者或管理员可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 是 | 社区ID |
| userId | number | 是 | 用户ID |

##### 成功响应示例
```json
{
  "message": "成员已从社区移除"
}
```

### 帖子管理

#### 创建帖子
**POST** `/api/posts`

在社区或独立创建帖子。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| title | string | 是 | 帖子标题（1-200字符） |
| content | string | 是 | 帖子内容（1-10000字符） |
| community_id | number | 否 | 所属社区ID |
| subsection_id | number | 否 | 所属分区ID |
| tags | array | 否 | 标签数组 |
| type | string | 否 | 帖子类型（discussion/announcement/article/blog，默认discussion） |
| attachment_urls | array | 否 | 附件URL数组 |

##### 请求示例
```json
{
  "title": "如何学习JavaScript？",
  "content": "我想了解学习JavaScript的最佳方法...",
  "community_id": 1,
  "type": "discussion",
  "tags": ["编程", "JavaScript"]
}
```

##### 成功响应示例
```json
{
  "message": "帖子创建成功",
  "post": {
    "id": 1,
    "title": "如何学习JavaScript？",
    "content": "我想了解学习JavaScript的最佳方法...",
    "community_id": 1,
    "user_id": 1,
    "author_name": "张三",
    "author_avatar": "https://example.com/avatar1.jpg",
    "subsection_id": null,
    "tags": ["编程", "JavaScript"],
    "attachment_urls": null,
    "type": "discussion",
    "view_count": 0,
    "like_count": 0,
    "comment_count": 0,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 获取帖子详情
**GET** `/api/posts/:id`

获取指定帖子的详细信息。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 帖子ID |

##### 成功响应示例
```json
{
  "post": {
    "id": 1,
    "title": "如何学习JavaScript？",
    "content": "我想了解学习JavaScript的最佳方法...",
    "community_id": 1,
    "user_id": 1,
    "author_name": "张三",
    "community_name": "技术交流社区",
    "subsection_id": null,
    "subsection_name": null,
    "tags": ["编程", "JavaScript"],
    "attachment_urls": null,
    "type": "discussion",
    "view_count": 10,
    "like_count": 2,
    "comment_count": 3,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 获取社区帖子列表
**GET** `/api/posts/community/:communityId`

获取指定社区内的帖子列表。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 是 | 社区ID |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "如何学习JavaScript？",
      "content": "我想了解学习JavaScript的最佳方法...",
      "community_id": 1,
      "user_id": 1,
      "author_name": "张三",
      "community_name": "技术交流社区",
      "subsection_id": null,
      "subsection_name": null,
      "tags": ["编程", "JavaScript"],
      "attachment_urls": null,
      "type": "discussion",
      "view_count": 10,
      "like_count": 2,
      "comment_count": 3,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 获取分区帖子列表
**GET** `/api/posts/subsection/:subsectionId`

获取指定分区内的帖子列表。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| subsectionId | number | 是 | 分区ID |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "如何学习JavaScript？",
      "content": "我想了解学习JavaScript的最佳方法...",
      "community_id": 1,
      "user_id": 1,
      "author_name": "张三",
      "community_name": "技术交流社区",
      "subsection_id": 1,
      "subsection_name": "新手入门",
      "tags": ["编程", "JavaScript"],
      "attachment_urls": null,
      "type": "discussion",
      "view_count": 10,
      "like_count": 2,
      "comment_count": 3,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 获取用户发布的帖子
**GET** `/api/posts/user/:userId`

获取指定用户发布的帖子列表。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "如何学习JavaScript？",
      "content": "我想了解学习JavaScript的最佳方法...",
      "community_id": 1,
      "user_id": 1,
      "author_name": "张三",
      "community_name": "技术交流社区",
      "subsection_id": null,
      "subsection_name": null,
      "tags": ["编程", "JavaScript"],
      "attachment_urls": null,
      "type": "discussion",
      "view_count": 10,
      "like_count": 2,
      "comment_count": 3,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 获取所有帖子
**GET** `/api/posts`

获取所有帖子列表，可选择性筛选社区。

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 否 | 社区ID，用于筛选特定社区的帖子 |
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "如何学习JavaScript？",
      "content": "我想了解学习JavaScript的最佳方法...",
      "community_id": 1,
      "user_id": 1,
      "author_name": "张三",
      "community_name": "技术交流社区",
      "subsection_id": null,
      "subsection_name": null,
      "tags": ["编程", "JavaScript"],
      "attachment_urls": null,
      "type": "discussion",
      "view_count": 10,
      "like_count": 2,
      "comment_count": 3,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 搜索帖子
**GET** `/api/posts/search/:query`

根据关键词搜索帖子。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 否 | 社区ID，用于筛选特定社区的帖子 |
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "如何学习JavaScript？",
      "content": "我想了解学习JavaScript的最佳方法...",
      "community_id": 1,
      "user_id": 1,
      "author_name": "张三",
      "community_name": "技术交流社区",
      "subsection_id": null,
      "subsection_name": null,
      "tags": ["编程", "JavaScript"],
      "attachment_urls": null,
      "type": "discussion",
      "view_count": 10,
      "like_count": 2,
      "comment_count": 3,
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 更新帖子
**PUT** `/api/posts/:id`

更新帖子内容（仅帖子作者可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 帖子ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| title | string | 否 | 帖子标题（1-200字符） |
| content | string | 否 | 帖子内容（1-10000字符） |
| tags | array | 否 | 标签数组 |
| type | string | 否 | 帖子类型（discussion/announcement/article/blog） |

##### 成功响应示例
```json
{
  "message": "帖子更新成功",
  "post": {
    "id": 1,
    "title": "更新后的帖子标题",
    "content": "更新后的帖子内容...",
    "community_id": 1,
    "user_id": 1,
    "author_name": "张三",
    "author_avatar": "https://example.com/avatar1.jpg",
    "community_name": "技术交流社区",
    "subsection_id": null,
    "subsection_name": null,
    "tags": ["编程", "JavaScript", "更新"],
    "attachment_urls": null,
    "type": "discussion",
    "view_count": 10,
    "like_count": 2,
    "comment_count": 3,
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-02 00:00:00",
    "is_active": 1
  }
}
```

---

#### 删除帖子
**DELETE** `/api/posts/:id`

删除帖子（仅帖子作者可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 帖子ID |

##### 成功响应示例
```json
{
  "message": "帖子删除成功"
}
```

### 分区管理

#### 创建分区
**POST** `/api/subsections`

在社区中创建新的分区（仅社区所有者或管理员可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| community_id | number | 是 | 社区ID |
| name | string | 是 | 分区名称（1-100字符） |
| description | string | 否 | 分区描述（最多500字符） |
| order_num | number | 否 | 排序序号，默认为0 |

##### 请求示例
```json
{
  "community_id": 1,
  "name": "新手入门",
  "description": "为新手准备的入门讨论区",
  "order_num": 1
}
```

##### 成功响应示例
```json
{
  "message": "分区创建成功",
  "subsection": {
    "id": 1,
    "community_id": 1,
    "name": "新手入门",
    "description": "为新手准备的入门讨论区",
    "order_num": 1,
    "community_name": "技术交流社区",
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 获取分区详情
**GET** `/api/subsections/:id`

获取指定分区的详细信息。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分区ID |

##### 成功响应示例
```json
{
  "subsection": {
    "id": 1,
    "community_id": 1,
    "name": "新手入门",
    "description": "为新手准备的入门讨论区",
    "order_num": 1,
    "community_name": "技术交流社区",
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-01 00:00:00",
    "is_active": 1
  }
}
```

---

#### 获取社区的分区列表
**GET** `/api/subsections/community/:communityId`

获取指定社区的分区列表。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| communityId | number | 是 | 社区ID |

##### 成功响应示例
```json
{
  "subsections": [
    {
      "id": 1,
      "community_id": 1,
      "name": "新手入门",
      "description": "为新手准备的入门讨论区",
      "order_num": 1,
      "community_name": "技术交流社区",
      "created_at": "2023-01-01 00:00:00",
      "updated_at": "2023-01-01 00:00:00",
      "is_active": 1
    }
  ]
}
```

---

#### 更新分区
**PUT** `/api/subsections/:id`

更新分区信息（仅社区所有者或管理员可操作）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分区ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 否 | 分区名称（1-100字符） |
| description | string | 否 | 分区描述（最多500字符） |
| order_num | number | 否 | 排序序号 |

##### 成功响应示例
```json
{
  "message": "分区更新成功",
  "subsection": {
    "id": 1,
    "community_id": 1,
    "name": "更新后的分区名称",
    "description": "更新后的分区描述",
    "order_num": 2,
    "community_name": "技术交流社区",
    "created_at": "2023-01-01 00:00:00",
    "updated_at": "2023-01-02 00:00:00",
    "is_active": 1
  }
}
```

---

#### 删除分区
**DELETE** `/api/subsections/:id`

删除分区（仅社区所有者或管理员可操作，必须确保分区下没有帖子才能删除）。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分区ID |

##### 成功响应示例
```json
{
  "message": "分区删除成功"
}
```
### 8. 博客功能 API

#### 创建博客文章
**POST** `/api/blog`

创建一篇新的博客文章。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| title | string | 是 | 博客标题（1-200字符）|
| content | string | 是 | 博客内容（1-10000字符）|
| tags | array | 否 | 标签数组 |
| category_id | number | 否 | 分类ID |
| attachment_urls | array | 否 | 附件URL数组 |

##### 请求示例
```json
{
  "title": "我的第一篇博客",
  "content": "这是一篇关于...的博客",
  "tags": ["技术", "JavaScript"],
  "category_id": 1
}
```

##### 成功响应示例
```json
{
  "message": "博客文章创建成功",
  "post": {
    "id": 1,
    "title": "我的第一篇博客",
    "content": "这是一篇关于...的博客",
    "user_id": 1,
    "author_name": "张三",
    "author_avatar": "https://example.com/avatar1.jpg",
    "tags": ["技术", "JavaScript"],
    "category_id": 1,
    "type": "blog",
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 获取博客文章详情
**GET** `/api/blog/:id`

获取指定博客文章的详细信息。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 博客文章ID |

##### 成功响应示例
```json
{
  "post": {
    "id": 1,
    "title": "我的第一篇博客",
    "content": "这是一篇关于...的博客",
    "user_id": 1,
    "author_name": "张三",
    "author_avatar": "https://example.com/avatar1.jpg",
    "tags": ["技术", "JavaScript"],
    "category_id": 1,
    "type": "blog",
    "view_count": 10,
    "like_count": 2,
    "comment_count": 3,
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 获取用户博客列表
**GET** `/api/blog/user/:userId`

获取指定用户发布的所有博客文章。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "我的第一篇博客",
      "content": "这是一篇关于...的博客",
      "user_id": 1,
      "author_name": "张三",
      "author_avatar": "https://example.com/avatar1.jpg",
      "tags": ["技术", "JavaScript"],
      "category_id": 1,
      "type": "blog",
      "view_count": 10,
      "created_at": "2023-01-01 00:00:00"
    }
  ],
  "user_info": {
    "id": 1,
    "username": "zhangsan",
    "nickname": "张三"
  }
}
```

---

#### 获取所有博客文章
**GET** `/api/blog`

获取所有用户发布的博客文章。

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |
| tag | string | 否 | 按标签过滤 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "我的第一篇博客",
      "content": "这是一篇关于...的博客",
      "user_id": 1,
      "author_name": "张三",
      "author_avatar": "https://example.com/avatar1.jpg",
      "tags": ["技术", "JavaScript"],
      "category_id": 1,
      "type": "blog",
      "view_count": 10,
      "created_at": "2023-01-01 00:00:00"
    }
  ]
}
```

---

#### 搜索博客文章
**GET** `/api/blog/search/:query`

根据关键词搜索博客文章。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| query | string | 是 | 搜索关键词 |

##### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| page | number | 否 | 页码，默认为1 |
| limit | number | 否 | 每页数量，默认为20，最大50 |

##### 成功响应示例
```json
{
  "posts": [
    {
      "id": 1,
      "title": "我的第一篇博客",
      "content": "这是一篇关于...的博客",
      "user_id": 1,
      "author_name": "张三",
      "author_avatar": "https://example.com/avatar1.jpg",
      "tags": ["技术", "JavaScript"],
      "category_id": 1,
      "type": "blog",
      "view_count": 10,
      "created_at": "2023-01-01 00:00:00"
    }
  ]
}
```

---

#### 更新博客文章
**PUT** `/api/blog/:id`

更新指定的博客文章。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 博客文章ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| title | string | 否 | 博客标题（1-200字符）|
| content | string | 否 | 博客内容（1-10000字符）|
| tags | array | 否 | 标签数组 |
| category_id | number | 否 | 分类ID |

##### 成功响应示例
```json
{
  "message": "博客文章更新成功",
  "post": {
    "id": 1,
    "title": "我的第一篇博客（更新版）",
    "content": "这是一篇关于...的博客（更新版）",
    "user_id": 1,
    "author_name": "张三",
    "author_avatar": "https://example.com/avatar1.jpg",
    "tags": ["技术", "JavaScript", "更新"],
    "category_id": 1,
    "type": "blog",
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 删除博客文章
**DELETE** `/api/blog/:id`

删除指定的博客文章。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 博客文章ID |

##### 成功响应示例
```json
{
  "message": "博客文章删除成功"
}
```

---

#### 创建博客分类
**POST** `/api/blog/categories`

为当前用户创建一个新的博客分类。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 是 | 分类名称（1-50字符）|
| description | string | 否 | 分类描述（最多200字符）|

##### 请求示例
```json
{
  "name": "技术分享",
  "description": "技术相关的文章分享"
}
```

##### 成功响应示例
```json
{
  "message": "博客分类创建成功",
  "category": {
    "id": 1,
    "name": "技术分享",
    "description": "技术相关的文章分享",
    "user_id": 1,
    "post_count": 0,
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 获取用户博客分类列表
**GET** `/api/blog/categories/user/:userId`

获取指定用户的所有博客分类。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userId | number | 是 | 用户ID |

##### 成功响应示例
```json
{
  "categories": [
    {
      "id": 1,
      "name": "技术分享",
      "description": "技术相关的文章分享",
      "user_id": 1,
      "post_count": 5,
      "created_at": "2023-01-01 00:00:00"
    }
  ]
}
```

---

#### 获取博客分类详情
**GET** `/api/blog/categories/:id`

获取指定博客分类的详细信息。

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分类ID |

##### 成功响应示例
```json
{
  "category": {
    "id": 1,
    "name": "技术分享",
    "description": "技术相关的文章分享",
    "user_id": 1,
    "post_count": 5,
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 更新博客分类
**PUT** `/api/blog/categories/:id`

更新指定的博客分类。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分类ID |

##### 请求参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| name | string | 否 | 分类名称（1-50字符）|
| description | string | 否 | 分类描述（最多200字符）|

##### 成功响应示例
```json
{
  "message": "博客分类更新成功",
  "category": {
    "id": 1,
    "name": "技术分享（更新）",
    "description": "更新后的描述",
    "user_id": 1,
    "post_count": 5,
    "created_at": "2023-01-01 00:00:00"
  }
}
```

---

#### 删除博客分类
**DELETE** `/api/blog/categories/:id`

删除指定的博客分类。

##### 请求头
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer 访问令牌 |

##### 路径参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | number | 是 | 分类ID |

##### 成功响应示例
```json
{
  "message": "博客分类删除成功"
}
```

---
### 8. API 特性

---

### OIDC MQTT 无缝登录流程

我们实现了一套基于MQTT的无缝登录流程，允许客户端在不通过URL回调传递Token的情况下完成登录。

#### 1. 获取预登录参数
**GET** `/api/auth/oidc/pre-login`

获取用于MQTT连接和认证的安全参数。

##### 成功响应示例
```json
{
  "success": true,
  "data": {
    "secureString": "f8a9...", // 32字节十六进制字符串，用于MQTT连接Token和订阅主题
    "authString": "1a2b..."    // 16字节十六进制字符串，用于WebSocket认证验证
  }
}
```

#### 2. 建立MQTT连接
客户端使用WebSocket连接到MQTT服务器，并使用`secureString`作为Token进行连接（替代JWT）。

- **连接地址**: `wss://api-cofe.allons-y.uk:3009/mqtt`
- **连接参数**:
  - `token`: `{secureString}` (来自第一步)

#### 3. 订阅登录频道
连接成功后（收到`connack` returnCode=0），客户端需订阅以下主题以接收登录结果：

- **订阅主题**: `oidc/login/{secureString}`

#### 4. 发送认证请求
订阅成功后，客户端需向验证频道发送`authString`以证明身份。

- **发布主题**: `oidc/verify/{secureString}`
- **消息内容**: `{authString}` (纯文本)

#### 5. 用户登录
客户端打开浏览器访问OIDC登录页面，并携带`secureString`作为`s`参数。

- **登录URL**: `/api/auth/oidc/login?s={secureString}`

#### 6. 接收Token
用户在浏览器完成登录后，后端会自动验证`secureString`关联的MQTT会话，并通过MQTT广播Token。

- **接收主题**: `oidc/login/{secureString}`
- **消息格式**:
```json
{
  "success": true,
  "token": "eyJhbGci...", // 用户JWT Token
  "user": {
    "id": 123,
    "username": "张三",
    "email": "zhangsan@example.com",
    "emailVerified": true
  }
}
```

收到Token后，客户端即可断开临时的MQTT连接，使用Token建立正式的 authenticated MQTT 连接。
