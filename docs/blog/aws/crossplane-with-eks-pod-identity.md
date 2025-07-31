#  EKS Pod identity for upbound aws provider

The native crossplane providers currently do not support EKS Pod Identity, which is a way to use IAM roles for service accounts (IRSA) without the need for a client ID and secret.
The upbound providers, created using the upjet engine, do support EKS Pod Identity. In this blog post, we will show you how to use EKS Pod Identity with the upbound AWS provider for S3.
the same concept can be used for other upbound providers, such as the upbound AWS provider for RDS, EC2 etc.

## Terraform Configuration

::: info
To be able to use EKS Pod Identity the agent needs to be installed on the EKS Cluster.
:::

The following Terraform snippet can be used to create the necessary association. 
You'll need to provide the `aws_eks_cluster.example.name` and `aws_iam_role.example.arn` values, which are the name of your EKS cluster and the ARN of the IAM role you want to associate with the service account.

```hcl
resource "aws_eks_pod_identity_association" "crossplane_s3" {
  cluster_name    = aws_eks_cluster.example.name
  namespace       = "crossplane-system"
  service_account = "provider-aws-s3"
  role_arn        = aws_iam_role.example.arn
}
```

You can verify the association was created by running the following command:

````bash
aws eks list-pod-identity-associations --cluster-name $ClusterName
````

## Crossplane Provider Configuration

::: warning
Do not create the provider before the pod association is created, otherwise the provider will have to be restarted.
:::

1. First we must create the `provider` for the `provider-family-aws`, which will provide the base resources (`ProviderConfig` , ...) for all upbound AWS providers.

    ````yaml
    apiVersion: pkg.crossplane.io/v1
    kind: Provider
    metadata:
      name: provider-family-aws
      namespace: crossplane-system
    spec:
      package: xpkg.upbound.io/upbound/provider-family-aws:v1
    ````

2. Create `DeploymentRuntimeConfig` for the provider, which will specify the service account name to use. This one should match the one used in the Terraform configuration above.

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
    ````

3. Then we create the aws s3 `Provider` & `ProviderConfig` for the provider, which will specify the service account name to use.

    ````yaml
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
    apiVersion: aws.upbound.io/v1beta1
    kind: ProviderConfig
    metadata:
        name: provider-aws-s3
    spec:
        credentials:
            source: PodIdentity
    ````

| Object                        | purpose                                                                                                                                                    | 
|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`DeploymentRuntimeConfig`** | Allows you to specify values for provider deployment (node‑selector, service‑account name, etc.).     |
| **`ProviderConfig`**          | Supplies the *credentials source* (IRSA, Pod Identity, Secret, etc.) **and is the object that every managed resource references via `providerConfigRef`.** |
| **`Provider`**                | defines which provider package should be used                                                                                                              |


## Troubleshooting

**Under Construction**

The provider containers should host the `AWS_CONTAINER_CREDENTIALS_FULL_URI` & `AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE` environment variable, 
which is set by the Pod Identity Agent.

The crossplane provider container does not have a shell so you'll need a debug container to check the environment variables:

```bash
  kubectl debug -it -n crossplane-system `
  pod/provider-aws-s3-8691ce5b9d4b-d9f586758-2sncd `
  --image=nicolaka/netshoot `
  --target=package-runtime `
  --share-processes `
  -- /bin/bash
```

