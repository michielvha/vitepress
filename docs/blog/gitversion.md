# Automated Semantic Versioning Made Easy

**Under Construction**

Every project needs a solid versioning strategy. I’ve been using GitVersion for a while now to keep things consistent across the board. In this post, I’ll walk you through how I’ve hooked it into both GitHub and Azure DevOps, so you can drop it into your setup without overthinking it.

## Techstack

- Gitversion v6+
- Azure DevOps pipelines
- Github Actions

## Gitversion configuration example

Show my configuration file and what I am doing, say that the sky is the limit and if you want to do it different refer to gitversion official docs

## Use commit messages to control the version

## Real Project Example

Below share how we have implemeneted this on different git platforms with examples of using it in projects.

### Github

The GitHub marketplace lets us share our custom action without any hassle. Check out the [action repo](https://github.com/michielvha/gitversion-tag-action/tree/main) to see how to use GitVersion on GitHub, feel free to fork or clone this action and tweak it to your needs. It's built to serve as a solid foundation for anyone to build on.

### Azure DevOps

For Azure DevOps I will share a pipeline Template snippet that you can encorporate into your pipelines after setting it up.

## Reference

- [GitVersion Official Documentation](https://gitversion.net/docs)
- [GitVersion Config File Specification](https://gitversion.net/docs/reference/configuration) - Complete reference for the configuration file.