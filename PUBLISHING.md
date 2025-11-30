# Publishing Guide

This document describes how to publish `@exabugs/dynamodb-client` to npm.

## Pre-publish Checklist

### 1. Code Quality

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `tsc --noEmit`

### 2. Documentation

- [ ] README.md is up to date
- [ ] CHANGELOG.md is updated with new version
- [ ] API documentation is complete
- [ ] Examples are working

### 3. Package Configuration

- [ ] `package.json` version is updated
- [ ] `package.json` exports are correct
- [ ] `.npmignore` excludes unnecessary files
- [ ] `files` field in package.json is correct

### 4. Testing

- [ ] Unit tests pass (254 tests)
- [ ] Integration tests reviewed
- [ ] Examples tested manually

## Publishing Steps

### First Time Setup

1. **Login to npm**:

   ```bash
   npm login
   ```

2. **Verify your account**:
   ```bash
   npm whoami
   ```

### Publishing

1. **Update version** (choose one):

   ```bash
   npm version patch  # 0.1.0 -> 0.1.1
   npm version minor  # 0.1.0 -> 0.2.0
   npm version major  # 0.1.0 -> 1.0.0
   ```

2. **Update CHANGELOG.md**:
   - Add new version section
   - Document all changes

3. **Build and test**:

   ```bash
   npm run clean
   npm run build
   npm test
   ```

4. **Dry run** (check what will be published):

   ```bash
   npm publish --dry-run
   ```

5. **Publish to npm**:

   ```bash
   npm publish
   ```

6. **Create Git tag**:
   ```bash
   git add .
   git commit -m "chore: release v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```

## Post-publish

1. **Verify on npm**:
   - Visit https://www.npmjs.com/package/@exabugs/dynamodb-client
   - Check that all files are included
   - Test installation: `npm install @exabugs/dynamodb-client`

2. **Create GitHub Release**:
   - Go to https://github.com/exabugs/dynamodb-client/releases
   - Create new release from tag
   - Copy CHANGELOG content

3. **Update dependent projects**:
   - Update `kiro-ainews` to use published version
   - Test integration

## Troubleshooting

### "You do not have permission to publish"

Make sure you're logged in with the correct npm account:

```bash
npm whoami
npm login
```

### "Package name too similar to existing package"

The package name `@exabugs/dynamodb-client` should be unique under your scope.

### "Version already exists"

You need to bump the version number:

```bash
npm version patch
```

## Version Strategy

- **Patch** (0.1.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

Current version: **0.1.0** (initial release)

## Maintenance

### Regular Updates

- Keep dependencies up to date
- Monitor GitHub issues
- Review and merge pull requests
- Update documentation as needed

### Security

- Run `npm audit` regularly
- Update vulnerable dependencies promptly
- Follow security best practices
