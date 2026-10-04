FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_GIT_COMMIT
ARG VITE_GIT_DIRTY=false
RUN pnpm build

FROM nginx:alpine
LABEL org.opencontainers.image.title="CheeseCave Admin" \
      org.opencontainers.image.source="https://github.com/cheesecave/cheesecave-admin"
ENV BACKEND_UPSTREAM=http://hub-api:48888
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html/admin
COPY LICENSE LICENSING.md NOTICE.md /usr/share/doc/cheesecave-admin/
COPY provenance/ /usr/share/doc/cheesecave-admin/provenance/
EXPOSE 80
