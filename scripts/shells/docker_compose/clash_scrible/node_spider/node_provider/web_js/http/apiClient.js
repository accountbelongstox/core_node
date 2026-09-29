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
  