const base64String = "eyJ2IjoiMiIsInBzIjoiW3ZtZXNzXVx1OGZjN1x1NmVlNFx1NjM4OTEzXHU2NzYxXHU3ZWJmXHU4ZGVmIiwiYWRkIjoiY3Nnby5jb20iLCJwb3J0IjoiMjA5NSIsImlkIjoiYjk1MjAzMTEtNGUxMi00NWFhLWIzYjgtODYxYjBhODA3ZTUxIiwiYWlkIjoiMCIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0Ijoib3ZoLnRyb2phbi50ZWwiLCJwYXRoIjoiXC8iLCJ0bHMiOiIifQ==";

// 解码 Base64 字符串
const decodedString = Buffer.from(base64String, 'base64').toString('utf-8');

// 解析 JSON
try {
  const parsedData = JSON.parse(decodedString);
  console.log(parsedData);
} catch (error) {
  console.error('Error parsing JSON:', error);
}
