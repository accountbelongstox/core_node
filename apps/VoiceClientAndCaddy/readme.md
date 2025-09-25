<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

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