# qy_capacitor (wordflow-ai)

### web dev (`/www/programing/core_node/`)

mkdir -p /www/programing/core_node/poly_apps/qy_capacitor/scripts/.logs && chmod +x /www/programing/core_node/poly_apps/qy_capacitor/scripts/start.sh
nohup /www/programing/core_node/poly_apps/qy_capacitor/scripts/start.sh > /www/programing/core_node/poly_apps/qy_capacitor/scripts/.logs/launcher.nohup.log 2>&1 &
tail -f /www/programing/core_node/poly_apps/qy_capacitor/scripts/.logs/launcher.nohup.log
sudo pkill -9 -f "/www/programing/core_node/poly_apps/qy_capacitor/scripts/start.sh"


### Kill `scripts/start.sh` (both roots)

sudo pkill -9 -f '(/www/programing/core_node|/home/ubuntu/wwwroot)/poly_apps/qy_capacitor/scripts/start\.sh'
