# vitepress

# Test Production Docker file locally

We use a different dockerfile in the container since we rely on node for doing the development setup, to see if those changes also work in prod test locally:

```bash
docker build -t edgeforge-app .
docker run -p 8080:80 edgeforge-app -d
```
