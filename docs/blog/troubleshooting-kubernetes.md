# Troubleshooting Kubernetes

As we all know Kubernetes troubleshooting can be rather convoluted when compared to debugging a traditional system. This is probably due to the many layers of abstraction that make it harder to understand the core concepts. In this article we'll be sharing some useful tips and tricks to help you solve issues quicker.

## Restarting is always a good idea

While completely removing an app from a traditional system was difficult to say the least, with Kubernetes it's super easy and highly encouraged because it often fixes various issues that might not be obvious at first. This is why we always advocated for a proper CD solution like [argocd](https://argo-cd.readthedocs.io/en/stable/) which makes re-applying the app automatic and ensures proper configuration by using GitOps.

However, app components sometimes get stuck in a deleting state. This is almost always due to an unmet finalizer. These can be notoriously hard to get rid of, so to combat this we'll share a snippet below which will always remove any given resource's finalizers.

TODO: We'll have to generalise the snippet below to just $resource and $resourceName

```powershell
# Get the specific providerconfig
$resource = kubectl get providerconfig provider-aws-s3 -o json | ConvertFrom-Json

# Remove the finalizers from metadata (not spec)
$resource.metadata.finalizers = @()

# Convert back to JSON
$resourceJson = $resource | ConvertTo-Json -Depth 10

# Apply using the correct API path
$resourceJson | kubectl replace --raw "/apis/aws.upbound.io/v1beta1/providerconfigs/provider-aws-s3" -f -
```