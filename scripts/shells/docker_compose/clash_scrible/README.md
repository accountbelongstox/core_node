# Clash Subscribe

## Overview
- Clash Subscribe is a Docker container that connects to a service for managing proxy subscriptions.

## Docker Mounting Introduction
- In Docker, mounting is used to connect directories or files from the host filesystem to the container's internal directories or files. This allows data to be preserved during container runtime, facilitating persistence and sharing.

### Port Mapping
- **Default port mapping**: `18100:18100`
- This means that the host's port `18100` is mapped to the container's port `18100`. It can be overridden by command line arguments.

### Data Volume Mapping
- **Data volume mapping**: `/home/clash_subscribe_data/.data_cache:/app/data`
- This mounts the `/home/clash_subscribe_data/.data_cache` directory from the host to `/app/data` in the container, ensuring the container can access and store persistent data.
- The `/app/data` directory is used to store user-specific data and configurations.

## Docker Run Example
To run the Docker container, use the following command:
```
docker run -d --name "clash_subscribe" -u root -p 18100:18100 -p 18200:18200 -v "/home/clash_subscribe_data:/app/data" cy00000000x/clash_subscribe:latest
```

# Docker Compose Example
If using Docker Compose, you can define the service in a docker-compose.yml file as follows:

```
version: '3'
services:
  clash_subscribe:
    image: cy00000000x/clash_subscribe:latest
    ports:
      - "18100:18100"
      - "18200:18200"
    volumes:
      - /home/clash_subscribe_data/.data_cache:/app/data
```

## License
[Include license information here if applicable]

