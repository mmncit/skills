# Security Headers — Reference

## Header decision guide

| Header | Value | Rationale |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing. Always unconditional. |
| `X-XSS-Protection` | `0` | Disables the deprecated browser XSS Auditor. **Never use `1; mode=block`** — it enables a side-channel attack (attacker can block legitimate scripts to infer page content). Removed from Chrome v78 (2019). OWASP recommends `0`. Setting `0` still satisfies "missing header" scanner findings. |
| `Cache-Control` | `no-store` | API / auth services: apply unconditionally. SPAs: **cannot be global** — hashed assets must keep `public, max-age=31536000, immutable`. |
| `Pragma` | `no-cache` | Always pair with `Cache-Control: no-store` for HTTP/1.0 backward compat. |
| `Content-Security-Policy` | (custom) | Larger effort — requires auditing all inline scripts/styles. Implement in a separate ticket with report-only phase first. |

---

## Surface patterns

### Traefik Middleware CRD

```yaml
# <your-helm-chart>/templates/secure-headers-middleware.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: secure-headers
  namespace: {{ .Release.Namespace }}
spec:
  headers:
    customResponseHeaders:          # NOTE: must be customResponseHeaders, not responseHeaders
      X-Content-Type-Options: "nosniff"
      X-XSS-Protection: "0"
```

Wire to entrypoints in the environment-specific values file:

```yaml
# <your-helm-chart>/values-<env>.yaml
ports:
  web:
    http:
      middlewares:
        - "traefik-secure-headers@kubernetescrd"
  websecure:
    http:
      middlewares:
        - "traefik-secure-headers@kubernetescrd"
```

Reference pattern: `<helm-release-name>-<middleware-name>@kubernetescrd`

---

### nginx (SPA)

**Critical rule:** Any `location` block that has its own `add_header` directive does **NOT** inherit server-level `add_header` entries. Every security header must be repeated in every location block that sets any header.

```nginx
server {
    # Server-level: sets headers on responses not matched by a location block
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "0" always;

    # Hashed assets — safe to cache forever (content-addressed filenames)
    # Must be ABOVE "location /" to prevent falling into the no-store rule
    location /assets/ {
        root /usr/share/nginx/html;
        add_header Cache-Control "public, max-age=31536000, immutable";
        # Repeat ALL security headers — inheritance is broken by add_header presence
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "0" always;
    }

    # WASM files (also content-hashed)
    location ~ \.wasm$ {
        root /usr/share/nginx/html;
        types { application/wasm wasm; }
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "0" always;
    }

    # HTML shell and non-hashed root files (service workers, favicons, etc.)
    # Service worker files at root MUST NOT be cached long-term
    # Use path-based (/assets/) matching instead of extension-based (.js)
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html =404;
        add_header Cache-Control "no-store" always;
        add_header Pragma "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "0" always;
    }
}
```

**Why path-based (`/assets/`) not extension-based (`.js`) for immutable caching:**
Service workers (e.g. `service-worker.js`) live at the root and must never be cached long-term. Extension-based rules would incorrectly pin them. Vite/webpack emit all hashed chunks to `/assets/`, making `/assets/` the safe boundary.

---

### Next.js (`next.config.js`)

```js
async headers() {
  return [
    {
      // All responses — nosniff and XSS protection
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-XSS-Protection',       value: '0'       },
      ],
    },
    {
      // Sensitive pages and API routes — no caching
      // Negative lookahead excludes Next's content-hashed build assets:
      //   _next/static  — hashed JS/CSS chunks (immutable)
      //   _next/image   — optimised images (immutable)
      source: '/((?!_next/static|_next/image).*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Pragma',        value: 'no-cache'  },
      ],
    },
  ]
},
```

---

### ASP.NET Core middleware

```csharp
// Middlewares/SecurityHeadersMiddleware.cs
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // OnStarting fires before headers are sent — safe even when
        // downstream middlewares short-circuit the pipeline
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["X-XSS-Protection"]       = "0";
            context.Response.Headers["Cache-Control"]           = "no-store";
            context.Response.Headers["Pragma"]                  = "no-cache";
            return Task.CompletedTask;
        });
        await _next(context);
    }
}
```

Register in `Program.cs` / `Startup.cs` **before** auth middleware:

```csharp
app.UseMiddleware<SecurityHeadersMiddleware>();
```

**NUnit test pattern:**

```csharp
[Test]
public async Task OnStartingCallback_SetsXContentTypeOptions()
{
    await _middleware.InvokeAsync(_httpContextMock.Object);
    foreach (var cb in _onStartingCallbacks) await cb();

    var headers = _httpResponseMock.Object.Headers;
    Assert.That(headers["X-Content-Type-Options"].ToString(), Is.EqualTo("nosniff"));
}
```

Use `Response.OnStarting` capture pattern (collect callbacks via `Mock<HttpResponse>.Setup(r => r.OnStarting(...))`) so tests can trigger them manually.

---

## Branch stacking & merge order

```
main
 └── PROJ-001-first-header        ← PR 1  (e.g. X-Content-Type-Options)
      └── PROJ-002-second-header  ← PR 2  (e.g. Cache-Control)
           └── PROJ-003-third-header ← PR 3 (e.g. X-XSS-Protection)
```

- Fork each ticket's branch from the **tip of the previous ticket's branch**
- Merge in creation order — merging out of order creates conflicts
- Set each PR's base branch to its parent ticket branch (not `main`) for a clean diff

---

## PR description template

```markdown
## [TICKET-ID] Security: Add <header-name>

**Jira/Tracker:** <link>

### What the problem was
<One paragraph: what was missing, what could go wrong without it>

### What was changed
<File-by-file table or bullet list with code snippets>

### Why <value> (not <alternative>)
<Cite OWASP / RFC / browser support; especially important for X-XSS-Protection: 0>

### Merge order
This branch was forked from `<parent-branch>`.
Merge order: `<grandparent>` → `<parent>` → **this PR**

### Related PRs
| Ticket | Repo | PR |
|---|---|---|
| TICKET-AAAA | repo-1 | #N |
| TICKET-AAAA | repo-2 | #N |
| TICKET-BBBB | repo-1 | #N |
```
