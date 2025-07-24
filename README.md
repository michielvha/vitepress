# edgeforge website

The main repository for the edgeforge website. Look into bootstrapping other repositories markdown files into here in some automated way for example edge cloud repository.

## Test Production Docker file locally

We use a different dockerfile in the container since we rely on node for doing the development setup, to see if those changes also work in prod test locally:

```bash
docker build -t edgeforge-app .
docker run -p 8080:80 edgeforge-app -d
```

## Blogs

- Gitversion
  - Custom action how to use and demo
- RootApps & Kustomize
- ArgoCD integration with azurekeyvault for auto join - same for when we do the one for AWS.
- Openshift
- the post deployment stuff external secrets with workload identities etc etc
- Crossplane / Kyverno / ACK etc etc