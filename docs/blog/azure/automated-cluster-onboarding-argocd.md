# Integrating ArgoCD with Azure Workload Identity / Key Vault for Automated Cluster Onboarding.

## Overview

This guide describes the the end-to-end integration for an Automated Cluster Onboarding with ArgoCD and Azure Workload Identity / Key Vault, enabling seamless integration of new AKS clusters into the ArgoCD control plane. This architecture leverages Terraform, Azure Key Vault & External Secrets Operator to manage authentication, streamline cluster onboarding, and ensure secure, automated configuration.

<!-- # ArgoCD integrations with AKS - Full onboarding process -->

## Architecture

![Assets](../../../assets/argocd.png)

# 1. Store Secrets in Azure Key Vault using Terraform Module Outputs

![Assets](../../../assets/step_1.png)

This section of the document explains how to dynamically store specific values during the creation of AKS cluster in ``Azure Key Vault`` as secrets. These values will be used in later steps, especially in automating the onboarding / integration of new clusters into ``ArgoCD``. To achieve this, the Terraform module will output two essential values from the AKS cluster, which are then stored securely in Azure Key Vault.

:::info
The Terraform identity handles the creation of secrets in the Key Vault, it is assumed this identity has the rights to perform actions on keyvault.
:::

## 1.1 Setup - Configure module to output values

The code below generates outputs for:
1. `cluster_ca_certificate`: The certificate authority (CA) certificate for the AKS cluster.
2. `aks_cluster_api_server_url`: The API server URL for accessing the AKS cluster.

