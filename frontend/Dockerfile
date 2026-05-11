FROM node:22-alpine AS build

WORKDIR /app

ARG PUBLIC_URL=/
ARG VITE_API_ORIGIN=https://backend.ecommerce.harshildex.com
ENV PUBLIC_URL=${PUBLIC_URL}
# Expose to vite.config.js process.env fallback (used when env/frontend/ is not present)
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
# Copy env/frontend/ so vite.config.js loadEnv picks up .env.production (envDir resolves to /env/frontend)
COPY env/frontend/ /env/frontend/
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
