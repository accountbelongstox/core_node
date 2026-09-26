<?php

return [
    'info_loaded' => '已加载交付信息。',
    'diff_computed' => '交付差异已计算。',
    'batch_registered' => '交付批次已登记。',
    'batch_content_received' => '已接收交付批次内容分块。',
    'batch_status_loaded' => '已加载交付批次状态。',
    'invalid_key' => '条目键不符合 "<lang>:<md5>[:<variant>]" 格式。',
    'delivery_validation_failed' => '交付请求无效。',
    'delivery_kind_unsupported' => '该接口不支持此交付类型。',
    'delivery_batch_too_large' => '批次超出单项或总大小限制，请拆分。',
    'delivery_batch_not_found' => '交付批次不存在或已过期，请重新登记清单。',
    'delivery_batch_content_mismatch' => '上传的批次内容与条目哈希不符，请重新登记清单并重新上传。',
    'delivery_upload_invalid' => '批次内容分块被拒绝（偏移、大小或哈希不匹配）。',
    'delivery_store_failed' => '已完成的批次内容无法保存。',
];
