# 使用 centos:7 作为基础镜像
FROM centos:7

# 环境变量
ARG EMAIL
ARG DNSPOD_ID
ARG DNSPOD_TOKEN
ARG DOMAIN

# 安装 EPEL, centos-release-scl 和其他必需的工具
RUN yum install -y epel-release && \
    yum install -y centos-release-scl && \
    yum install -y rh-python38 wget crontabs dnsutils && \
    yum clean all

# 创建必要的软链接和更新 PATH
RUN ln -s /opt/rh/rh-python38/root/usr/bin/python3 /usr/bin/python3 && \
    ln -s /opt/rh/rh-python38/root/usr/bin/pip3 /usr/bin/pip3 && \
    echo "export PATH=$PATH:/opt/rh/rh-python38/root/usr/bin/:/opt/rh/rh-python38/root/usr/local/bin" >> /etc/profile

# 刷新缓存
RUN hash -r

# 安装 certbot 和 certbot-dnspod
RUN pip3 install certbot certbot-dnspod

# 创建 dnspod.ini 文件用于认证
RUN mkdir -p ~/.secrets/certbot && \
    echo "certbot_dnspod_token_id = $DNSPOD_ID" > ~/.secrets/certbot/dnspod.ini && \
    echo "certbot_dnspod_token = $DNSPOD_TOKEN" >> ~/.secrets/certbot/dnspod.ini && \
    chmod 600 ~/.secrets/certbot/dnspod.ini

# 解析域名字符串，将其拆分为数组
RUN echo $DOMAIN | tr " " "\n" > /tmp/domains.txt

# 申请证书
RUN CERTBOT_ARGS="" && \
    while read domain; do \
        CERTBOT_ARGS="$CERTBOT_ARGS -d $domain"; \
    done < /tmp/domains.txt && \
    certbot certonly --authenticator certbot-dnspod --certbot-dnspod-credentials ~/.secrets/certbot/dnspod.ini --email $EMAIL $CERTBOT_ARGS --non-interactive --agree-tos --manual-public-ip-logging-ok

# 设置证书更新的 cron job
RUN echo "0 1 * * * /opt/rh/rh-python38/root/usr/local/bin/certbot renew --authenticator certbot-dnspod --certbot-dnspod-credentials ~/.secrets/certbot/dnspod.ini --deploy-hook 'service nginx reload' >> /var/log/cron.log 2>&1" > /etc/cron.d/cert-renew

# 启动 cron 服务
CMD ["crond", "-f"]