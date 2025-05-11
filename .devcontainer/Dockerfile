FROM node:current-alpine3.21

# Install node dependencies
RUN npm install -g @vue/cli typescript

# Setup
RUN apk update && apk add --no-cache git bash curl build-base

# The devcontainer.json will handle the rest with postCreateCommand