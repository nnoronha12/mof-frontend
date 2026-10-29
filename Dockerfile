# Build from the repository root or frontend/.
FROM node:22.23.3-alpine AS build

WORKDIR /context
COPY . .
RUN if [ -f frontend/package.json ]; then mv frontend /app; else mkdir -p /app && cp -a . /app; fi

WORKDIR /app

# Public endpoint configuration is compiled into the browser bundle.
ARG MOF_CONFIG_FILE=config/mof.env

RUN npm ci

RUN npm run build:web

FROM nginx:alpine

# Nginx expands PORT at container startup.
ENV PORT=8080

COPY --from=build /app/dist /usr/share/nginx/html

COPY --from=build /app/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
