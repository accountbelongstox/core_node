<?php

return [
    'api_description' => 'MeshSync：在所有 Laravel 服务器（公网域名与 mesh 路由）之间按“最后写入者胜出”复制记录。机器推送记录；服务器互相拉取变更流并传递对端列表。',
    'initialization_failed' => 'MeshSync 初始化失败：:resource。',
    'not_initialized' => 'MeshSync 数据表缺失，请在服务器上运行 php artisan sys:init。',
    'records_invalid' => 'records 必须是最多 :max 条记录的列表。',
    'query_invalid' => 'q 必须为 1 到 :max 个字符。',
    'peer_http_status' => '对端返回 HTTP :status：:message',
    'route_info' => '类库说明、本服务器 ID、最新变更序号、记录数与对端数。',
    'route_records' => '写入记录 [{stream, key, version, deleted, payload, search_text}]（机器或对端服务器）；可选 peers [{base_url, server_id}] 用于告知其他服务器。',
    'route_changes' => '供对端服务器拉取的变更流：序号游标 after 之后的记录、下一个游标，以及本服务器可达的对端。',
    'route_search' => '搜索文字包含 q 的有效记录，可用逗号分隔的 streams 限定，按最新排序。',
    'route_peers' => '本服务器复制的对端服务器及其游标与健康状态。',
];
