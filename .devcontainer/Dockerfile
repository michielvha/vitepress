FROM node:24

# Install additional tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install git-core curl build-essential \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Set up global npm packages
RUN npm install -g @vue/cli typescript

# Set up the working directory
WORKDIR /workspace

# The devcontainer.json will handle the rest with postCreateCommand