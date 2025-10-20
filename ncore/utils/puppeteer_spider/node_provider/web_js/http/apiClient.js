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

class APIClient {
    constructor(apiURL, prefix = '', suffix = '') {
      this.apiURL = apiURL;
      this.prefix = prefix;
      this.suffix = suffix;
    }
  
    buildURL(methodName) {
      return `${this.prefix}${this.apiURL}${methodName}${this.suffix}`;
    }
  
    async get(methodName) {
      const url = this.buildURL(methodName);
      try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('GET request error:', error);
        throw error;
      }
    }
  
    async post(methodName, data) {
      const url = this.buildURL(methodName);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error('POST request error:', error);
        throw error;
      }
    }
  }
  
  export default APIClient;


//   // 导入类
//   import APIClient from './APIClient';
  
//   // 创建API客户端实例
//   const api = new APIClient('https://example.com/api/', 'prefix/', '/suffix');
  
//   // 发送GET请求
//   api.get('getData')
//     .then(data => console.log('GET response:', data))
//     .catch(error => console.error('GET error:', error));
  
//   // 发送POST请求
//   const postData = { key: 'value' };
//   api.post('submitData', postData)
//     .then(response => console.log('POST response:', response))
//     .catch(error => console.error('POST error:', error));
  