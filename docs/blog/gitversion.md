# Automated Semantic Versioning Made Easy

**Under Construction**

Every project needs a solid versioning strategy. I’ve been using GitVersion for a while now to keep things consistent across the board. In this post, I’ll walk you through how I’ve hooked it into both GitHub and Azure DevOps, so you can easily drop it into your setup.

## Techstack

- Gitversion 6+
- Azure DevOps pipelines
- Github Actions

## Gitversion configuration example

TODO: Show my configuration file and what I am doing, say that the sky is the limit and if you want to do it different refer to gitversion official docs

## Incrementing the version

GitVersion gives you fine-grained control over version bumping through commit message conventions. Instead of relying solely on branch patterns, you can explicitly tell GitVersion what kind of version bump you want right in your commit message.

Here's how it works: GitVersion scans your commit messages for specific keywords and adjusts the version accordingly. No more guessing games about whether your change should bump the patch, minor, or major version.

### The Magic Keywords

GitVersion recognizes these patterns in your commit messages:

- `+semver: major` or `+semver: breaking` - Bumps the major version (1.0.0 → 2.0.0)
- `+semver: minor` or `+semver: feature` - Bumps the minor version (1.0.0 → 1.1.0)  
- `+semver: patch` or `+semver: fix` - Bumps the patch version (1.0.0 → 1.0.1)
- `+semver: none` or `+semver: skip` - No version bump at all

Here's how we use these in practice:

````bash
# Breaking changes
git commit -m "refactor: restructure user authentication +semver: major"

# New feature that doesn't break existing functionality
git commit -m "feat: add dark mode support +semver: minor"

# Bug fix or small improvement
git commit -m "fix: resolve memory leak in data processing +semver: patch"

# Documentation or build changes that don't affect the released code
git commit -m "docs: update installation guide +semver: none"
````

### Our tweaks

When using [our config file](https://github.com/michielvha/gitversion-tag-action/blob/main/gitversion.example.yml), we've pre-configured some additional behavior that makes trunk-based development even smoother. For example, we sometimes start a release branch where we already know the target version before merging back to main. 

To support this workflow, we've configured the template to recognize version-specific branch names. Meaning, if you create a branch like `release/0.2.0`, GitVersion will automatically set the version to `0.2.0` when that branch merges into main. This means we don`t need to rely on commit message conventions for the version bump.

## Real Project Example

Below share how we have implemeneted this on different git platforms with examples of using it in projects.

### Github

The GitHub marketplace lets us easily share our custom action. Check out the [action repo](https://github.com/michielvha/gitversion-tag-action/tree/main) to see how to use GitVersion on GitHub, feel free to fork or clone this action and tweak it to your needs. It's built to serve as a solid foundation for anyone to build on.

**features:**
- Tags the repo with the calculated `SemVer` and output the value for usage in subsequent steps.
- Annotates the tag with the latest commit message.
- Allows specifying a custom path for the configuration file.

### Azure DevOps

For Azure DevOps I will share a pipeline Template snippet that you can encorporate into your pipelines after setting it up.

## Reference

- [GitVersion Official Documentation](https://gitversion.net/docs)
- [GitVersion Config File Specification](https://gitversion.net/docs/reference/configuration) - Complete reference for the configuration file.
- [Version incrementing](https://gitversion.net/docs/reference/version-increments) - learn how to automatically increase the version.