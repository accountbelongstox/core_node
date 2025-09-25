# Use official Debian image as base
FROM debian:bullseye

# Set build arguments with default value
ARG CLOUD_PROVIDER=huawei

# Set environment variables
ENV BACKUP_FILE="/backup/www_backup.tar.gz" \
    WEB_ROOT="/www" \
    NEED_MOUNT_MESSAGE="Please mount an empty directory to /www or include backup file at /backup/www_backup.tar.gz" \
    ENV_LOCAL="cn" \
    CLOUD_PROVIDER=${CLOUD_PROVIDER} \
    PUPPETEER_SKIP_DOWNLOAD=true

RUN mkdir -p /www /backup /scripts

COPY entrypoint.sh LGar.sh delete.sh /usr/local/bin/
COPY common /usr/local/bin/common/
COPY debian /usr/local/bin/debian/
COPY scripts /usr/local/bin/scripts/

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/LGar.sh \
    && chmod +x /usr/local/bin/delete.sh \
    && chmod -R +x /usr/local/bin/common/ \
    && chmod -R +x /usr/local/bin/debian/ \
    && chmod -R +x /usr/local/bin/scripts/

WORKDIR /www

EXPOSE 8888
EXPOSE 80 443
EXPOSE 22
EXPOSE 18000-19000
EXPOSE 3306 6379 5432 27017
EXPOSE 1433 3307 6380 5433 27018 27019

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]