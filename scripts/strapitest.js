const axios = require('axios');
const https = require('https');

// 配置 Strapi API 的基本信息
const strapiApiBaseUrl = 'http://localhost:1337';  // 修改为您的 Strapi API 基本 URL
const strapiUserEndpoint = 'tasks';  // 修改为您的内容类型 API 端点
const strapiApiToken = '18feade47d63d6cb109b79d5fb5c1618bbae462b955dd257bfe4bbd05414475790359e597efd00d74eda67429be997662388be906f326394d0c5703ccada51cbd2cac7e844dffc4847771a862ee94fab8f3b39efebc206d422dc491c747a15f9ed131536f175a7034d09050aa0f441be96523265cdff44555aff54e53c743433';  // 修改为您的 Strapi API 令牌

// 数据示例
const data = {
  tid: 'unique-id-123',
  dec: 'This is a description',
  promp: 'This is a prompt',
  pdoc: 'This is a document',
  pai: 'This is an AI-related text',
  strict: 'This is strict text',
  tested: true,
  ttime: '2024-08-01T12:00:00.000Z',
  pppublish: '2024-08-01T12:00:00.000Z'
};

// 创建 HTTPS Agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// 发送数据到 Strapi
async function sendDataToStrapi() {
  const url = `${strapiApiBaseUrl}/api/${strapiUserEndpoint}`;

  try {
    const response = await axios.post(url, { data }, {
      headers: {
        'Authorization': `Bearer ${strapiApiToken}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });

    console.log('响应数据:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('发送请求到 Strapi 时出错:', error.message);
      console.error('响应数据:', error.response?.data);
      console.error('响应状态码:', error.response?.status);
      console.error('响应头:', error.response?.headers);
    } else {
      console.error('未知错误:', error);
    }
  }
}

// 调用函数发送数据
sendDataToStrapi();
