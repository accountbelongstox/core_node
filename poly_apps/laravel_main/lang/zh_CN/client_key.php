<?php

return [
    'client_key_missing' => '需要客户端密钥签名，或本服务器未安装共享客户端密钥。',
    'client_key_unknown' => '本服务器不认识该客户端密钥 ID。',
    'client_key_protocol_invalid' => '客户端、协议版本或机器 ID 请求头无效。',
    'client_key_timestamp_invalid' => '请求时间戳缺失或超出允许的时钟偏差。',
    'client_key_nonce_invalid' => '请求 nonce 缺失或格式错误。',
    'client_key_nonce_replayed' => '请求 nonce 已被使用。',
    'client_key_body_digest_invalid' => '请求体摘要与实际发送的请求体不一致。',
    'client_key_signature_invalid' => '客户端密钥签名无效。',
    'local_key_missing' => '未安装共享客户端密钥 :name；请运行 dd.sh 或 dd.cmd 解密密钥库。',
];
