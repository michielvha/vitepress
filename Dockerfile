FROM node:current-alpine3.21

# Install node dependencies
RUN npm install -g @vue/cli typescript

# Setup
RUN apk update && apk add --no-cache git bash curl build-base && \
    cd docs && npm install && npm run docs:devc