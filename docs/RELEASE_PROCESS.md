# Release Process

## Versioning

- follow semver (`MAJOR.MINOR.PATCH`)
- runtime package version lives in `cloudflare/package.json`

## Release Checklist

```bash
cd cloudflare
npm run release:check
```

Update release docs:

- append `CHANGELOG.md`
- add upgrade notes in `docs/UPGRADE_GUIDE.md`

## Tagging

From repository root:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Automated Release Workflow

Tag pushes matching `v*` trigger:

- Cloudflare runtime `release:check`
- Pages dashboard `release:check`
- Draft GitHub Release with generated release notes

Workflow file:

- `.github/workflows/release-tag.yml`

## Post-Release

- announce route/schedule contract changes explicitly
- update migration guidance for private overlays
- verify downstream private repos can rebase/merge cleanly
