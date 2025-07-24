FROM node:current-alpine3.21 AS builder

# Install system dependencies
RUN apk update && apk add --no-cache git bash curl build-base

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Install dependencies and build
RUN cd docs && \
    npm install && \
    npm run docs:build

# Production stage - use nginx to serve static files
FROM nginx:alpine

# Copy the built site from builder stage
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]