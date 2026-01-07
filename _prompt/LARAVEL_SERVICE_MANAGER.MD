现在增加一项Create service with proxy，反代到指定域名，注意域名通过输入，使用空格或, ; 等符号分割。由php处理，查看
  poly_apps/laravel_main/app/Apps/ServerManagerV1 ，反代时需要先跑一遍 C (Create systemd service)
  的过程。同时查看php是否在反代时，如果 域名配置存在会自动申请ssh证书，或者有证书时会自动启用。