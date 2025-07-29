# Introducing [Azure AI Proxy][proxy]

For some reason, Azure diagnostic settings don’t currently provide any insight into prompts and their responses. Microsoft suggests setting up APIM as a proxy, but that leads to vendor lock-in and requires configuring Event Hubs if you want to connect everything to a monitoring solution like ElasticSearch. To avoid all that complexity and stay cloud-agnostic, We’ve written a simple transparent proxy that captures these details. You can run it as a sidecar next to a Filebeat pod for easy monitoring. This solution is completely open-source and we welcome any contributions.

## how to use / integrate

This software was made to run as a container requiring only a few environment variables to get it setup. Making it easy to run along side any data shipper or as a standalone service.

### Example K8S Configuration

::: info
This example runs the proxy along side a filebeat container which can easily be swapped out for any other data shipping container.
:::

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: filebeat-azure-ai-proxy
spec:
  template:
    spec:
      containers:
      - name: filebeat
        image: filebeat
        args: [
          "-c", "/usr/share/filebeat/filebeat.yml",
          "-e",
        ]
        volumeMounts:
          - name: log-volume
            mountPath: /var/log/azure-ai-proxy
          - name: config
            mountPath: /usr/share/filebeat/filebeat.yml
            readOnly: true
            subPath: filebeat.yml
      - name:  azure-ai-proxy
        image: azure-ai-proxy
        env:
        - name: AZURE_OPENAI_ENDPOINT
          value: "https://openai-prd.openai.azure.com/"
        - name: LOG_FILE_PATH
          value: "/var/log/azure-ai-proxy/log.json"
        volumeMounts:
          - name: log-volume
            mountPath: /var/log/azure-ai-proxy
      volumes:
        - name: log-volume
          emptyDir: {}
        - name: config
          configMap:
            defaultMode: 0644
            name: filebeat-config
```

you'll need to define a `filebeat-config` ConfigMap for this to work, I'll provide a minimal example the authentication etc you'll have to fill in yourself.

```yaml
...
filebeat.inputs:
- type: filestream
  id: azure-ai-proxy
  enabled: true
  paths:
    - /var/log/azure-ai-proxy/log.json
  parsers:
    - ndjson:
        keys_under_root: true            # put the fields at root
        overwrite_keys: true             # let the JSON win over Filebeat defaults
        add_error_key: true              # surface JSON errors as fields
        timestamp_field: Timestamp
        timestamp_format: RFC3339Nano
  scan_frequency: 5s
...
```

### Example Docker compose

For non production workloads docker compose can be great to just get the service up and running to try it out.

```yaml
services:
  azure-ai-proxy:
    image: edgeforge/azure-ai-proxy:latest
    container_name: azure-ai-proxy
    ports:
      - "8080:8080"
    volumes:
      - ai_proxy_data:/openai_proxy.json
    restart: unless-stopped

volumes:
  ai_proxy_data:
```

## Improvements?

If you or your company are interested in using this solution but feel like you are missing some kind of feature feel free to contact us directly or create an issue on github.


[proxy]: https://github.com/michielvha/azure-ai-proxy