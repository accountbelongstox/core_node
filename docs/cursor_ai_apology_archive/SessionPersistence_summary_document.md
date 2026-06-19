# SessionPersistence module - summary document 

to use HuTiGong `<content>` (SessionPersistence YuanMa ) JianMing summary . 

## structure 
- DanWenJian Node Lei `SessionPersistence`, YiLai `fs`, `path`, `logger`, `#@ncore/foundation/common/system_paths.js`. 
- GouZaoHanShuJieShou `profileName`, TongGuo `systemPaths` to sessionDir, userDataDir, cookiesPath, localStoragePath, sessionStatePath; Ling have autoSave XiangGuan char segment and page/browser Yin use . 
- method FenZu : Cookies (save/load) , LocalStorage (save/load) , SessionState (save/load) , saveAll/loadAll, startAutoSave/stopAutoSave, getLastUrl, clearAll, cleanup. 

## key points 
- ** HuiHuaShuJu **: GuanLi Cookies, LocalStorage, SessionState (lastUrl, lastTitle, timestamp, profileName) , LuJingJun by systemPaths An profile TiGong . 
- **Puppeteer JiCheng **: getUserDataDir(), setPageAndBrowser(page, browser); Ge save/load ZhiChiChuanRu page or use within Bu this.page. 
- ** ZiDongBaoCun **: startAutoSave(page?, intervalMs?), stopAutoSave(), MoRen 5000ms JianGeDiao use saveAll. 
- ** ShengMingZhouQi **: clearAll() ShanChuSuo have ChiJiuHuaWenJian ; cleanup() TingZhiZiDongBaoCun and QingKong page/browser Yin use . 

## purpose 
for Puppeteer etc. LiuLanQiZiDongHuaChangJingTiGongHuiHuaChiJiuHua : BaoCun and HuiFu cookies, localStorage, ZuiHouDaKaiYeMian and ChuangKouZhuangTai , Bian at DuanDianXu use or Fu use DengLuTai ; ZhiChiDuo profile and Ding when ZiDongBaoCun . 
