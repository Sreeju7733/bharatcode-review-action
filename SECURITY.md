# Security Policy

The BharatCode team takes the security and integrity of our automated review tooling seriously. This policy outlines our supported versions and responsible disclosure procedures.

---

## Supported Versions

Security updates and patches are actively maintained for the following versions:

| Major Version | Status |
| :--- | :--- |
| `v1.x` | Supported |
| `< v1.0.0` | Unsupported |

---

## Reporting a Vulnerability

If you discover a security vulnerability within BharatCode PR Reviewer, do not report it through public GitHub issues or discussions.

Instead, please send a report to our security team:

📧 **security@bharatcode.ai**

### What to Include

To help us triage and resolve the issue quickly, include:
- A clear description of the vulnerability and its potential impact.
- The specific version or commit SHA of the action affected.
- Step-by-step instructions or a minimal reproducible example.
- Any relevant logs (with credentials and tokens redacted).

### Response Process

1. **Acknowledgment**: We acknowledge receipt of vulnerability reports within 48 business hours.
2. **Assessment**: Our maintainers will evaluate the report, verify the problem, and determine the affected components.
3. **Remediation**: We prepare a fix and release an updated minor/patch version alongside an update to the floating `v1` tag.
4. **Disclosure**: We follow a coordinated 90-day disclosure timeline from initial report to public announcement, unless an accelerated release is mutually agreed upon.
