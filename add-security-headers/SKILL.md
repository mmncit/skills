---
name: add-security-headers
description: Implements HTTP security response headers across a polyglot microservices platform. Use when asked to add or fix security headers (X-Content-Type-Options, X-XSS-Protection, Cache-Control, Pragma, Content-Security-Policy) flagged by a pentest, scanner, or security ticket. Covers all common surfaces: Kubernetes ingress (Traefik), nginx SPA, Next.js, and ASP.NET Core middleware. Handles header value decisions, nginx inheritance gotchas, asset-caching carve-outs, stacked branch sequencing, and PR description templates.
---

# Security Headers

See [REFERENCE.md](REFERENCE.md) for per-surface code patterns, header decision guide, and PR template.

## Workflow

### 1. Identify surfaces

| Surface | Typical location |
|---|---|
| Kubernetes ingress (Traefik) | Helm chart — Middleware CRD template |
| SPA served by nginx | `nginx.conf` |
| Next.js app | `next.config.js` |
| ASP.NET Core service | `Middlewares/SecurityHeadersMiddleware.cs` |

### 2. Decide the header value — before writing any code

- **X-Content-Type-Options** → always `nosniff`
- **X-XSS-Protection** → always `0` (not `1; mode=block` — see REFERENCE.md §Headers)
- **Cache-Control** → `no-store` for API/auth responses; **cannot be global for SPAs** — carve out hashed assets first
- **Pragma** → `no-cache` alongside every `Cache-Control: no-store` (HTTP/1.0 compat)

### 3. Branch strategy

- Each security ticket gets its own branch **forked from the previous ticket's branch** (not from `main`)
- PRs must merge in the same order they were forked
- Document merge order in every PR description

### 4. Verify

```bash
# Through the ingress (Traefik adds headers at ingress layer — direct pod curl won't show them)
curl -sI https://<host>/ | grep -iE 'x-content-type|x-xss|cache-control'

# Kubernetes: confirm CRD exists
kubectl get middleware -n traefik
```
