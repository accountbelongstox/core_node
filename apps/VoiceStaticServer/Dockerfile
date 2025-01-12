FROM node:20.18-alpine3.21

# Set working directory
WORKDIR /app

# Set default app name
ENV APP_NAME=VoiceStaticServer

COPY entry.sh /entry.sh
RUN chmod +x /entry.sh

# Set environment variables
ENV NODE_ENV=development

# Use entry script as entrypoint with default app name
ENTRYPOINT ["/entry.sh"]
# Allow CMD to override the app name
CMD ["VoiceStaticServer"] 