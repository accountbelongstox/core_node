#Start Command.
sudo node main.js app=VoiceStaticServer server debug
cd /www/wwwroot/core_node && git pull && systemctl stop VoiceStaticServer-node.service && node main.js app=Vo server
git add . && git commit -m "update" && node main.js app=VoiceStaticServer server debug
systemctl stop VoiceStaticServer-node.service
systemctl start VoiceStaticServer-node.service
git pull --no-ff && systemctl restart VoiceStaticServer-node.service
systemctl status VoiceStaticServer-node.service

#Server Test
systemctl stop VoiceStaticServer-node.service && sudo node main.js app=VoiceStaticServer server debug
