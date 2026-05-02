# Releasing wyde

Maintainer-only runbook. Skip if you're not me.

GitHub Actions handles the heavy lifting: push a version tag, the
`release.yml` workflow builds a universal `.dmg` (Apple Silicon +
Intel), and uploads it to a draft GitHub Release. You review the
draft, click Publish, share the link.

## One-time

```bash
git remote add origin https://github.com/bernshawtsui/wyde.git
git push -u origin main
```

(Already done. Listed here for reference.)

## Cut a release

1. **Bump versions** to the same number across all three files
   (tauri-action verifies they match the tag):
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Commit the bump.
3. **Tag and push**:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. The `release` workflow runs on `macos-latest` (~5–10 min). When
   it finishes, a draft release appears at
   <https://github.com/bernshawtsui/wyde/releases> with two assets
   attached:
   - `wyde_<version>_universal.dmg` — primary download
   - `wyde_<version>_universal.app.tar.gz` — alternative archive
5. Edit the release notes, click **Publish**.

## Local zip (no tag, ad-hoc)

For quick shares without cutting a real release:

```bash
pnpm dist
```

Produces `releases/wyde.zip` at the repo root — built for whatever
arch the local machine is. Send the zip; recipient unzips, drops
`wyde.app` into `/Applications`, right-click → Open the first time.

## Re-running the release workflow

Two ways:

- **Manual rebuild without re-tagging**: Actions tab →
  `release` → "Run workflow". Useful when investigating a CI flake.
- **Different tag**: tag and push again. Each tag produces its own
  draft release.

## Notes

- Builds are **unsigned**. Recipients see the unsigned-developer
  Gatekeeper warning the first time; the README documents the
  right-click → Open workaround.
- Push auth uses the credential helper installed by `gh auth login`
  (token in keyring). Nothing to configure per-release.
- The `GITHUB_TOKEN` used inside the workflow is auto-provided by
  GitHub Actions. No secrets to manage.
- A version-bump helper is **not** wired up. Three files, by hand,
  keep it simple. If this becomes a hassle, look at `release-please`
  or `changesets`.
