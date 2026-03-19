const time = require('./time');

class AppState {
    constructor() {
        this.connectedClients = new Set();
        this.tempOidcStorage = new Map();

        // 每分钟清理一次过期的 OIDC 状态
        setInterval(() => this.cleanup(), 60 * 1000);
    }

    // --- OIDC 临时存储相关 ---
    setOidc(key, value, ttlMs = 5 * 60 * 1000) { // 默认 5 分钟
        const expiresAt = time.nowMs() + ttlMs;
        this.tempOidcStorage.set(key, { ...value, expiresAt });
    }

    getOidc(key) {
        const data = this.tempOidcStorage.get(key);
        if (!data) return null;

        if (time.nowMs() > data.expiresAt) {
            this.tempOidcStorage.delete(key);
            return null;
        }
        return data;
    }

    deleteOidc(key) {
        this.tempOidcStorage.delete(key);
    }

    hasOidc(key) {
        return this.getOidc(key) !== null;
    }

    // --- 连接客户端相关 ---
    addClient(clientId) {
        this.connectedClients.add(clientId);
    }

    removeClient(clientId) {
        this.connectedClients.delete(clientId);
    }

    getOnlineCount() {
        return this.connectedClients.size;
    }

    // --- 清理逻辑 ---
    cleanup() {
        const now = time.nowMs();
        for (const [key, data] of this.tempOidcStorage.entries()) {
            if (now > data.expiresAt) {
                this.tempOidcStorage.delete(key);
            }
        }
    }
}

// 导出单例
const appState = new AppState();
module.exports = appState;
