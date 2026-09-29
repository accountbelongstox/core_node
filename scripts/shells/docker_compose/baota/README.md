# Docker Configuration for Baota Panel

## Overview
This document provides the necessary details for configuring and running the Baota panel using Docker. The configuration includes the container setup, default login information, installed software packages, and system specifications.

## Default Login Information
To access the Baota panel, use the following default login credentials:

- **Login URL**: [http://127.0.0.1:8888/btadmin](http://127.0.0.1:8888/btadmin)
- **Username**: `admin`
- **Password**: `12345678`

## Default Software Installations
The following software packages are installed by default in the container:

- **PHP Versions**: PHP 5.6 to 8.3
- **MySQL Version**: MySQL 5.7
- **Nginx Version**: Nginx 1.27.1
- **Redis Version**: Redis 7.2.4
- **Node.js**: Node.js version 20 (not managed within the Baota project, available system-wide)
- **Python**: Python 3 (configured as the default Python version for the system)
- **Go Version**: Go version 1.22.5

## System Specifications
- **Base Operating System**: Debian 12
- **Docker Size**: The entire setup consumes approximately 7.7 GB.
## Description
This Docker Compose configuration is used to run a container named `baota`, primarily for deploying the Baota panel. Here is an explanation of each part:

- **image**: Specifies the image used by the container, which in this case is `cy00000000x/baota_advanced:latase`.
- **container_name**: Specifies the name of the container as `baota`.
- **ports**: Maps the internal ports of the container to the ports defined by environment variables on the host.
- **volumes**: Mounts a directory from the host into the container for data persistence.
- **restart**: Configures the container's restart policy to `always`, ensuring that the container automatically restarts after stopping.
- **links**: Defines links between containers, linking to several database services here.
- **privileged**: Grants privileged mode to the container.
- **command**: Executes a command upon container startup, first granting execute permission to the `/usr/baota/start.sh` script, then executing that script, and finally keeping the container running.

## Docker Compose Example
Here is the complete Docker Compose example:

```yaml
version: '3.8'

services:
  baota:
    image: cy00000000x/baota_advanced:latase
    container_name: baota
    ports:
      - "${BAOTA_ADMIN_PORT}:8888"
      - "${BAOTA_SSH_PORT}:22"
      - "${BAOTA_HTTPS_PORT}:443"
      - "${BAOTA_HTTP_ALT_PORT}:80"
      - "${BAOTA_BACKUP_PORT}:888"
      - "${GUARDIAN_MANAGEMENT_PORT}:889"
    volumes:
      # - /var/run/docker.sock:/var/run/docker.sock
      - ${BT_BASE_DIR}:/www
    restart: always
    links:
      - mysql84
      - mysql57
      - phpmyadmin57
      - phpmyadmin84
      - postgres
    privileged: true
    command: /bin/bash -c "chmod +x /usr/baota/start.sh && /usr/baota/start.sh && tail -f /dev/null"
```
## Docker Run Example
Here is an example command to run a container directly using the Docker CLI:

```
docker run -d \
  --name baota \
  -p ${BAOTA_ADMIN_PORT}:8888 \
  -p ${BAOTA_SSH_PORT}:22 \
  -p ${BAOTA_HTTPS_PORT}:443 \
  -p ${BAOTA_HTTP_ALT_PORT}:80 \
  -p ${BAOTA_BACKUP_PORT}:888 \
  -p ${GUARDIAN_MANAGEMENT_PORT}:889 \
  -v ${BT_BASE_DIR}:/www \
  --restart always \
  --privileged \
  192.168.100.6:15000/baota_advanced:latase \
  /bin/bash -c "chmod +x /usr/baota/start.sh && /usr/baota/start.sh && tail -f /dev/null"

```

## .env File Example
Here is an example of a .env file that defines the required environment variables:
```
# .env file for Docker Compose

# Baota Admin Port
BAOTA_ADMIN_PORT=8888

# Baota SSH Port
BAOTA_SSH_PORT=22

# Baota HTTPS Port
BAOTA_HTTPS_PORT=443

# Baota HTTP Alternate Port
BAOTA_HTTP_ALT_PORT=80

# Baota Backup Port
BAOTA_BACKUP_PORT=888

# Guardian Management Port
GUARDIAN_MANAGEMENT_PORT=889

# Base directory for Baota
BT_BASE_DIR=/path/to/your/www

```