#!/bin/bash

echo "========================================================================"
echo "                    Demo模式完整流程验证                                  "
echo "========================================================================"
echo ""

cd /www/programing/core_node/poly_apps/laravel_main

echo "[步骤1] 查看初始状�?
echo "------------------------------------------------------------------------"
php artisan tinker --execute="
\$stats = App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService::getStatistics('english');
echo '初始状态：' . PHP_EOL;
echo '  总词�? ' . \$stats['total_words'] . PHP_EOL;
echo '  已翻�? ' . \$stats['translated'] . PHP_EOL;
echo '  未翻�? ' . \$stats['untranslated'] . PHP_EOL;
"

echo ""
echo "[步骤2] 清理旧任�?
echo "------------------------------------------------------------------------"
cd /www/programing/core_node/apps/mcp-chrome
curl -s -X POST http://localhost:9000/api/task/reset-assigned | jq -r '"重置任务�? " + (.data.reset_count | tostring)'

echo ""
echo "[步骤3] 运行10个周期测�?
echo "------------------------------------------------------------------------"
python3 test-full-workflow.py

echo ""
echo "[步骤4] 查看最终状�?
echo "------------------------------------------------------------------------"
cd /www/programing/core_node/poly_apps/laravel_main
php artisan tinker --execute="
\$stats = App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService::getStatistics('english');
echo '最终状态：' . PHP_EOL;
echo '  总词�? ' . \$stats['total_words'] . PHP_EOL;
echo '  已翻�? ' . \$stats['translated'] . PHP_EOL;
echo '  未翻�? ' . \$stats['untranslated'] . PHP_EOL;
echo '' . PHP_EOL;
if (\$stats['untranslated'] == 25) {
    echo '�?Demo模式验证成功：未翻译词数未改�? . PHP_EOL;
} else {
    echo '�?警告：未翻译词数发生变化' . PHP_EOL;
}
"

echo ""
echo "[步骤5] 查看Demo完成的任务统�?
echo "------------------------------------------------------------------------"
curl -s http://localhost:9000/api/task/stats | jq '.data.stats'

echo ""
echo "========================================================================"
echo "                           验证完成                                      "
echo "========================================================================"
