# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### CI (`ci.yml`)
Runs on every push to main and on pull requests.

**Jobs:**
- **Test**: Runs tests on Node.js 18.x, 20.x, and 22.x
- **Build**: Builds the package and verifies artifacts
- **Publish**: Publishes to npm when commit message contains `[publish]`

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

### Pull Request (`pr.yml`)
Validates pull requests before merging.

**Jobs:**
- **Validate**: Checks formatting, linting, tests, and build
- **Security**: Runs security audit and checks for outdated dependencies

**Triggers:**
- Pull request opened, synchronized, or reopened

### Release (`release.yml`)
Creates releases and publishes to npm when a version tag is pushed.

**Jobs:**
- **Release**: Tests, builds, publishes to npm, and creates GitHub release

**Triggers:**
- Push of version tags (e.g., `v1.0.0`)

**Usage:**
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

### Coverage (`coverage.yml`)
Monitors code coverage and uploads to Codecov.

**Jobs:**
- **Coverage**: Runs tests with coverage, checks 80% threshold, uploads to Codecov

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

## Dependabot

Dependabot is configured to automatically update dependencies weekly.

**Configuration:**
- **npm dependencies**: Weekly updates on Mondays at 09:00 JST
- **GitHub Actions**: Weekly updates on Mondays at 09:00 JST
- **Grouping**: AWS SDK, TypeScript, and testing dependencies are grouped

## Required Secrets

The following secrets must be configured in the repository settings:

### NPM_TOKEN
Required for publishing to npm.

**Setup:**
1. Log in to npm: `npm login`
2. Create an access token: https://www.npmjs.com/settings/[username]/tokens
3. Select "Automation" token type
4. Add the token to GitHub repository secrets as `NPM_TOKEN`

### CODECOV_TOKEN (Optional)
Required for uploading coverage reports to Codecov.

**Setup:**
1. Sign up at https://codecov.io
2. Add your repository
3. Copy the upload token
4. Add the token to GitHub repository secrets as `CODECOV_TOKEN`

### GITHUB_TOKEN
Automatically provided by GitHub Actions. No setup required.

## Local Testing

You can test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Run CI workflow
act push

# Run PR workflow
act pull_request

# Run specific job
act -j test
```

## Workflow Status Badges

Add these badges to your README.md:

```markdown
[![CI](https://github.com/exabugs/dynamodb-client/actions/workflows/ci.yml/badge.svg)](https://github.com/exabugs/dynamodb-client/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/exabugs/dynamodb-client/branch/main/graph/badge.svg)](https://codecov.io/gh/exabugs/dynamodb-client)
[![npm version](https://badge.fury.io/js/@exabugs%2Fdynamodb-client.svg)](https://www.npmjs.com/package/@exabugs/dynamodb-client)
```
