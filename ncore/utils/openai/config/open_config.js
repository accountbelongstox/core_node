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

const config = {
    proxy_host: '127.0.0.1',
    proxy_port: 7890,
    proxy_protocol: 'http',
    hostname: 'api.deepbricks.ai',
    basePath: '/v1',
    completionsPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'gpt-4o-2024-08-06',
    timeout: 300000,
    o_secret: 'SECRET:DEEPBRICKS_API_KEY_1',
};

module.exports = config;
