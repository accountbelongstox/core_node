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
    o_secret: `ENC:4931a63cd13635b02ad2401459174421:ca80b1b28a44cf5253e771295670fe507ab1b99d6a16beb95f97adcb0cdcc1940b3e3840f1a41e2a8f4aab02ee072a0d6fe7ef32337446cd516db51a5b834af8`,
};

module.exports = config;
