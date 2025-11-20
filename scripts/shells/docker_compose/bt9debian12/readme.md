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

docker build -t bt9debian12img:latest . &&  docker stop bt9debian12 &&  docker rm bt9debian12 &&  docker run -d --name bt9debian12 bt9debian12img:latest && docker logs -f bt9debian12 && docker exec -it bt9debian12 bash
docker exec -it bt9debian12 bash

sudo docker build -t bt9debian12img:latest . && sudo docker stop bt9debian12 && sudo docker rm bt9debian12 && sudo docker run -d --name bt9debian12 bt9debian12img:latest && sudo docker logs -f bt9debian12 && sudo docker exec -it bt9debian12 bash

sudo docker login --username=accountbelongstox@163.com registry
