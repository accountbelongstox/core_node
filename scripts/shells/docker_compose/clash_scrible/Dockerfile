FROM docker.io/cy00000000x/nodebase:20
# FROM ghcr.io/cy00000000x/nodebase:20
USER root
# Set the working directory inside the container
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV IS_DOCKER=true 
# Configure npm to use Huawei source
RUN npm config set registry https://repo.huaweicloud.com/repository/npm/

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY package*.json ./
RUN yarn install

# Copy all files from the current directory to the container's working directory, excluding .devenv
COPY . .
RUN rm -f .devenv

# Indicate that /app/data is a volume that can be mounted externally
VOLUME /app/data

LABEL description="Clash Subscribe is a Docker container that connects to a service for managing proxy subscriptions."
LABEL usage="To run the Docker container, use the command: docker run -d --name 'clash_subscribe' -u root -p 18100:18100 -v '/host/path/to/data:/app/data' games129/clash_subscribe"

EXPOSE 18100 18200
# Specify the command to run your Node.js application
CMD ["yarn", "nodemon"]
