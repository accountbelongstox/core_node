// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { useDataSourceStore } from '@/stores/datasource';

export default defineNuxtPlugin(async () => {
  const store = useDataSourceStore();
  
  // 客户端初始化
  if (process.client) {
    // 加载本地存储的配置
    store.loadFromLocalStorage();
    
    // 执行初始健康检查
    try {
      await store.performBatchHealthCheck();
    } catch (error) {
      console.warn('Initial health check failed:', error);
    }
    
    // 设置定期健康检查（每5分钟）
    setInterval(async () => {
      try {
        await store.performBatchHealthCheck();
      } catch (error) {
        console.warn('Periodic health check failed:', error);
      }
    }, 5 * 60 * 1000);
    
    // 监听网络状态变化
    if ('navigator' in window && 'onLine' in navigator) {
      const handleOnline = async () => {
        console.log('Network back online, performing health check...');
        await store.performBatchHealthCheck();
      };
      
      const handleOffline = () => {
        console.log('Network offline detected');
        // 可以在这里更新UI状态
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  }
});