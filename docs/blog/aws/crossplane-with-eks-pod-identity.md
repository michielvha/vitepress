# upbound aws provider with EKS Pod identity

Using modern auth methods is always better than using clientID/Secret

## Terraform Configuration

::: info
To be able to use EKS Pod Identity the agent needs to be installed on the EKS Cluster.
:::


You can use the following Terraform code to create the necessary association.

```hcl
resource "aws_eks_pod_identity_association" "crossplane_s3" {
  cluster_name    = aws_eks_cluster.example.name
  namespace       = "crossplane-system"
  service_account = "provider-aws-s3"
  role_arn        = aws_iam_role.example.arn
}
```

You can verify the association was correctly created by running the following command:

````bash
aws eks list-pod-identity-associations --cluster-name $ClusterName
````

## Crossplane Provider Configuration

::: warning
Do not create the provider before the pod association is created, otherwise the provider will have to be restarted.
:::

````yaml
apiVersion: pkg.crossplane.io/v1beta1
kind: DeploymentRuntimeConfig
metadata:
  name: provider-aws-pod-id-drc
  namespace: crossplane-system
spec:
  serviceAccountTemplate:
    metadata:
      name: provider-aws-s3
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-s3
  namespace: crossplane-system
spec:
  package: xpkg.upbound.io/upbound/provider-aws-s3:v1
  runtimeConfigRef:
    name: provider-aws-pod-id-drc
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-family-aws
  namespace: crossplane-system
spec:
  package: xpkg.upbound.io/upbound/provider-family-aws:v1
---
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
    name: provider-aws-s3
spec:
    credentials:
        source: PodIdentity
````

| Object                        | What it does                                                                                                                                               | 
| ----------------------------- |------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`DeploymentRuntimeConfig`** | Tells Crossplane *how to run the provider Deployment* (node‑selector, service‑account name, etc.).                                                         |
| **`ProviderConfig`**          | Supplies the *credentials source* (IRSA, Pod Identity, Secret, etc.) **and is the object that every managed resource references via `providerConfigRef`.** |


## Troubleshooting

the provider containers should host the `AWS_CONTAINER_CREDENTIALS_FULL_URI` & `AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE` environment variable, which is set by the Pod Identity Agent.

the crossplane provider container does not have a shell so you'll need a debug container to check the environment variables:

```bash
  kubectl debug -it -n crossplane-system `
  pod/provider-aws-s3-8691ce5b9d4b-d9f586758-2sncd `
  --image=nicolaka/netshoot `
  --target=package-runtime `
  --share-processes `
  -- /bin/bash
```
