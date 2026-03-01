# Secret Scanning Policy

WorkerFlow treats accidental credential commits as release-blocking incidents.

## Automation

- GitHub Actions workflow: `.github/workflows/secret-scan.yml`
- Scanner: `gitleaks`
- Baseline config: `.gitleaks.toml`

The secret scan runs on every push, pull request, and weekly schedule.

## Contributor Rules

1. Never commit real API keys, tokens, account IDs, database IDs, or private URLs.
2. Keep placeholders in repo-safe format (`REPLACE_WITH_*`).
3. Use `wrangler secret put` for sensitive runtime values.
4. If a scan fails, treat it as a required fix before merge.

## False Positives

If a finding is a known public placeholder or fixture:

1. confirm it is not a real credential
2. add a minimal regex allowlist entry in `.gitleaks.toml`
3. explain the allowlist change in the PR summary

Do not suppress findings broadly or disable scanners per repository path without maintainer approval.

## Incident Response

If a real secret is committed:

1. rotate/revoke the credential immediately
2. remove the secret from repository history if needed
3. open a security advisory per `SECURITY.md`
4. document mitigation in the related PR or incident issue
