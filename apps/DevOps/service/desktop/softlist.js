'use strict';
const { Service } = require('@egg/ee-core');
const Log = require('@egg/ee-core/log');
const Ps = require('@egg/ee-core/ps');
const HttpClient = require('@egg/ee-core/httpclient');
const { gdir } = require('../../../../globalvars.js');
const { strtool, file } = require('../../../../utils.js');


class SoftlistService extends Service {

    constructor(ctx) {
        super(ctx);
    }

    //#TODO 2 写一个方法，async getSoftlistFromPublicDir() 先从gdir.getCwd（） 得到当前的根目录，并找到 gdir.getCwd（） + `public/softslist` 目录，读取其中的soft_group_v2.json 给result，读取其中的 soft_icons.json 给resultIcons ，然后参考getSoftlistFromApi函数将两个合并并返回
    async getSoftlistFromPublicDir() {
        try {
            // 获取当前工作目录
            const cwd = gdir.getCwd();
            // 构建软链接列表文件路径
            const softListPath = path.join(cwd, 'public/softslist/soft_group_v2.json');
            const iconListPath = path.join(cwd, 'public/softslist/soft_icons.json');

            // 读取soft_group_v2.json文件内容
            const softListContent = await fs.readFile(softListPath, 'utf-8');
            const softList = JSON.parse(softListContent);

            // 读取soft_icons.json文件内容
            const iconListContent = await fs.readFile(iconListPath, 'utf-8');
            const iconList = JSON.parse(iconListContent);

            // 合并两个JSON对象，这里简单地将图标数据附加到软件分组数据中，具体结构根据实际情况调整
            const combinedResult = {
                ...softList,
                icons: iconList
            };

            return combinedResult;
        } catch (error) {
            Log.error('SoftlistService.getSoftlistFromPublicDir', error);
            throw new Error('Failed to fetch soft list from public directory.');
        }
    }


    //#TODO 3 修改 getSoftlistFromApi 方法：先对softlistApiUrl 设置超时时间2秒，如果超时未连接网络，则调用 getSoftlistFromPublicDir 获取软件列表数据 关于hc.request如何超时，请查看  https://www.kaka996.com/pages/1a0cf7/
    async getSoftlistFromApi() {
        const res = [];
        const staticApiUrl = await gdir.getLocalStaticApiTestUrl();
    
        try {
            const hc = new HttpClient();
            const softlistApiUrl = staticApiUrl + `softlist/static_src/software_config/soft_group.json`;
            const iconsApiUrl = staticApiUrl + `softlist/static_src/software_config/soft_icons.json`;
    
            // 使用Promise.race来实现超时逻辑
            const response = await Promise.race([
                hc.request(softlistApiUrl, {
                    method: 'GET',
                    dataType: 'json'
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 2000)
                )
            ]);
    
            if (response instanceof Error) {
                Log.warn('SoftlistService.getSoftlistFromApi', 'Softlist API request timed out, falling back to local.');
                return this.getSoftlistFromPublicDir(); // 超时则调用本地获取方法
            }
    
            const result = response.data;
            if (Ps.isDev()) {
                Log.info('[getSoftlistFromApi]: info result:%j', strtool.truncate(result));
            }
            if (result.code !== 'success') {
                Log.error('[getSoftlistFromApi]: res error result:%j', strtool.truncate(result));
                throw new Error('Failed to fetch software list from API.');
            }
    
            // 类似地处理图标请求的超时
            const responseIcons = await Promise.race([
                hc.request(iconsApiUrl, {
                    method: 'GET',
                    dataType: 'json'
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 2000)
                )
            ]);
    
            if (responseIcons instanceof Error) {
                Log.warn('SoftlistService.getSoftlistFromApi', 'Icons API request timed out.');
                // 可能需要处理图标超时后的逻辑，比如是否继续使用已有数据
            }
    
            const resultIcons = responseIcons.data;
            if (Ps.isDev()) {
                Log.info('[getSoftlistFromApi]: info icons result:%j', strtool.truncate(resultIcons));
            }
            if (resultIcons.code !== 'success') {
                Log.error('[getSoftlistFromApi]: res error icons result:%j', strtool.truncate(resultIcons));
                // 处理图标数据获取失败的情况
            }
    
            // 合并数据的逻辑保持不变...
    
            return result; // 或者返回合并后的数据
        } catch (e) {
            Log.error('[SoftlistService.getSoftlistFromApi]', e);
            // 再次捕获异常时尝试从本地获取
            return this.getSoftlistFromPublicDir();
        }
    }
    

    async getSoftlistFromApiV2() {
        const res = [];
        const staticApiUrl = await gdir.getLocalStaticApiTestUrl()
        const ismanagerFile = gdir.getLocalInfoFile('.manager_rule.ini')
        const softlistGroupConfigFile = file.isFile(ismanagerFile) ? `soft_group_v2.json` : `soft_group_dev_v2.json`
        try {
            const hc = new HttpClient();
            const softlistApiUrl = staticApiUrl + `softlist/static_src/software_config/${softlistGroupConfigFile}`
            const response = await hc.request(softlistApiUrl, {
                method: 'GET',
                dataType: 'json',
                timeout: 15000,
            });
            let result = response.data;
            if (Ps.isDev()) {
                Log.info('[getSoftlistFromApiV2]: info result:%j', strtool.truncate(result));
            }
            if (result.code !== 'success') {
                Log.error('[getSoftlistFromApiV2]: res error result:%j', strtool.truncate(result));
            }
            return result;
        } catch (e) {
            Log.error('[getSoftlistFromApiV2]:  ERROR ', e);
        }
        return res;
    }

    async getIconsFromApiV2() {
        const hc = new HttpClient();
        const staticApiUrl = await gdir.getLocalStaticApiTestUrl()
        const iconsApiUrl = staticApiUrl + `softlist/static_src/software_config/soft_icons.json`
        const response = await hc.request(iconsApiUrl, {
            method: 'GET',
            dataType: 'json',
            timeout: 15000,
        });
        let result = response.data;
        if (Ps.isDev()) {
            Log.info('[getIconsFromApiV2]: info result:%j', strtool.truncate(result));
        }
        if (result.code !== 'success') {
            Log.error('[getIconsFromApiV2]: res error result:%j', strtool.truncate(result));
        }
        return result;;
    }
}

SoftlistService.toString = () => '[class SoftlistService]';
module.exports = SoftlistService;  