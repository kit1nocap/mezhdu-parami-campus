FROM node:24-bookworm-slim
WORKDIR /app

COPY local.mjs worker.mjs ./
COPY server/ server/
COPY drizzle/ drizzle/
COPY public/ public/

ENV CAMPUS_BIND_HOST=0.0.0.0 \
    CAMPUS_PORT=8080 \
    CAMPUS_DATA_DIR=/data \
    CAMPUS_HTTPS_PROXY=1 \
    CAMPUS_PASSWORD_ONLY=1

EXPOSE 8080
CMD ["node", "local.mjs"]
