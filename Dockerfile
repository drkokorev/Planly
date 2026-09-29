# Planly — the whole instance in one container: the app plus the sync API.
#   docker build -t planly .
#   docker run -d -p 8080:8080 -v planly-data:/data --name planly planly
# Then open http://localhost:8080 (put it behind a reverse proxy with HTTPS for
# real use — service workers and "Add to Home Screen" need a secure origin).

FROM node:22-alpine

WORKDIR /app

# the app is a handful of static files plus a dependency-free Node server;
# they live in separate folders so the container never serves its own source
COPY index.html sw.js manifest.json ./public/
COPY icons ./public/icons
COPY server ./server

RUN mkdir -p /data && chown -R node:node /data /app

ENV PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public

# ALLOWED_CODES=AAAA-BBBB-CCCC-DDDD,EEEE-FFFF-GGGG-HHHH  restricts sync to those codes

USER node
EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/version.txt || exit 1

CMD ["node", "server/sync-node.js"]
