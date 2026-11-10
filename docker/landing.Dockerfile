# Marketing site (apps/landing) — plain HTML, no Node build.
#
# Coolify: Build Pack "Dockerfile", Base Directory "/", Dockerfile Location "/docker/landing.Dockerfile",
# port 80, domains https://<domain> and https://www.<domain>.
# Build variable: WEB3FORMS_ACCESS_KEY (contact form).

FROM alpine:3.20 AS build
ARG WEB3FORMS_ACCESS_KEY
WORKDIR /src
COPY apps/landing/ ./
RUN sh build.sh


FROM nginx:1.27-alpine
COPY docker/nginx-landing.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
