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
