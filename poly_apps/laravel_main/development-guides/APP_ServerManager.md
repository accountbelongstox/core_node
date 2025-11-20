  
  
   CLI命令:
   # 部署Laravel应用
   (cd /www/wwwroot/core_node/poly_apps/laravel_main/ && php artisan servermanager:deploy example.com laravel)
   # SSL证书管理
   php artisan servermanager:ssl generate example.com
   php artisan servermanager:ssl config