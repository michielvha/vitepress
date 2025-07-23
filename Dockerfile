FROM node:current-alpine3.21

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

# Expose the port VitePress preview uses
EXPOSE 4173

# Set the entrypoint to serve the built site
ENTRYPOINT ["npm", "run", "docs:preview", "--", "--host", "0.0.0.0", "--port", "4173"]