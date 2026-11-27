# Builds the documentation site and serves it with nginx.
# The build context is the repository root, because the site reads the kit version from ../package.json:
#   docker build -f site/Dockerfile -t sdd-kit-docs .
#   docker run --rm -p 8080:80 sdd-kit-docs
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json ./
COPY site/package.json site/package-lock.json ./site/
RUN cd site && npm ci
COPY site ./site
RUN cd site && npm run build

FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/site/dist /usr/share/nginx/html
EXPOSE 80
