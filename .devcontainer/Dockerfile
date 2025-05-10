FROM node:current-alpine3.21

# Install dependencies
RUN npm install -g @vue/cli typescript

# WORKDIR /workspaces/vitepress

# Setup: install bash, git, etc. (if needed)
RUN apk update && apk add --no-cache git bash curl build-base

# The devcontainer.json will handle the rest with postCreateCommand