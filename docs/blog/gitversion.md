# Automated Semantic Versioning Made Easy

Every project needs a solid versioning strategy. I’ve been using [GitVersion][gitversion-docs] for a while now to keep things consistent across the board. In this post, I’ll walk you through how I’ve hooked it into both GitHub and Azure DevOps, so you can easily drop it into your setup.

## Techstack

The following technologies are describes in this article:

- Gitversion 6+
- Azure DevOps pipelines
- Github Actions

## What is GitVersion?

GitVersion is an open-source tool that automatically calculates semantic version numbers for your project based on your Git history. Instead of manually deciding what version number to use for each release, GitVersion analyzes your branch structure, commit messages, and tags to determine the appropriate version increment.

Think of it as your versioning autopilot. It follows [semantic versioning][semantic-version] (SemVer) principles, where versions follow the `MAJOR.MINOR.PATCH` format:
- **MAJOR** version for breaking changes that aren't backward compatible
- **MINOR** version for new features that maintain backward compatibility  
- **PATCH** version for bug fixes and small improvements

## Incrementing the version

GitVersion gives you fine-grained control over [version bumping][increment-version] through commit message conventions. Instead of relying solely on branch patterns, you can explicitly mention what kind of version bump you want right in your commit message. When making a commit the message is scanned for specific keywords which will adjust the version accordingly.

### The Magic Keywords

GitVersion recognizes these patterns in your commit messages:

- `+semver: major` or `+semver: breaking` - Bumps the major version (1.0.0 → 2.0.0)
- `+semver: minor` or `+semver: feature` - Bumps the minor version (1.0.0 → 1.1.0)  
- `+semver: patch` or `+semver: fix` - Bumps the patch version (1.0.0 → 1.0.1)
- `+semver: none` or `+semver: skip` - No version bump at all

Here's how you could use these in practice:

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

## Configuration example

Gitversion allows you to customize it's behaviour in many ways using a [configuration file][gitversion-config].

Below we'll share our [config file][gitversion-custom-example], which we've pre-configured with some additional behavior that makes trunk-based development even smoother. For example, we sometimes start a release branch where we already know the target version before merging back to main. 

To support this workflow, we've configured the template to recognize version-specific branch names. Meaning, if you create a branch like `release/0.2.0`, GitVersion will automatically set the version to `0.2.0` when that branch merges into main. This means we don`t need to rely on commit message conventions for the version bump.

::: tip
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

GitVersion integrates seamlessly into CI/CD pipelines, ensuring consistent versioning across different environments and teams. It eliminates the guesswork and human error that often comes with manual version management.

In this section we will show you how we integrated GitVersion into `Github Actions` and `Azure DevOps Pipelines`.

### Github

The GitHub marketplace lets us easily share our custom action. Check out the [action repo][gitversion-custom-action-repo] to see how to use GitVersion with GitHub actions, feel free to fork or clone this action and tweak it to your needs. It's built to serve as a solid foundation for anyone to build on.

**features:**
- Tags the repo with the calculated `SemVer` and output the value for usage in subsequent steps.
- Annotates the tag with the latest commit message.
- Allows specifying a custom path for the configuration file.

### Azure DevOps

For Azure DevOps, we will be sharing a [pipeline template][pipeline template] snippet that you can encorporate into your pipelines after setting it up. The general steps are the same but the specifics of the templating in the platforms are ofcourse handled a bit different.


[increment-version]: https://gitversion.net/docs/reference/version-increments
[gitversion-docs]: https://gitversion.net/docs
[gitversion-config]: https://gitversion.net/docs/reference/configuration
[gitversion-custom-action-repo]: https://github.com/michielvha/gitversion-tag-action/tree/main
[gitversion-custom-example]: https://github.com/michielvha/gitversion-tag-action/blob/main/gitversion.example.yml
[semantic-version]: https://semver.org/
[pipeline template]: https://github.com/michielvha/pipeline-templates
