# Introducing [Azure AI Proxy][proxy]

For some reason, Azure diagnostic settings don’t currently provide any insight into prompts and their responses. Microsoft suggests setting up APIM as a proxy, but that leads to vendor lock-in and requires configuring Event Hubs if you want to connect everything to a monitoring solution like ElasticSearch. To avoid all that complexity and stay cloud-agnostic, We’ve written a simple transparent proxy that captures these details. You can run it as a sidecar next to a Filebeat pod for easy monitoring. This solution is completely open-source and we welcome any contributions.

## how to use / integrate

This software was made to run as a container requiring only a few environment variables to get it setup. Making it easy to run along side any data shipper or as a standalone service.

### Example K8S Configuration

### Example Docker compose

## Improvements?

If you or your company are interested in using this solution but feel like you are missing some kind of feature feel free to contact us directly or create an issue on github.


[proxy]: https://github.com/michielvha/azure-ai-proxy