These outputs are then passed as secrets in [1.2.1](#111-output-values) to Azure Key Vault, which securely stores them for future use. [Later on](#311-base-clusters) we will use them in creating a secret in our tooling hub cluster that ArgoCD can recognize and automatically pick up. 

### 1.1.1 output values

```hcl
output "cluster_ca_certificate" {
  value = azurerm_kubernetes_cluster.cluster.kube_config.0.cluster_ca_certificate
}

output "aks_cluster_api_server_url" {
  value = azurerm_kubernetes_cluster.cluster.kube_config.0.host
}
```

## 1.2 Usage - Saving Outputs as Key Vault Secrets

When creating an AKS cluster via the module, we must create 2 secret resources to store these two values in the Key Vault instance named `localfoundation-prd`. This will facilitate secure auto-joining by ArgoCD or other applications that require these credentials.

### 1.2.1 create terraform resources

The secrets stored are:
- **CA Certificate**: A unique certificate for validating cluster identity. using naming convention ``${module.aks.cluster_name}-ca-cert``
- **API Server URL**: The URL for accessing the AKS API. Using naming convention ``${module.aks.cluster_name}-server-url``


```hcl
// Secret creation for auto-joining with ArgoCD
resource "azurerm_key_vault_secret" "cluster_ca_cert" {
  name         = "${module.aks.cluster_name}-ca-cert"
  value        = module.aks.cluster_ca_certificate
  key_vault_id = data.azurerm_key_vault.pattoken_key_vault_localfoundation.id
}

resource "azurerm_key_vault_secret" "cluster_api_server_url" {
  name         = "${module.aks.cluster_name}-server-url"
  value        = module.aks.aks_cluster_api_server_url
  key_vault_id = data.azurerm_key_vault.pattoken_key_vault_localfoundation.id
}
```


Both secrets are stored in the `localfoundation` Key Vault, which must be defined as a data source in your Terraform code to ensure connectivity and permission to create secrets.

```hcl
data "azurerm_key_vault" "pattoken_key_vault_localfoundation" {
  name                = "localfoundation-prd-akv"
  resource_group_name = "mslocalfoundationwe-prd-rg"
}
```

## 1.3 Reference
- [``terraform-azurerm-aks`` module](https://dev.azure.com/bnl-ms/AzureFoundation/_git/terraform-azurerm-aks)
- [outputs.tf](https://dev.azure.com/bnl-ms/AzureFoundation/_git/terraform-azurerm-aks?path=/outputs.tf&version=GBmain&line=22&lineEnd=23&lineStartColumn=1&lineEndColumn=1&lineStyle=plain&_a=contents)


# 2. Fetching Secrets with External Secrets Operator (ESO)

![Assets](../../../assets/step_2.png)

This section outlines the configuration needed to enable the External Secrets Operator (ESO) to securely fetch secrets from Azure Key Vault.

## 2.1 Overview of External Secrets Operator (ESO)

The **External Secrets Operator** (ESO) is the preferred method for securely fetching secrets in our environment. While some legacy setups may use the CSI Driver, ESO is the standard approach going forward. Notably, ESO is deployed as part of the post-deployment process, so during the initial setup of ArgoCD, ESO is assumed to be unavailable. This is why we use two SecretProviderClass resources: `argocd-oidc-secret-class` and `argocd-tls-secret-class`, which provide essential secrets for ArgoCD without requiring ESO.

> **Why use External Secrets Operator?**  
> ESO allows for the creation of Kubernetes Secret objects, making secrets readily accessible to applications without mounting them directly into containers. This approach enhances security and simplifies secret management.

## 2.2 Setup - Setting Up the External Secrets Operator (ESO)

The **External Secrets Operator (ESO)** is a key component of the [post-deployment configuration](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/external-secrets/kustomization.yaml), ensuring it is available immediately after the cluster's initial setup is completed.

ESO is deployed using the official Helm chart with minimal customization. The primary modification involves adding a pull secret to enable the use of the JFrog Artifactory as a proxy for the GitHub Container Registry (GHCR). The `Default` namespace is used.

## 2.3 Setting Up SecretStore with Workload Identity

> **Why use Workload Identity?**  
> Workload Identity is preferred due to its native integration with the platform, eliminating the need for secret rotation while enhancing security.

### 2.3.1 Configuring Workload Identity Federation with Terraform

When bootstrapping a cluster, the Terraform module includes a configuration to set up Workload Identity. This process involves defining User Managed Identities (UMIs) and establishing federated credentials, enabling Workload Identity Federation for secure access to Azure Key Vault secrets.

> [!IMPORTANT]
> The examples used below are core to our integration. Every cluster needs to have this configured.

#### Example Configuration: `iam.tf` - Federated Credentials

The following Terraform configuration loops through federated credentials defined in `locals.tf` and applies them to the cloud provider. The `service_account` specified in each federated credential will be authorized to retrieve secrets from Azure Key Vault.

```hcl
module "federated_credentials" {
  for_each = { for index, federated_credential in local.federated_credentials : federated_credential.purpose => federated_credential }
  source   = "tfe.azure.bnl-ms.myengie.com/engie-bnl-ms/federatedcredentials/azurerm"
  version  = ">=0.0.1,<1.0.0"

  base_resource_name = module.aks.cluster_name
  oidc_issuer_url    = module.aks.oidc_issuer_url
  purpose            = each.value.purpose
  resource_group     = module.resource_group.resource_group
  service_account = {
    name      = each.value.service_account_name
    namespace = each.value.namespace
  }
  extra_service_accounts = each.value.extra_service_accounts
}
```

In this configuration, the loop iterates over all federated credentials specified in `locals.tf`, ensuring the appropriate service accounts have the correct federetion set based on ``cluster_name`` & ``oidc_issuer_url``.

#### Example Configuration: `locals.tf` - Federated Credentials

This configuration file lists the federated credentials used by specific service accounts to access Azure Key Vault secrets.

```hcl
federated_credentials = [
  {
    service_account_name   = "azureaws-sa"
    namespace              = "external-secrets"
    purpose                = "alm-prd-keyvaultaccess"
    extra_service_accounts = []
  },
  {
    service_account_name   = "workload-identity-eso-sa"
    namespace              = "external-secrets"
    purpose                = "localfoundation-prd-keyvaultaccess"
    extra_service_accounts = []
  }
]
```

After creating the UMIs, we must assign the appropriate roles to allow access to Key Vault.

#### Example Configuration: `iam.tf` - Role Assignments

In this example, role assignments are created to grant the necessary permissions to access specific Key Vaults.

```hcl
resource "azurerm_role_assignment" "federated_credentials_role_assignment_localfoundation" {
  provider             = azurerm.mgmt
  scope                = data.azurerm_key_vault.pattoken_key_vault_localfoundation.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = module.federated_credentials["localfoundation-prd-keyvaultaccess"].object_id
}

resource "azurerm_role_assignment" "federated_credentials_role_assignment_alm" {
  provider             = azurerm.mgmt
  scope                = data.azurerm_key_vault.pattoken_key_vault_alm.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = module.federated_credentials["alm-prd-keyvaultaccess"].object_id
}
```

> **Important Governance Note**  
> Ensure that both `alm-prd-akv` and `localfoundation-prd-akv` Azure Key Vaults are imported to enable these integrations. The `localfoundation` Key Vault holds essential certificates & terraform outputs, while the `alm` Key Vault contains the JFrog token—both are integral to the architecture.

#### Example Configuration: `data.tf` - Role Assignments

The `data.tf` configuration is required to import the Key Vaults that the system will interact with.

```hcl
data "azurerm_key_vault" "pattoken_key_vault_alm" {
  name                = "alm-prd-akv"
  resource_group_name = "msalmwe-prd-rg"
}

data "azurerm_key_vault" "pattoken_key_vault_localfoundation" {
  name                = "localfoundation-prd-akv"
  resource_group_name = "mslocalfoundationwe-prd-rg"
}
```

This setup ensures that the Key Vaults can be referenced correctly, and the User managed identities have the correct federated credentials with the necessary access configured to retrieve the required secrets.

### 2.3.2 Creating Kubernetes Objects for Secret Access

#### Service Account Configuration

After setting up the User Managed Identities (UMIs) with federated credentials, the next step is to create a Kubernetes `ServiceAccount` for each identity. This `ServiceAccount` must have the same `name` and `namespace` as the UMI configuration to ensure proper linking. Additionally, it should include annotations specifying the `client-id` and `tenant-id` associated with each UMI, as shown in the examples below:

```yaml
apiVersion: v1  # AZ DevOps Service Account
kind: ServiceAccount
metadata:
  name: azureaws-sa
  namespace: external-secrets
  annotations:
    azure.workload.identity/client-id: ff9ed905-98cd-4a4a-859f-71541ef48088
    azure.workload.identity/tenant-id: 24139d14-c62c-4c47-8bdd-ce71ea1d50cf
---
apiVersion: v1  # Tooling Service Account
kind: ServiceAccount
metadata:
  name: workload-identity-eso-sa
  namespace: external-secrets
  annotations:
    azure.workload.identity/client-id: cfb52f8b-4b1f-4fd4-b7a1-d89232b1e19b
    azure.workload.identity/tenant-id: 24139d14-c62c-4c47-8bdd-ce71ea1d50cf
```

#### Configuring the ClusterSecretStore

To link Azure Key Vaults to our Kubernetes cluster, we need to create `ClusterSecretStore` objects. These objects define how secrets are fetched from Key Vault and which `ServiceAccount` will be used for authentication. In our setup, we configure two `ClusterSecretStore` objects, each with a unique vault URL and associated `ServiceAccount`:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: cluster-alm-prd-store
spec:
  provider:
    azurekv:
      authType: WorkloadIdentity
      vaultUrl: "https://alm-prd-akv.vault.azure.net"
      serviceAccountRef:
        name: azureaws-sa
        namespace: external-secrets
---
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: cluster-localfoundation-prd-store
spec:
  provider:
    azurekv:
      authType: WorkloadIdentity
      vaultUrl: "https://localfoundation-prd-akv.vault.azure.net"
      serviceAccountRef:
        name: workload-identity-eso-sa
        namespace: external-secrets
```

In this configuration:

- Each `ClusterSecretStore` object points to a specific Azure Key Vault instance (e.g., `alm-prd-akv` and `localfoundation-prd-akv`).
- The `authType` is set to `WorkloadIdentity` to leverage Azure’s workload identity for authentication.
- The `serviceAccountRef` specifies the `ServiceAccount` used to access the respective Key Vault.

Using the configuration above, the ``cluster-localfoundation-prd-store`` is linked to the keyvault that holds the terraform outputs. On our tooling hub and on every other cluster this ClusterSecretStore is configured.

> **Note:** Ensuring the proper configuration of `ClusterSecretStore` objects is essential for secure and seamless integration with Azure Key Vault, enabling our Kubernetes workloads to retrieve secrets as needed.

> **Enhancement: Reduce usage of clusterSecretStore by moving localfoundation akv to SecretStore | introduces extra maintenance**

### 2.4 Usage: Configure External Secret for JFrog Authentication

The following `ClusterExternalSecret` configuration is required on every cluster and must be deployed in every namespace by default. This secret provides the necessary authentication details for JFrog Artifactory, which is the centralized platform for managing artifacts. Governance mandates that all artifacts are to be pulled exclusively from JFrog.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterExternalSecret
metadata:
  name: jfrog-artifactory-secret-cluster
spec:
  externalSecretName: "jfrog-artifactory-secret-external-secret"
  namespaceSelector:
    matchExpressions: 
    - { key: kubernetes.io/metadata.name, operator: Exists }
  externalSecretSpec:
    refreshInterval: 1h
    secretStoreRef:
      kind: ClusterSecretStore
      name: cluster-alm-prd-store
    target:
      name: jfrog-artifactory-secret
      creationPolicy: Owner
      template:
        engineVersion: v2
        type: kubernetes.io/dockerconfigjson
        data:
          .dockerconfigjson: "{{ .docker | b64dec }}"
    data:
    # Specifies the JFrog Docker authentication secret in Azure Key Vault
    - secretKey: docker
      remoteRef:
        key: docker-jfrog-artifactory
```

#### Governance Guidelines
- **Scope and Access**: The `ClusterExternalSecret` uses a `namespaceSelector` to ensure that it is created in all namespaces. By using `operator: Exists`, this configuration is automatically applied to each namespace within the cluster.
- **Authentication Policy**: This secret must be available in every namespace to enable seamless access to JFrog for artifact pulls.
- **Refresh Policy**: The `refreshInterval` is set to 1 hour, ensuring that any updates in JFrog credentials are propagated to Kubernetes in a timely manner.
  
> **Important Governance Note**  
> External Secrets can be scoped either to a namespace or to the entire cluster. On shared clusters, `ClusterExternalSecret` (the cluster-scoped variant) should never be used, as it grants access across all namespaces. On clusters dedicated to single teams, `ClusterExternalSecret` may be used, but only with strict governance: the `namespaceSelector: matchExpressions` field must always be configured to limit access to specific namespaces. The only exceptions to this rule are the two secrets that are essential to our core workflow.


### 2.5 Reference

- [ServiceAccount](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/service-accounts.yaml)
- [ClusterSecretStore](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/clustersecretstore.yaml)
- [ClusterExternalSecret](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/clusterexternalsecret.yaml)
-  [ESO Repo Docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/clusters/readme.md&version=GBmain)

# 3. Injecting Secrets

![Assets](../../../assets/step_3.png)

This section explains the `Kustomize` setup implemented to streamline the injection of new cluster secrets into ArgoCD.

## 3.1 Kustomize Structure

As part of our standard practice, `Kustomize` is used to manage repository configurations. This setup allows us to easily add new clusters by simply duplicating an existing environment, making minor modifications, and deploying the configuration. This approach ensures consistency and efficiency when scaling our cluster management.

### 3.1.1 Base Clusters

The `base-clusters` folder contains the foundational `external-secret` manifest, which serves as the template for configuring secrets for each new cluster. By using this base configuration, we can maintain a standardized setup across clusters, simplifying both the deployment and governance of secrets in our environment. 

#### Production Configuration

```YAML
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: <TO_OVERLAY>
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: cluster-localfoundation-prd-store
    kind: ClusterSecretStore
  target:
    name: <TO_OVERLAY>
    creationPolicy: Owner
    template:
      type: Opaque
      metadata:
        labels:
          argocd.argoproj.io/secret-type: cluster
      data:
        name: <TO_OVERLAY>
        server: "{{ .serverUrl }}"
        config: |
          {
            "execProviderConfig": {
              "command": "argocd-k8s-auth",
              "env": {
                "AZURE_CLIENT_ID": "5bc5f230-293d-4d51-ac69-d4b56630a41a",
                "AZURE_TENANT_ID": "24139d14-c62c-4c47-8bdd-ce71ea1d50cf",
                "AZURE_FEDERATED_TOKEN_FILE": "/var/run/secrets/azure/tokens/azure-identity-token",
                "AZURE_AUTHORITY_HOST": "https://login.microsoftonline.com/",
                "AAD_ENVIRONMENT_NAME": "AzurePublicCloud",
                "AAD_LOGIN_METHOD": "workloadidentity"
              },
              "args": ["azure"],
              "apiVersion": "client.authentication.k8s.io/v1beta1"
            },
            "tlsClientConfig": {
              "insecure": false,
              "caData": "{{ .caCert }}"
            }
          }
  data:
  - secretKey: caCert
    remoteRef:
      key: <TO_OVERLAY>
  - secretKey: serverUrl
    remoteRef:
      key: <TO_OVERLAY>
```

## 3.2 Usage: Add new Cluster to ArgoCD

This repository is structured to utilize Kustomize for easy management across different environments. Each environment is represented by its own folder within the Kustomize setup. To configure a new environment, follow these steps:

### 3.2.1 Create (or copy) new Environment Folder

Start by creating (or copying) a new folder specific to our environment in ``overlays/prd/clusters``. This folder will contain custom configuration files for that particular environment.

> [!IMPORTANT]
> Don't forget to include a new entry for your environment in the `Kustomization.yaml` file in ``overlays/prd/clusters`` directory, or our config won't be included upon rendering. **New environments need to follow standard naming convention.** In our case the directory should follow the **shortname**(squad-env-region) convention

### 3.2.2 Configure the Kustomization.yaml File

in our newly created folder, add a ``kustomization.yaml`` file. This file will define how Kustomize should apply configurations specific to our new environment. Use the following template as a starting point, modifying values as necessary:

```YAML
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: argocd

resources:
- ../../../../base-clusters

patches:
- target:
    kind: ExternalSecret
  patch: |-
    - op: replace
      path: /metadata/name
      value: <argocd_cluster_name>-cluster-external-secret
    - op: replace
      path: /spec/target/name
      value: <aks_cluster_name>-cluster-secret
    - op: replace
      path: /spec/target/template/data/name
      value: <argocd_cluster_name>
    - op: replace
      path: /spec/data/0/remoteRef/key
      value: secret/<aks_cluster_name>-ca-cert
    - op: replace
      path: /spec/data/1/remoteRef/key
      value: secret/<aks_cluster_name>-server-url
```

#### Customize for our Environment:

In the `kustomization.yaml` file, replace placeholders `<argocd_cluster_name>` with the ``fullname``**(ms-env-aks-project-region-sequence)** and `<aks_cluster_name>` with the ``shortname``**(squad-env-region)** of your environment.

### 3.3 Reference

- [ExternalSecret](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/base-clusters/externalsecret.yaml&version=GBmain)
- [Cluster Overlay Kustomization.yaml](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/clusters/azure-int-we/kustomization.yaml&version=GBmain)
-  [ArgoCD Docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/clusters/readme.md&version=GBmain)

# 4. Triggering Cluster Addition

![Assets](../../../assets/step_4.png)

In the previous step, we created a cluster secret using our `Kustomize` workflow. When this new overlay folder is added to the `kustomization.yaml` file, ArgoCD will automatically apply it. This is possible because ArgoCD operates as a self-managing application, meaning it performs continuous deployment (CD) on its own configuration.

To enable ArgoCD to recognize and add new clusters, the secret is created with a specific label: `argocd.argoproj.io/secret-type: cluster`. The ArgoCD server watches for any secrets with this label and initiates the cluster addition process upon detection.

## 4.1 ArgoCD Self-Managing Application

When deploying ArgoCD, we also create an ArgoCD `Application` resource specifically for managing ArgoCD itself. This setup enables ArgoCD to operate as a self-managing application, meaning it continuously monitors and maintains its own configuration. Any updates to the configuration are automatically detected and applied, ensuring consistency and reducing the need for manual intervention.

This self-management approach uses ArgoCD’s own continuous deployment capabilities to achieve automation for updates, patching, and scaling.

### 4.1.1 Example Configuration

The following YAML configuration defines ArgoCD as an `Application` resource. Let’s break down each component of this configuration:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argocd
  namespace: argocd
  labels:
    name: argocd
    squad: azure-aws
    env: hub
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  destination:
    namespace: argocd
    name: in-cluster
  project: azure-tooling-hub-we
  source:
    path: manifests/argocd/overlays/prd
    repoURL: https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD
    targetRevision: main
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - PruneLast=true
```

### 4.1.2 Key Components

- **Metadata and Labels**:
  - `metadata.name`: Specifies the name of the application, here as `argocd`, which represents the self-managed instance.
  - `labels`: Adds metadata for organizational purposes, allowing easy identification of the application environment (`env: hub`) and responsible team (`squad: azure-aws`).

- **Finalizers**:
  - `finalizers`: The `resources-finalizer.argocd.argoproj.io` finalizer ensures that the resources managed by this application are properly cleaned up if the application is deleted, preventing orphaned resources in the cluster.

- **Spec Section**:
  - **Destination**:
    - `destination.namespace`: Specifies the namespace in which ArgoCD itself is deployed (here as `argocd`).
    - `destination.name`: `in-cluster` indicates that the application is deployed within the same cluster as ArgoCD.

  - **Project**:
    - `project`: Specifies the ArgoCD project (`azure-tooling-hub-we`) that the application belongs to, which helps manage permissions, source control, and deployment configurations.

  - **Source**:
    - `source.path`: Defines the path to the manifest files for ArgoCD’s configuration within the Git repository.
    - `source.repoURL`: Points to the Git repository containing the ArgoCD configuration files, allowing ArgoCD to pull configuration updates directly from the source code repository.
    - `source.targetRevision`: Specifies the branch to track for updates, here set to `main`.

- **Sync Policy**:
  - **Automated Sync**:
    - `selfHeal: true`: Enables self-healing, meaning ArgoCD will automatically restore configuration if it detects any drift from the desired state.
    - `prune: true`: Automatically prunes resources that are no longer defined in the source repository, keeping the environment clean.
    
  - **Sync Options**:
    - `PruneLast=true`: Ensures that resources are pruned only after successful application of all updates, avoiding disruption in the event of dependency changes.

### 4.1.3 Benefits of Self-Management

- **Automatic Updates**: With ArgoCD configured as a self-managing application, any change to its configuration (e.g., updates to manifests, modifications in the Git repository) is automatically detected and applied.
- **Enhanced Consistency**: Self-healing and automated pruning help ensure that ArgoCD’s configuration remains consistent with the desired state defined in the Git repository.
- **Reduced Maintenance**: By continuously monitoring and managing itself, ArgoCD minimizes the need for manual intervention, allowing teams to focus on other priorities.
  

## 4.2 Production Configuration - External Secret

In the our [production configuration]() below, the target secret is configured to have the required label (`argocd.argoproj.io/secret-type: cluster`) when creating the external secret. This label signals the ArgoCD server to proceed with adding the associated cluster.

```yaml
...
  target:
    name: <TO_OVERLAY>
    creationPolicy: Owner
    template:
      type: Opaque
      metadata:
        labels:
          argocd.argoproj.io/secret-type: cluster
      data:
        name: <TO_OVERLAY>
        server: "{{ .serverUrl }}"
...
```

### 4.2.1 Key Points

- **Automatic Cluster Detection**: By adding the label `argocd.argoproj.io/secret-type: cluster`, the ArgoCD server automatically recognizes the secret and begins the cluster addition process.
- **Self-Managing ArgoCD Application**: ArgoCD performs continuous deployment on its configuration, so any updates in the `kustomization.yaml` file are detected and applied without manual intervention.
- **Consistency with Kustomize**: Using `Kustomize` overlays allows for easy replication and management of new clusters, ensuring a streamlined, standardized setup process.


## 4.3 Reference

- [ExternalSecret](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/base-clusters/externalsecret.yaml&version=GBmain)
- [Cluster Overlay Kustomization.yaml](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/clusters/azure-int-we/kustomization.yaml&version=GBmain)
-  [ArgoCD Docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/clusters/readme.md&version=GBmain)


# 5. Auto Add cluster. 

![Assets](../../../assets/step_5.png)

In this section, we outline the process and configurations that enable ArgoCD to automatically, securely, and seamlessly add new clusters to its management system. By leveraging workload identity federation, role assignments, and federated credentials via Terraform, this setup ensures that ArgoCD can connect to newly created clusters with minimal manual intervention while maintaining compliance and governance.

## 5.1 Terraform Setup

## 5.1.1 Configuring Workload Identity Federation with Terraform

Below, we outline the Terraform configurations in the ``terraform-azurerm-aks`` module used to automate this process.

#### Production Configuration: `iam.tf` - Federated Credentials

The following module gets called in AKS module to set up federated credentials. Each federated credential is mapped based on its defined purpose.

```terraform
module "federated_credentials" {
  for_each = { for index, federated_credential in local.federated_credentials : federated_credential.purpose => federated_credential }
  source   = "tfe.azure.bnl-ms.myengie.com/engie-bnl-ms/federatedcredentials/azurerm"
  version  = ">=0.0.1,<1.0.0"
  
  base_resource_name = module.aks.cluster_name
  oidc_issuer_url    = module.aks.oidc_issuer_url
  purpose            = each.value.purpose
  resource_group     = module.resource_group.resource_group
  service_account = {
    name      = each.value.service_account_name
    namespace = each.value.namespace
  }
  extra_service_accounts = each.value.extra_service_accounts
}
```

#### Production Configuration: `locals.tf` - Federated Credentials

This configuration ensures that both the ArgoCD server and the application controller service accounts can access the required clusters. multiple service accounts are linked to the same ``UMI`` using the ``extra_service_accounts`` parameter

```terraform
   federated_credentials = [
    {
      service_account_name = "argocd-server"
      namespace            = "argocd"
      purpose              = "argocd-app-prd"
      extra_service_accounts = [{
        name      = "argocd-application-controller"
        namespace = "argocd"
      }]
    }
  ]
```

> [!IMPORTANT]
> the argocd ``server`` and ``application controller`` service accounts both need access to be able to add the clusters. This is not clearly documented in the [official documentation](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#aks).


#### Production Configuration: `main.tf` - Role Assignments

The following resource assignment ensures that the ArgoCD service accounts have the required permissions to manage newly created clusters as cluster administrators. `Azure Kubernetes Service RBAC Cluster Admin` is required.

```terraform
resource "azurerm_role_assignment" "argocd_server_role_assignment" {
  count                = var.argocd_server_wi.enabled ? 1 : 0
  provider             = azurerm.mgmt
  principal_id         = coalesce(var.argocd_server_wi.principal_id, local.default_argocd_server_wi)
  scope                = azurerm_kubernetes_cluster.cluster.id
  role_definition_name = "Azure Kubernetes Service RBAC Cluster Admin"
}
```

#### Production Configuration: `locals.tf` - Role Assignments

The `client_id` of the User-Managed Identity (UMI) associated with the ArgoCD server and application controller, currently set to `ms-hub-aks-tooling-we-01-argocd-app-prd-umi`, is defined in `locals.tf`. 

To avoid potential disruptions—such as when the Service Principal (SPN) changes due to ArgoCD being moved to a different cluster—you must ensure the `default_argocd_server_wi` value is updated accordingly. This ensures continuity in permissions and functionality.

```terraform
default_argocd_server_wi = "913b803c-edcd-4812-b777-329c2fb963d2"
``` 

## 5.1.2 Enable workload identity federation via AKS module

The above configuration demonstrates how to set up Workload Identity within the AKS module. Below, we detail the additional steps required in the workspace to enable this setup.

#### Example configuration: `main.tf`

To activate the role assignment for the ArgoCD server, include the following parameter when calling the module:

```terraform
argocd_server_wi = {
  enabled = true
}
```

## 5.2 Kubernetes setup

### 5.2.1 Set proper annotations on deployment and service account

#### Annotate ArgoCD Service Accounts:

Modify the `argocd-server` and `argocd-application-controller` service accounts with the required annotations. These annotations should include the `client-id` generated by Terraform :

> [!NOTE]
> The name of the UMI is based on the purpose set during the terraform setup. By default they should be in the cluster's resource group (unmanaged)

```YAML
apiVersion: v1
kind: ServiceAccount
metadata:
  namespace: argocd
  annotations:
    azure.workload.identity/client-id: xxxxxxx-xxx-xxxx-xxxx-xxxxxxxxx
    azure.workload.identity/tenant-id: xxxxxxx-xxx-xxxx-xxxx-xxxxxxxxx
  name: argocd-server
---
apiVersion: v1
kind: ServiceAccount
metadata:
  namespace: argocd
  annotations:
    azure.workload.identity/client-id: xxxxxxx-xxx-xxxx-xxxx-xxxxxxxxx
    azure.workload.identity/tenant-id: xxxxxxx-xxx-xxxx-xxxx-xxxxxxxxx
  name: argocd-application-controller
```

#### Update ArgoCD Deployments with Azure Identity Annotation:

Ensure the `azure.workload.identity/use` annotation is set to `"true"` on both the `argocd-server` deployment and the `argocd-application-controller`. This is a crucial step for enabling Azure Workload Identity on these components. We also configure [reloader](https://github.com/stakater/Reloader).

```YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  namespace: argocd
  name: argocd-server
spec:
  template:
    metadata:
      annotations:
        configmap.reloader.stakater.com/reload: "argocd-rbac-cm,argocd-cm,argocd-cmd-params-cm"
      labels:
        azure.workload.identity/use: "true"
---
apiVersion:  apps/v1
kind: StatefulSet
metadata:
  namespace: argocd
  name: argocd-application-controller
spec:
  template:
    metadata:
      annotations:
        configmap.reloader.stakater.com/reload: "argocd-rbac-cm,argocd-cm,argocd-cmd-params-cm"
      labels:
        azure.workload.identity/use: "true"
```



### 5.2.2 Compliant Cluster Configuration Secret

This configuration retrieves data directly from Azure Key Vault, reducing the need to manually check the Azure portal for each secret. By centralizing secrets management in Key Vault, we can securely and dynamically configure clusters with essential information, such as CA data & cluster api url, for ArgoCD integration.

> **Note:**  
> To securely connect to your Kubernetes cluster, your configuration file must include the CA data from the cluster. This information is typically retrieved from the kubeconfig file after authenticating with the cluster. You can use the `kubelogin` command to facilitate this process:

```bash
az aks get-credentials --resource-group <resource-group> --name <cluster-name>
kubelogin convert-kubeconfig
```

- The `kubelogin` command enables Azure AD integration with Kubernetes, ensuring your credentials are correctly configured for secure access.
- **CA Data**: Once connected, the CA data is included in the kubeconfig file. This data is essential for establishing a secure, encrypted connection to the cluster and is stored within Key Vault to ensure consistent access across environments.

Since manually checking the CA data each time a new cluster is added would be inefficient, Terraform has been configured to automatically output the necessary values to Key Vault, making them available to the main tooling hub cluster dynamically.

Below is the configuration YAML for creating the `Secret` object that ArgoCD will use for accessing the Kubernetes API server. This secret leverages the values from Key Vault and includes the necessary authentication details.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: <name of the secret> #shortname(squad-env-region)-cluster-external-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: cluster-localfoundation-prd-store
    kind: ClusterSecretStore
  target:
    name: <name of the secret> # fullname(ms-env-aks-project-region-sequence)-cluster-secret
    creationPolicy: Owner
    template:
      type: Opaque
      metadata:
        labels:
          argocd.argoproj.io/secret-type: cluster
      data:
        name: <name your cluster, this name will appear in argoCD, overwrite with kustomize> #shortname
        server: "{{ .serverUrl }}"
        config: |
          {
            "execProviderConfig": {
              "command": "argocd-k8s-auth",
              "env": {
                "AZURE_CLIENT_ID": "5bc5f230-293d-4d51-ac69-d4b56630a41a",
                "AZURE_TENANT_ID": "24139d14-c62c-4c47-8bdd-ce71ea1d50cf",
                "AZURE_FEDERATED_TOKEN_FILE": "/var/run/secrets/azure/tokens/azure-identity-token",
                "AZURE_AUTHORITY_HOST": "https://login.microsoftonline.com/",
                "AAD_ENVIRONMENT_NAME": "AzurePublicCloud",
                "AAD_LOGIN_METHOD": "workloadidentity"
              },
              "args": ["azure"],
              "apiVersion": "client.authentication.k8s.io/v1beta1"
            },
            "tlsClientConfig": {
              "insecure": false,
              "caData": "{{ .caCert }}"
            }
          }
  data:
    - secretKey: caCert
      remoteRef:
        key: secret/ms-env-aks-project-region-sequence-ca-cert   # fullname(ms-env-aks-project-region-sequence)-ca-cert
    - secretKey: serverUrl
      remoteRef:
        key: secret/ms-env-aks-project-region-sequence-server-url # fullname(ms-env-aks-project-region-sequence)-server-url
```

#### Key Points

- **Automated CA Data Retrieval**: Terraform outputs the CA data and other values to Key Vault, eliminating manual lookups.
- **ArgoCD Authentication**: This secret includes authentication parameters for `argocd-k8s-auth`, allowing secure integration with Azure.
- **Dynamic Secret Management**: By centralizing secrets in Key Vault, this configuration ensures that all necessary data is securely available to every namespace and cluster as required.



# 6. Projects.

![Assets](../../../assets/step_6.png)

Projects in ArgoCD provide a way to group applications and manage access control, offering granular control over which namespaces and resources can be deployed.

<!-- Give detailed guide about how projects are used in the workflow for rbac. Declerative setup of repo's & projects. -->

## 6.1 Overview

Projects in ArgoCD are used to define boundaries for applications, specifying which namespaces and resources they can access inside the specified Kubernetes cluster. This allows for fine-grained control and governance over deployments, ensuring that applications only interact with the resources they are permitted to.


### 6.1.1 How do projects provide RBAC in ArgoCD

Projects in ArgoCD provide RBAC by allowing customization of various fields. Here are some key fields that can be customized:

- `spec.clusterResourceWhitelist`: Specifies which cluster-scoped resources are allowed. For example:
  ```yaml
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'
  ```
  This allows all cluster-scoped resources.

- ``spec.destinations:`` Specifies the namespaces and clusters where applications can be deployed. For example:
  ```yaml
  destinations:
    - namespace: 'marketing-cloud'
      name: 'web-int-we'
  ```
  This allows deployments to the ``marketing-cloud`` namespace in the ``web-int-we`` cluster.

- ``spec.sourceRepos``: Specifies the repositories from which applications can be sourced. For example:
  ```yaml
  sourceRepos:
    - '*'
  ```
  This allows applications to be sourced from any repository.

- ``spec.sourceNamespaces:`` Specifies the namespaces from which applications can be sourced. This corelated to the namespace in the application object. For example if your application object has namespace `marketing-cloud` you would:
  ```yaml
  sourceNamespaces:
    - marketing-cloud
  ```
  This allows applications to be sourced from the ``marketing-cloud`` namespace.

### 6.1.2 Governance

ArgoCD projects are governed by a structured policy that ensures consistent access control and adherence to organizational standards. This approach aligns with cluster assignment guidelines, project naming conventions, and specific group roles within Azure Active Directory (Azure AD). The governance model is tailored based on the type of cluster assignment:

| Cluster Assignment   | Governance Decision                                                                 |
|----------------------|-------------------------------------------------------------------------------------|
| Dedicated clusters   | One project per cluster, no restrictions on resource access or deployment scope.    |
| Shared clusters      | Project per squad, each with a dedicated namespace, with restricted permissions on who can deploy to which namespace. This ensures strict control over resource access in shared environments. |

#### Azure AD Group Management

Each squad in ArgoCD is assigned specific Azure AD groups to manage role-based access control (RBAC). The ALM (Application Lifecycle Management) team oversees this setup, which is structured as follows:

- **Group Assignment per Squad**: Each squad has one reader and one admin group assigned in Azure AD. For squads with fewer applications or lower levels of involvement, only an admin group is created, providing necessary access without additional roles.
- **Management of Azure AD Groups**: The responsibility for adding new group members has shifted to the ALM team. This team ensures that group management aligns with the organizational security policies and compliance standards. The creation of new groups remains with ``azure-aws``


####  Project Naming Convention Format

To ensure consistency, all projects follow a standardized naming convention. This aids in identifying ownership and purpose across different projects, aligning with governance policies and making project management in ArgoCD more streamlined.

`teamName-cluster-env-region`

- **teamName**: Represents the owning team or squad (e.g., `azure`).
- **cluster**: Specifies the cluster or resource type (e.g., `web`).
- **env**: Denotes the environment (e.g., `acc` for acceptance, `prd` for production).
- **region**: Identifies the geographical region of the resource (e.g., `ne`, `we` ).

#### ALM Team Responsibilities

The ALM team plays a central role in maintaining governance and compliance across projects in ArgoCD:

- **Group Member Administration**: Using a Terraform workspace hosted within the same repository as the ArgoCD configuration, the ALM team manages Azure AD group creation. This setup ensures that groups are created and maintained consistently with the ArgoCD project structure.
- **Maintenance of Project Access**: The ALM team is responsible for updating access controls, managing RBAC policies, and ensuring that projects are governed according to organizational standards.

This governance structure enables efficient and secure management of ArgoCD projects, with a clear division of responsibility and adherence to best practices in access control and resource allocation.


> [!IMPORTANT]
> All Entra groups that will be used in the ArgoCD manifests for RBAC need to be added (manually) in Azure Enterprise Application `ORG0031-MS-Server-Azure-ArgoCD-Login-Prd`. When you assign a group to an application, only users directly in the group will have access. The assignment does not cascade to nested groups.


## 6.2 Kustomize Setup

In ArgoCD, Kustomize is used to manage overlays for each environment. A dedicated `projects` directory within the overlay contains configuration files for each squad, ensuring a clear, structured approach to managing environment-specific resources and permissions.

### 6.2.1 Adding a New Project

Creating a new project in ArgoCD involves either copying an existing AppProject template or defining a new configuration. The namespace should be set to `argocd` or another namespace listed in the `argocd-cmd-params-cm` ConfigMap at `.data.application.namespaces`, which defines where applications are located.

#### Steps to Add a New Project

1. **Copy or Create a Project Template**: 
   - Locate an existing AppProject configuration and duplicate it, or create a new AppProject file for your new project.
   
2. **Configure Project Settings**: 
   - Ensure the `namespace` field is set to `argocd` or another valid namespace from the ConfigMap `argocd-cmd-params-cm`.
   - Update fields specific to your environment, such as `spec.clusterResourceWhitelist`, `spec.destinations`, `spec.sourceRepos`, `spec.sourceNamespaces`, and `spec.roles` (see below for details on each field).

### 6.2.2 Configuring Project Fields

Each project has a set of customizable fields that define its scope and permissions. These configurations allow granular control over access to resources and application sources.

- **`spec.clusterResourceWhitelist`**: Defines which cluster-scoped resources are allowed within this project. Example:
  ```yaml
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'
  ```
  This configuration allows access to all cluster-scoped resources.

- **`spec.destinations`**: Specifies the namespaces and clusters where applications can be deployed. Example:
  ```yaml
  destinations:
    - namespace: 'team-namespace'
      name: 'cluster-name'
  ```
  This limits deployments to the specified `team-namespace` within the `cluster-name` cluster.

- **`spec.sourceRepos`**: Defines the Git repositories from which applications can be sourced. Example:
  ```yaml
  sourceRepos:
    - 'https://github.com/org/repo'
  ```
  This restricts applications to be sourced only from the specified repository.

- **`spec.sourceNamespaces`**: Indicates the namespaces from which applications can be sourced, correlating with the `namespace` field in the application object. Example:
  ```yaml
  sourceNamespaces:
    - 'source-namespace'
  ```

- **`spec.roles`**: Configures roles for the project, associating each role with specific policies and groups. Each role defines access levels for users or groups. Example roles include `read-only` and `admin`.

### 6.2.3 Example Project Configuration

Below is an example of a fully configured AppProject YAML file:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: example-project
  namespace: argocd
spec:
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'
  destinations:
    - namespace: '*'
      name: 'example-cluster'
  sourceRepos:
    - 'https://dev.azure.com/org/repo'
  sourceNamespaces:
    - '*'
  roles:
    - name: read-only
      description: Read-only access for users
      policies:
        - p, proj:example-project:read-only, applications, get, example-project/*, allow
      groups:
        - cd1faeed-a9d9-4d7c-99c6-477bfa61d749 # Example Read-Only Group
    - name: admin
      description: Full administrative access for users
      policies:
        - p, proj:example-project:admin, applications, *, example-project/*, allow
      groups:
        - 8a4815dc-86a5-4203-8251-41fca3387826 # Example Admin Group
```

This configuration allows users in the `read-only` group to view applications in the `example-project`, while members of the `admin` group have full permissions to manage applications in this project.

**Refine stops here**

# 7. Deploy Root Application

![Assets](../../../assets/step_7.png)

In ArgoCD, a "root application" (or "App of Apps") is an application that serves as a parent to multiple child applications, grouping them into a single, manageable unit. This design is especially useful in complex deployments, allowing you to manage related applications under one umbrella, simplifying governance, compliance, and disaster recovery processes.

## 7.1 Overview

Root applications in ArgoCD enable teams to group their applications under a unified configuration, defining boundaries and deployment targets. Each root application is linked to a repository in Azure DevOps through a Service Account maintained by the ALM (Application Lifecycle Management) team, ensuring secure integration and management.

- **Repository Link**: The root application configuration specifies the Azure DevOps repository, connected securely via a Service Account managed by ALM, which controls the access and ensures secure communication.
- **One Root Application per Team**: For maintainability and disaster recovery (DR) purposes, each team is assigned a single root application, encapsulating all child applications within their own project or namespace. 

> [!WARNING]
> The API Squad has multiple root applications due to legacy requirements, making it an exception to this policy.

## 7.2 Declarative Addition of Repositories

The Repositories referenced are added to ArgoCD declaratively by creating ArgoCD secrets with specific labels, enabling automated and consistent repository management across environments. This method leverages `ExternalSecret` resources, ensuring that project repository credentials remain secure and centralized.

### 7.2.1 Kustomize Workflow

To ensure consistent management, a Kustomize workflow was established for declaratively adding project repositories to ArgoCD.

#### Base

The base configuration for repository secrets resides in `manifests/base-repos`. This base file defines the structure of the secret, allowing overlays to be applied for specific environments or squads.

#### [Production Reference](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/base-repos)

Here is the production reference example for a repository secret:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: <TO_OVERLAY>
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: cluster-alm-prd-store
    kind: ClusterSecretStore
  target:
    name: <TO_OVERLAY>
    creationPolicy: Owner
    template:
      type: Opaque
      metadata:
        labels:
          argocd.argoproj.io/secret-type: repo-creds
      data:
        type: git
        url: <TO_OVERLAY>
        password: "{{ .password }}"
        username: "{{ .username }}"
  data:
  - secretKey: password
    remoteRef:
      key: secret/azure-devops-git-read-pat
  - secretKey: username
    remoteRef:
      key: secret/azure-devops-git-read-username
```

#### Overlay

The `repos` directory within the overlay folder contains configuration files per squad, following a 1:1 mapping between projects and squads. Each squad’s folder contains its unique project url, linking specific Azure DevOps projects to ArgoCD.

- **Service Account Usage**: The default Azure DevOps service account, maintained by the ALM team, is used consistently across all repository connections. This account’s credentials are securely managed using the `sealed-secrets` operator, with the initial secret located in `repo-creds.yaml`.

This Kustomize workflow should be followed when adding new repositories, ensuring standardized and secure repository management.

## 7.3 Usage: Add a New Project Repository via Kustomize Workflow

To add a new repository using the Kustomize workflow:

1. **Create a New Secret for the Repository**: 
   - Whenever a new project needs to be added create a new folder with the project name.
   - Define a new `Kustomization.yaml` file in this folder based on an old one.
   - Overlay a new name for the external secret, the target secret and the projects URL.

    #### Example overlay configruation
    ```YAML
    patches:
    - target:
        kind: ExternalSecret
      patch: |-
        - op: replace
          path: /metadata/name
          value: azurefoundation-external-secret
        - op: replace
          path: /spec/target/name
          value: azurefoundation-repo-secret
        - op: replace
          path: /spec/target/template/data/url
          value: https://dev.azure.com/bnl-ms/AzureFoundation/_git/
    ```

2. **Apply Overlays**:
   - Don't forget to add this new folder in the [root kustomization file](https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCD?path=/manifests/argocd/overlays/prd/repos/kustomization.yaml) of the ``overlay/repos`` directory. Adding the folder will trigger ArgoCD to apply the configuration.
  
> [!NOTE] Note:
> Ensure that the new repository secret uses the label `argocd.argoproj.io/secret-type: repo-creds` for compatibility with ArgoCD. This should be handeld by bases.
 
This process adds the new Project repository to ArgoCD in a declarative, managed manner, making it available for the team’s applications.

## 7.4 Usage: Create a New Root Application

A root application is essential for managing multiple related applications under a team’s umbrella, adhering to governance and compliance requirements. Here’s how to create a new root application.

1. **Setup Root Application**: 
   - Using the [Template root app](https://dev.azure.com/bnl-ms/AzureFoundation/_git/template-ArgoCDApps) as a reference, define a new root application, specifying the repository URL, destination server, and project namespace.
   - Ensure that the application path is set to the application configuration repository for your team.

2. **Governance and Compliance**:
   - Each team has a single root application, encapsulating their specific applications, ensuring compliance with Disaster Recovery policies.

### 7.4.1 Reference Examples for creating a Root Application

Below are examples of YAML configurations for a root application taken from the [Template root app](https://dev.azure.com/bnl-ms/AzureFoundation/_git/template-ArgoCDApps).

#### Root App Manifest Configuration

The root application, located at [``/rootapps/appofapps.yaml``](https://dev.azure.com/bnl-ms/AzureFoundation/_git/template-ArgoCDApps?path=/manifests/rootapps/appofapps.yaml), defines the main configuration for the root app. It is configured to point to its own directory at `manifests/apps/overlays/prd`. This setup ensures that all other overlays are imported from this directory, consolidating all configurations in a single location.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: azure-aws-root-app
  namespace: argocd
  labels:
    name: azure-aws-root-app
    squad: azure-aws
    env: prd
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  destination:
    namespace: argocd
    name: in-cluster
  project: azure-tooling-hub-we
  source:
    path: manifests/apps/overlays/prd
    repoURL: https://dev.azure.com/bnl-ms/AzureFoundation/_git/ArgoCDApps
    targetRevision: main
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - PruneLast=true
```

#### Base Common Application Manifest Configuration

This configuration found at [``manifest/apps/common/app.yaml``](https://dev.azure.com/bnl-ms/AzureFoundation/_git/template-ArgoCDApps?path=/manifests/apps/common/app.yaml) acts as a reusable template for all applications under the root application. Each placeholder value (`TO_OVERLAY`) is intended to be dynamically replaced with application-specific parameters. This approach ensures consistency across applications while allowing customization for each deployment.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: TO_OVERLAY
  namespace: TO_OVERLAY
  labels:
    name: TO_OVERLAY
    squad: TO_OVERLAY
    env: TO_OVERLAY
spec:
  destination:
    name: TO_OVERLAY #cluster-name
    namespace: TO_OVERLAY
  project: TO_OVERLAY
  source:
    path: TO_OVERLAY
    repoURL: https://dev.azure.com/bnl-ms/AzureFoundation/_git/k8s-resources
    targetRevision: TO_OVERLAY
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - PruneLast=true
      - CreateNamespace=true
```      

#### custom application base manifest configuration

In the bases of our custom applications defined in the root of the repository, we can specify values that remain consistent for the application regardless of the environment. Examples include the destination namespace, squad label, and application namespace.

```YAML
...
resources:
  - ../../common

patches:
  - target:
      kind: Application
      name: .*
    patch: |
      - op: replace
        path: /metadata/namespace
        value: argocd
      - op: replace
        path: /metadata/labels/squad
        value: azure-aws
      - op: replace
        path: /spec/destination/namespace
        value: custom
``` 

#### Environment Overlay Manifest Configuration

The environment overlay, defined in the overlays of our custom applications, configures environment-specific customizations for an application by building on the base configuration. It adjusts key values such as the application name, environment label, destination cluster, project, and source paths. This ensures the overlay is tailored to the specific requirements of the integration environment while inheriting consistent settings from the base configuration.

```YAML 
...
resources:
  - ../../base/


patches:
  - target:
      kind: Application
      name: .*
    patch: |
      - op: replace
        path: /metadata/name
        value: custom-int
      - op: replace
        path: /metadata/labels/name
        value: custom-int
      - op: replace
        path: /metadata/labels/env
        value: int
      - op: replace
        path: /spec/destination/name
        value: cluster-name
      - op: replace
        path: /spec/project
        value: project-name
      - op: replace
        path: /spec/source/path
        value: manifests/custom-app/overlays/int
      - op: replace
        path: /spec/source/targetRevision
        value: prd
```

#### Main Overlay Configuration

The main overlay found at [`manifests/apps/overlays/prd`](https://dev.azure.com/bnl-ms/AzureFoundation/_git/template-ArgoCDApps?path=/manifests/apps/overlays/prd/kustomization.yaml) aggregates multiple environment-specific overlays configured in our custom application folders, such as `custom-app/overlays/prd` and `custom-app/overlays/int`, into a single configuration. This setup ensures that all environment overlays are combined and managed centrally, providing a unified view and simplifying deployment across multiple environments.

```YAML 
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../custom-app/overlays/prd
  - ../../custom-app/overlays/int
```

This root application example provides a structured setup for managing a team’s applications under a single, unified configuration, while ensuring automated synchronization and healing to maintain a consistent application state.

# 8. Configuring a Post-Deployment Overlay for a New Cluster.

![Assets](../../../assets/step_8.png)

To ensure each newly deployed cluster meets organizational standards for governance, compliance, and operational readiness, a postdeployment overlay must be configured. This overlay applies essential configurations and tools that are critical for the cluster's functionality and monitoring.

## 8.1 Overview

The postdeployment overlay is an essential step in the cluster deployment process. It is responsible for applying the default configurations required to operationalize a newly created cluster. Without this overlay, clusters lack critical configurations needed for monitoring, governance, and compliance. 

#### Why is it needed?
1. **Governance and Compliance**: Ensures all clusters adhere to organizational policies and standards.
2. **Operational Readiness**: Prepares clusters for seamless integration with monitoring and management tools.

## 8.2 Key Components of the Post-Deployment application

### 8.2.1 Azure Monitoring Agent

The **Azure Monitoring Agent** is deployed across all clusters to enable comprehensive infrastructure monitoring and logging. This ensures the health and performance of clusters can be continuously tracked.

Three critical ConfigMaps are applied during this process to define and manage the desired configurations for monitoring:

- [`ama-metrics-prometheus-config-configmap.yaml`](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/ama-metrics-prometheus-config-configmap.yaml) - azure monitor metrics prometheus configuration
- [`ama-metrics-settings-configmap.yaml`](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/ama-metrics-settings-configmap.yaml) - azure monitor metrics settings configuration
- [`azure-monitor.yaml`](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/manifests/post-deployment-app/base/azure-monitor.yaml) - data collection settings

By including the Azure Monitoring Agent in the post-deployment process, clusters are fully equipped to report telemetry and logs back to the central monitoring systems.

### 8.2.2 Cloud Workload Protection (CWP)

The **Cloud Workload Protection (CWP)** module, previously known as **Twistlock**, must be configured on every Kubernetes node to ensure compliance with group standards. This compliance is monitored by the **Prisma KPI team**, and warnings are issued if nodes are not protected. To address this, it is essential to include the CWP module in the ``post-deployment`` process.

The module is installed via a **Helm chart** provided by the group. Details on how to obtain this chart are available in the reference section. Currently, the chart is statically maintained in the `K8SResources` repository.

#### Future Improvements
To streamline updates, we should automate the process of fetching and maintaining the latest Helm chart. This could be achieved by implementing a small Go application to:

1. Fetch the most up-to-date chart from the group’s repository.
2. Store the chart in a centralized location, such as a storage account (charthost), for easy access.

This approach would reduce manual maintenance and ensure the use of the latest version of the CWP module across all nodes.

### 8.2.3 External Secrets Operator

This topic has already been extensively covered in [Section 2](#2-fetching-secrets-with-external-secrets-operator-eso). For additional insights, you can refer to the repository documentation available in the references section.

#### References
for a more detailed overview of the configurations check:
- [eso - repo docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/wiki/postdeployment/eso.md)
- [cwp - repo docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/wiki/postdeployment/cwp.md)
- [ama - repo docs](https://dev.azure.com/bnl-ms/AzureFoundation/_git/K8SResources?path=/wiki/postdeployment/ama.md)

## 8.2 Kustomize Structure

The post-deployment Kustomize structure is a great example of how we integrate Kustomize into our workflows. In the `K8SResources` repository, you can find the folder `post-deployment-app`. 

- **Base Folder**: The `base` folder contains the default configuration required for all hosts.  
- **Overlays Folder**: The `overlays` folder includes a subfolder for each squad. If a squad operates more than one cluster, you'll find an environment-specific subfolder under their respective squad folder.

Each environment contains a `patches` file for the service account. This file applies the necessary `client_id`—created in [previous steps](#231-configuring-workload-identity-federation-with-terraform)—to the service account. Additionally, there is a `values` file used for deploying the Twistlock (CWP) Helm chart. 

## 8.3 Usage: Create new postdeployment overlay for newly onboarded cluster.

Adding a new cluster overlay is a straightforward process:

1. **Create or Copy an Overlay Folder**: Create a new overlay folder specific to the team. Ensure you follow the naming convention:  
   `squadname/environment(if any)/region(if any)`.  

2. **Update the `patches-service-accounts.yaml` File**: Add the newly created `client_id`s to the `patches-service-accounts.yaml` file. These IDs are created during the process described in [chapter 2.3.1](#231-configuring-workload-identity-federation-with-terraform). By default, we always configure **two `SecretStores`**, which means you need to configure two service accounts.

   **Example configuration:**

   ```yaml
   apiVersion: v1 # ALM
   kind: ServiceAccount
   metadata:
     namespace: external-secrets
     name: azureaws-sa
     annotations:
       azure.workload.identity/client-id: <Your new ClientID here>
       azure.workload.identity/tenant-id: 24139d14-c62c-4c47-8bdd-ce71ea1d50cf
   ---
   apiVersion: v1 # Localfoundation
   kind: ServiceAccount
   metadata:
     name: workload-identity-eso-sa
     namespace: external-secrets
     annotations:
       azure.workload.identity/client-id: <Your new ClientID here>
       azure.workload.identity/tenant-id: 24139d14-c62c-4c47-8bdd-ce71ea1d50cf
   ```

   The `namespace` and `name` of the service accounts should remain unchanged to maintain a standardized approach. You may leave these fields as they are.

3. **Handle the `values` File**: The `values` file can be directly copied, as it does not contain any environment-specific values.  

4. **Add the Application to the Root App**: Follow the steps outlined in the process described in [chapter 7.4](#74-usage-create-a-new-root-application) to add a new application overlay to the root app.  

Once these steps are completed, your new compliant cluster is ready for use.  

# Enhancements

**TODO: Add references to official websites of ArgoCD & ESO & internal stuff**
- [ ] add pipeline to autoconvert readme.md to docx to be saved in AKS knowledge sharepoint. shell script is [here](./convert-to-docx.sh).


## Parts currently not included, create seperate chart & guide or reference
 - [ ] Post Deployments deep dive -> Decided to do a deep dive on every single software hosted by cloud team. Docs should be in K8Sresources per application and main doc in root of repo should call back to this.  
 - [ ] Monitoring & Alerting Setup (application & infrastructure)
 - [ ] ArgoCD initial Setup
   - [ ] initial setup with kustomize
   - [ ] initial rootapp
 - [ ] Storage configurations (storage account) using workload identity
 - [ ] (seperate operational doc?) SecretStore Configurations using workload identity + Governanc