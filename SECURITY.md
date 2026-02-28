# Security Policy

WorkerFlow security focuses on ingress protection, secret hygiene, and replay-safe operational controls.

## Reporting a Vulnerability

Do not open public issues for security-sensitive findings.

Preferred reporting channel (private):

- GitHub Private Vulnerability Reporting form:
  - https://github.com/joelborch/workerflow/security/advisories/new

Include:

- affected area and impact
- reproduction steps
- suggested remediation (if available)

## Scope

Security reports are especially important for:

- authentication and authorization paths
- secrets management and credential handling
- webhook ingress validation
- replay/retry and dead-letter endpoints
- connector auth and secret usage patterns
