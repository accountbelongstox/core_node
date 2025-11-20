#!/usr/bin/env node
/**
 * VSCode Augment VIP 激活码生成器 (纯JavaScript版本)
 * 与extension.js中的最新TimeSyncCode算法完全一致
 * 更新日期: 2025-01-14
 */

const crypto = require('crypto');
const os = require('os');

class VscodeActivationGenerator {
    constructor() {
        this.isVipBuild = true; // VIP版本
        this.VIP_PREFIX = "VIP-";
        this.SECRET_KEY = this._computeSecretKey(true);
        this.ALGORITHM_VERSION = this._computeAlgorithmVersion(true);
    }

    /**
     * 计算密钥 (与原代码完全一致)
     */
    _computeSecretKey(isVip) {
        const keyArray = isVip ? 
            [32, 6, 20, 28, 22, 29, 5, 38, 4, 26, 30, 29, 20, 39, 48, 33, 112, 113, 112, 116, 34, 22, 24, 3, 22, 5, 58, 22, 24] : 
            [32, 6, 20, 28, 22, 29, 5, 38, 4, 26, 30, 29, 20, 112, 113, 112, 116, 34, 22, 24, 3, 22, 5, 58, 22, 24];
        
        const xorKey = parseInt("1110001", 2); // 113
        let result = "";
        
        keyArray.forEach(byte => {
            result += String.fromCharCode(byte ^ xorKey);
        });
        
        return result;
    }

    /**
     * 计算算法版本
     */
    _computeAlgorithmVersion(isVip) {
        const baseVersion = "v" + (3).toString() + ".0-";
        const tsyncSuffix = String.fromCharCode(84, 83, 89, 78, 67); // "TSYNC"
        
        if (isVip) {
            return baseVersion + "VIP" + "-" + tsyncSuffix;
        }
        return baseVersion + tsyncSuffix;
    }

    /**
     * 生成机器ID (与原代码完全一致)
     */
    generateMachineId() {
        try {
            const systemInfo = [
                os.hostname(),
                os.platform(),
                os.arch(),
                os.cpus()[0]?.model || "unknown",
                os.totalmem().toString(),
                process.env.USER || process.env.USERNAME || "unknown"
            ];
            
            if (this.isVipBuild) {
                systemInfo.push("VIP_EDITION");
            }
            
            const combinedInfo = systemInfo.join("|");
            const hash = crypto.createHash("sha256").update(combinedInfo).digest("hex");
            
            if (this.isVipBuild) {
                const shortHash = hash.substring(0, 12).toUpperCase().match(/.{4}/g).join("-");
                return `${this.VIP_PREFIX}${shortHash}`;
            }
            
            return hash.substring(0, 16).toUpperCase().match(/.{4}/g).join("-");
        } catch (error) {
            // 备用方案
            if (this.isVipBuild) {
                const fallback = crypto.randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g).join("-");
                return `${this.VIP_PREFIX}${fallback}`;
            }
            return crypto.randomBytes(8).toString("hex").toUpperCase().match(/.{4}/g).join("-");
        }
    }

    /**
     * 生成TimeSyncCode激活码 (与extension.js完全一致)
     */
    generateTimeSyncCode(machineId, timeStep = null) {
        try {
            if (timeStep === null) {
                timeStep = Math.floor(Date.now() / 1000 / 30);
            }
            
            const dataString = `${machineId}|${this.SECRET_KEY}|${this.ALGORITHM_VERSION}|VIP_PREMIUM`;
            
            // 创建HMAC密钥
            const hmacKey = crypto.createHash("sha256").update(dataString).digest().slice(0, 20);
            
            // 创建时间缓冲区
            const timeBuffer = Buffer.alloc(8);
            timeBuffer.writeUInt32BE(0, 0);
            timeBuffer.writeUInt32BE(timeStep, 4);
            
            // 计算HMAC
            const hmac = crypto.createHmac("sha1", hmacKey);
            hmac.update(timeBuffer);
            const digest = hmac.digest();
            
            // 动态截取
            const offset = digest[digest.length - 1] & 0x0F;
            const code = ((digest[offset] & 0x7F) << 24 |
                         (digest[offset + 1] & 0xFF) << 16 |
                         (digest[offset + 2] & 0xFF) << 8 |
                         (digest[offset + 3] & 0xFF)) % Math.pow(10, 8);
            
            return code.toString().padStart(8, "0");
        } catch (error) {
            console.error("生成TimeSyncCode失败:", error);
            return null;
        }
    }

    /**
     * 获取当前激活码
     */
    getCurrentActivationCode(machineId = null) {
        if (!machineId) {
            machineId = this.generateMachineId();
        }
        
        const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
        return this.generateTimeSyncCode(machineId, currentTimeStep);
    }

    /**
     * 验证激活码 (支持±1个时间窗口的容错)
     */
    validateActivationCode(machineId, inputCode) {
        const cleanCode = inputCode.replace(/[-\s]/g, "");
        
        if (!/^\d{8}$/.test(cleanCode)) {
            return false;
        }
        
        const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
        
        // 检查当前时间窗口和前后各1个时间窗口
        for (let offset = -1; offset <= 1; offset++) {
            const timeStep = currentTimeStep + offset;
            const validCode = this.generateTimeSyncCode(machineId, timeStep);
            
            if (validCode && cleanCode === validCode) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 获取完整的激活信息
     */
    getActivationInfo() {
        const machineId = this.generateMachineId();
        const activationCode = this.getCurrentActivationCode(machineId);
        
        return {
            machineId,
            activationCode,
            secretKey: this.SECRET_KEY,
            algorithmVersion: this.ALGORITHM_VERSION,
            isVipBuild: this.isVipBuild,
            timestamp: new Date().toISOString(),
            timeStep: Math.floor(Date.now() / 1000 / 30),
            nextRefreshIn: 30 - (Math.floor(Date.now() / 1000) % 30)
        };
    }

    /**
     * 显示详细的系统信息用于调试
     */
    debugSystemInfo() {
        const systemInfo = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0]?.model || "unknown",
            os.totalmem().toString(),
            process.env.USER || process.env.USERNAME || "unknown"
        ];
        
        if (this.isVipBuild) {
            systemInfo.push("VIP_EDITION");
        }
        
        console.log("=== 系统信息调试 ===");
        systemInfo.forEach((info, index) => {
            console.log(`[${index}] ${info}`);
        });
        
        const combinedInfo = systemInfo.join("|");
        console.log(`\n组合信息: ${combinedInfo}`);
        
        const hash = crypto.createHash("sha256").update(combinedInfo).digest("hex");
        console.log(`SHA256哈希: ${hash}`);
        console.log(`前12位: ${hash.substring(0, 12)}`);
        
        return systemInfo;
    }
}

// 使用示例
if (require.main === module) {
    const generator = new VscodeActivationGenerator();
    
    // 显示调试信息
    generator.debugSystemInfo();
    console.log();
    
    const info = generator.getActivationInfo();
    
    console.log("=== VSCode Augment VIP 激活信息 (Updated JavaScript版) ===");
    console.log(`机器ID: ${info.machineId}`);
    console.log(`当前激活码: ${info.activationCode}`);
    console.log(`算法版本: ${info.algorithmVersion} (TSYNC)`);
    console.log(`时间戳: ${info.timestamp}`);
    console.log(`下次刷新: ${info.nextRefreshIn}秒后`);
    
    // 验证测试
    console.log(`验证结果: ${generator.validateActivationCode(info.machineId, info.activationCode)}`);
}

module.exports = VscodeActivationGenerator;