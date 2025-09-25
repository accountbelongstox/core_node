FROM alpine:3.12

LABEL maintainer="docker@upshift.fr"

ENV NUT_VERSION 2.7.4
ENV UPS_NAME="ups"
ENV UPS_DESC="UPS"
ENV UPS_DRIVER="usbhid-ups"
ENV UPS_PORT="auto"
ENV API_PASSWORD=""
ENV ADMIN_PASSWORD=""
ENV SHUTDOWN_CMD="echo 'System shutdown not configured!'"



RUN set -ex; \
    echo "https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/main" > /etc/apk/repositories; \
    echo "https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/community" >> /etc/apk/repositories; \
    apk add --no-cache \
        openssh-client \
        libusb-compat; \
    apk add --no-cache --virtual .build-deps \
        libusb-compat-dev \
        build-base; \
    cd /tmp; \
    wget http://www.networkupstools.org/source/2.7/nut-$NUT_VERSION.tar.gz; \
    tar xfz nut-$NUT_VERSION.tar.gz; \
    cd nut-$NUT_VERSION; \
    ./configure \
        --prefix=/usr \
        --sysconfdir=/etc/nut \
        --disable-dependency-tracking \
        --enable-strip \
        --disable-static \
        --with-all=no \
        --with-usb=yes \
        --datadir=/usr/share/nut \
        --with-drvpath=/usr/share/nut \
        --with-statepath=/var/run/nut \
        --with-user=nut \
        --with-group=nut; \
    make install; \
    adduser -D -h /var/run/nut nut; \
    chgrp -R nut /etc/nut; \
    chmod -R o-rwx /etc/nut; \
    install -d -m 750 -o nut -g nut /var/run/nut; \
    rm -rf /tmp/nut-$NUT_VERSION.tar.gz /tmp/nut-$NUT_VERSION; \
    apk del .build-deps

COPY src /home/entrypoint
# RUN chmod +x /usr/local/bin/docker-entrypoint

WORKDIR /var/run/nut
# ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
# CMD ["bash", "/usr/local/bin/docker-entrypoint"]
EXPOSE 3493
