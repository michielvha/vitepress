# Automated Semantic Versioning Made Easy

Every project needs a solid versioning strategy. I’ve been using [GitVersion][gitversion-docs] for a while now to keep things consistent across the board. In this post, I’ll walk you through how I’ve hooked it into both GitHub and Azure DevOps, so you can easily drop it into your setup.

## Techstack

The following technologies are describes in this article:

- Gitversion 6+
- Azure DevOps pipelines
- Github Actions

## What is GitVersion?

**Section Under Construction**
TODO: short intro into what GitVersion is for people who are not familiar with it.

## Incrementing the version

GitVersion gives you fine-grained control over [version bumping][increment-version] through commit message conventions. Instead of relying solely on branch patterns, you can explicitly mention what kind of version bump you want right in your commit message. When making a commit the message is scanned for specific keywords which will adjust the version accordingly.

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

## Gitversion configuration example

Gitversion allows you to customize it's behaviour in many ways using a [configuration file][gitversion-config].

Below we'll share [our config file](https://github.com/michielvha/gitversion-tag-action/blob/main/gitversion.example.yml), which we've pre-configured with some additional behavior that makes trunk-based development even smoother. For example, we sometimes start a release branch where we already know the target version before merging back to main. 

To support this workflow, we've configured the template to recognize version-specific branch names. Meaning, if you create a branch like `release/0.2.0`, GitVersion will automatically set the version to `0.2.0` when that branch merges into main. This means we don`t need to rely on commit message conventions for the version bump.

::: important
The configuration below requires you to already have an existing semantic tag on your repository when running the first time.
:::

```yml
# manually verify with `gitversion (/showconfig)`
workflow: GitHubFlow/v1

strategies:
  - MergeMessage
  - TaggedCommit
  - TrackReleaseBranches
  - VersionInBranchName
branches:
  main:
    regex: ^master$|^main$
    increment: Patch
    prevent-increment:
      of-merged-branch: true
    track-merge-target: false
    track-merge-message: true
    is-main-branch: true
    mode: ContinuousDeployment # also do it here
  release:
    # Custom release branch configuration
    regex: ^release/(?<BranchName>[0-9]+\.[0-9]+\.[0-9]+)$
    label: ''
    increment: None
    prevent-increment:
      when-current-commit-tagged: true
      of-merged-branch: true
    is-release-branch: true
    mode: ContinuousDeployment # do not use ContinuousDelivery, else it will increment the version with a suffix on each commit.
    source-branches:
      - main
```

This configuration reflects our preferred approach, but you can easily adapt it to meet your specific requirements and workflow needs.

## Integrate GitVersion into your workflow.

**Section Under Construction**

TODO: write a quick intro for how we integrate into pipelines

To easily integrate GitVersion into your pipelines we'll be sharing some premade snippets

### Github

The GitHub marketplace lets us easily share our custom action. Check out the [action repo][gitversion-custom-action-repo] to see how to use GitVersion with GitHub actions, feel free to fork or clone this action and tweak it to your needs. It's built to serve as a solid foundation for anyone to build on.

**features:**
- Tags the repo with the calculated `SemVer` and output the value for usage in subsequent steps.
- Annotates the tag with the latest commit message.
- Allows specifying a custom path for the configuration file.

### Azure DevOps

For Azure DevOps I will share a pipeline Template snippet that you can encorporate into your pipelines after setting it up.


[increment-version]: (https://gitversion.net/docs/reference/version-increments)
[gitversion-docs]: (https://gitversion.net/docs)
[gitversion-config]: (https://gitversion.net/docs/reference/configuration)
[gitversion-custom-action-repo]: (https://github.com/michielvha/gitversion-tag-action/tree/main)