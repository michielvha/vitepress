# Troubleshooting Kubernetes

As we all know kubernetes troubleshooting can be rather convoluted and not as straight forward as debugging a traditional system. This is probably due to the many layers of abstraction taking away from understanding the core concepts. In this article we'll be sharing some usefull tips and tricks to help you solve issues quicker.

## restarting is always a good idea

traditionally fully removing an app from a system was difficult to say the least, with kubernetes it is highly encouraged and often fixes various issues that might not be obvious at first. This is why we always advocated for a proper CD solution like [argocd](https://argo-cd.readthedocs.io/en/stable/) which makes re-applying the app automatic and ensuring proper configuration by using GitOps.

however, sometimes app components will be stuck in a deleting state, this is almost always due to a finalizer which hasn't been met. These can be notoriously hard to get rid of, the combat this we'll share a snippet below which will always remove any given resource finalizers.

TODO: We'll have to generalise the snippet below to just $resource and $resourceName

```pwsh
# Get the specific providerconfig
$resource = kubectl get providerconfig provider-aws-s3 -o json | ConvertFrom-Json

# Remove the finalizers from metadata (not spec)
$resource.metadata.finalizers = @()

# Convert back to JSON
$resourceJson = $resource | ConvertTo-Json -Depth 10

# Apply using the correct API path
$resourceJson | kubectl replace --raw "/apis/aws.upbound.io/v1beta1/providerconfigs/provider-aws-s3" -f -
```