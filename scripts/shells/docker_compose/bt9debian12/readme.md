docker build -t bt9debian12img:latest . &&  docker stop bt9debian12 &&  docker rm bt9debian12 &&  docker run -d --name bt9debian12 bt9debian12img:latest && docker logs -f bt9debian12 && docker exec -it bt9debian12 bash
docker exec -it bt9debian12 bash

sudo docker build -t bt9debian12img:latest . && sudo docker stop bt9debian12 && sudo docker rm bt9debian12 && sudo docker run -d --name bt9debian12 bt9debian12img:latest && sudo docker logs -f bt9debian12 && sudo docker exec -it bt9debian12 bash

sudo docker login --username=accountbelongstox@163.com registry
