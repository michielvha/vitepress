# Getting Started

This guide will help you get started with your VitePress documentation site.

## Development

To start the development server, run:

```bash
npm run docs:dev
```

This will start a local development server and you can visit your site at `http://localhost:5173`.

## Building

To build your site for production:

```bash
npm run docs:build
```

This will generate static files in the `.vitepress/dist` directory.

## Previewing the Build

To preview your built site:

```bash
npm run docs:preview
```

## Using Docker Dev Container

This project includes a dev container configuration. If you're using VS Code with the Remote - Containers extension:

1. Open the command palette (F1 or Ctrl+Shift+P)
2. Select "Remote-Containers: Reopen in Container"

This will build and start the development container with all necessary dependencies installed.

## Customizing Your Site

To customize your VitePress site, edit the `.vitepress/config.js` file. You can change the site title, description, and theme settings there.