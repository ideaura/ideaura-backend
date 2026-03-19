const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);
const formatMessageTime = (...args) => time.formatMessageTime(...args);
const getRelativeTime = (...args) => time.getRelativeTime(...args);


/**
 * 批量查询多条消息的引用/转发消息信息
 * @param {number[]} messageIds  要查询的消息 ID 数组
 * @param {boolean} isPrivate    是否为私聊消息（使用 private_messages 表）
 * @returns {Promise<Object>}    Map<messageId, messageData>
 */
exports.getQuotedMessageInfoBatch = function (messageIds, isPrivate = false) {
    if (!messageIds || messageIds.length === 0) return Promise.resolve({});

    return new Promise((resolve, reject) => {
        const table = isPrivate ? 'private_messages' : 'messages';
        const userIdField = isPrivate ? 'm.sender_id' : 'm.user_id';
        const placeholders = messageIds.map(() => '?').join(',');

        db.all(
            `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar"
       FROM ${table} m
       JOIN users u ON ${userIdField} = u.id
       WHERE m.id IN (${placeholders})`,
            messageIds,
            (err, rows) => {
                if (err) return reject(err);

                const resultMap = {};
                for (const row of rows) {
                    const messageData = {
                        ...row,
                        created_at: formatLocalTime(row.created_at),
                        messageTime: formatMessageTime(row.created_at),
                        relativeTime: getRelativeTime(row.created_at),
                        messageType: row.message_type || 'normal',
                        isEdited: !!row.updated_at,
                        isRecalled: row.is_deleted === true,
                        isQuoted: !!row.quoted_message_id
                    };

                    if (messageData.isRecalled) {
                        messageData.content = '[消息已被撤回]';
                        delete messageData.quotedMessage;
                    }
                    resultMap[row.id] = messageData;
                }
                resolve(resultMap);
            }
        );
    });
};

/**
 * 批量查询多条消息的编辑历史
 * @param {number[]} messageIds  要查询编辑历史的消息 ID 数组
 * @param {boolean} isPrivate    是否为私聊消息
 * @returns {Promise<Object>}    Map<messageId, version[]>
 */
exports.getMessageVersionsBatch = function (messageIds, isPrivate = false) {
    if (!messageIds || messageIds.length === 0) return Promise.resolve({});

    return new Promise((resolve, reject) => {
        const messageType = isPrivate ? 'private' : 'public';
        const placeholders = messageIds.map(() => '?').join(',');

        db.all(
            `SELECT * FROM message_versions 
       WHERE message_id IN (${placeholders}) AND message_type = ?
       ORDER BY message_id, created_at DESC`,
            [...messageIds, messageType],
            (err, rows) => {
                if (err) return reject(err);

                // 初始化每个 ID 对应的空数组
                const resultMap = {};
                for (const id of messageIds) {
                    resultMap[id] = [];
                }

                for (const row of rows) {
                    if (!resultMap[row.message_id]) {
                        resultMap[row.message_id] = [];
                    }
                    resultMap[row.message_id].push({
                        ...row,
                        created_at: formatLocalTime(row.created_at)
                    });
                }
                resolve(resultMap);
            }
        );
    });
};
