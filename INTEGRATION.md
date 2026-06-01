# Integrating Audit-Annotate into your Express App

This guide wires the Audit-Annotate tool into your existing Node.js/Express site so that
it lives at `yoursite.com/audit` and uses your existing login system.

---

## How it works

```
Browser → yoursite.com/audit     → Express serves the React static files
Browser → yoursite.com/audit/api → Express proxies to the private FastAPI service
```

The FastAPI service is deployed as a **private Render service** — it is not accessible
from the public internet, only from your Express app running on Render.

---

## Step 1 — Deploy the FastAPI service on Render

1. Push this repo to GitHub (already done)
2. In your Render dashboard, click **New → Web Service**
3. Connect the `Audit-Annotate` repo
4. Set root directory to `backend`
5. Set build command: `pip install -r requirements.txt`
6. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `AUDIT_SECRET` = a long random string (generate below)
   - `DATABASE_URL` = (create a Render PostgreSQL and use its connection string)
8. Note the **internal service URL** Render assigns (e.g. `http://audit-annotate-api:10000`)

Generate a shared secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Use this same value for `AUDIT_SECRET` in **both** Render services.

---

## Step 2 — Build the React frontend

In this repo:
```bash
cd frontend
NODE_ENV=production npm run build
```

This produces `frontend/dist/` with base path `/audit/`.

Copy the contents of `frontend/dist/` into your Express app's repo, for example at
`public/audit/`.  Commit and push.

---

## Step 3 — Install proxy middleware in your Express app

```bash
npm install http-proxy-middleware jsonwebtoken
```

---

## Step 4 — Add these routes to your Express app

Add this file to your project, e.g. `routes/audit.js`:

```js
const path = require('path')
const crypto = require('crypto')
const { createProxyMiddleware } = require('http-proxy-middleware')
const jwt = require('jsonwebtoken')

const AUDIT_SECRET = process.env.AUDIT_SECRET
const FASTAPI_URL  = process.env.AUDIT_API_URL  // e.g. http://audit-annotate-api:10000

if (!AUDIT_SECRET) console.warn('[audit] AUDIT_SECRET not set — auth disabled')
if (!FASTAPI_URL)  console.warn('[audit] AUDIT_API_URL not set — proxy disabled')

// ── Generate a short-lived token for the logged-in user ──────────────────────
function makeAuditToken(userId) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    exp: Math.floor(Date.now() / 1000) + 3600,  // 1 hour
  })).toString('base64url')
  const sig = crypto
    .createHmac('sha256', AUDIT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}

module.exports = function auditRoutes(app) {

  // ── Auth gate — must be logged in to access /audit ───────────────────────
  app.use('/audit', (req, res, next) => {
    // Replace req.user with however your app stores the logged-in user.
    // Common patterns: req.user (Passport.js), req.session.user, decoded JWT, etc.
    if (!req.user) {
      return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`)
    }
    next()
  })

  // ── Proxy /audit/api/* → FastAPI (private service) ───────────────────────
  if (FASTAPI_URL) {
    app.use(
      '/audit/api',
      (req, res, next) => {
        // Inject a fresh audit token into every proxied request
        if (AUDIT_SECRET && req.user) {
          req.headers['authorization'] = `Bearer ${makeAuditToken(req.user.id)}`
        }
        next()
      },
      createProxyMiddleware({
        target: FASTAPI_URL,
        changeOrigin: true,
        pathRewrite: { '^/audit/api': '/api' },  // strip /audit prefix before forwarding
      })
    )

    // Proxy uploaded file downloads too
    app.use(
      '/audit/uploads',
      createProxyMiddleware({
        target: FASTAPI_URL,
        changeOrigin: true,
        pathRewrite: { '^/audit/uploads': '/uploads' },
      })
    )
  }

  // ── Serve the React SPA for all /audit/* GET requests ────────────────────
  const AUDIT_DIST = path.join(__dirname, '../public/audit')  // adjust to where you copied /dist

  app.use('/audit', require('express').static(AUDIT_DIST))

  app.get('/audit/*', (req, res) => {
    res.sendFile(path.join(AUDIT_DIST, 'index.html'))
  })
}
```

---

## Step 5 — Register the routes in your main Express app

In your main `app.js` or `server.js`, add:

```js
const auditRoutes = require('./routes/audit')
auditRoutes(app)
```

Add these environment variables to your **Express app's** Render service:

| Variable | Value |
|---|---|
| `AUDIT_SECRET` | same secret you set on the FastAPI service |
| `AUDIT_API_URL` | the FastAPI service's internal Render URL |

---

## Step 6 — Add `req.user` if you don't have it already

The code above uses `req.user` as the logged-in user object.  If your app uses a
different pattern, adjust accordingly:

| Auth pattern | How to get the user |
|---|---|
| Passport.js | `req.user` (already works) |
| Express session | `req.session.user` |
| JWT in cookie | Decode the cookie: `jwt.verify(req.cookies.token, process.env.JWT_SECRET)` |
| Custom middleware | Whatever your existing auth middleware sets |

---

## Step 7 — Test locally

```bash
# Terminal 1 — FastAPI
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — React dev server (proxies to FastAPI directly)
cd frontend && npm run dev

# Terminal 3 — Your Express app
AUDIT_API_URL=http://localhost:8000 node app.js
```

Navigate to `http://localhost:3000/audit` (or whatever port your Express app uses).

---

---

## Adding the tool-switcher nav to your Trial Balance app

To show the same pill tabs inside your Trial Balance tool (so users can
switch back to Audit & Annotate from there too), add this snippet to
whatever template or layout your Trial Balance app uses.

### If your Trial Balance app is Express + EJS / Pug / Handlebars

Add to your shared layout template:

```html
<style>
  .tool-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(15,23,42,0.6);
    border: 1px solid rgba(71,85,105,0.5);
    border-radius: 8px;
    padding: 2px;
  }
  .tool-nav a, .tool-nav span {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .tool-nav a          { color: #94a3b8; }
  .tool-nav a:hover    { background: rgba(51,65,85,0.6); color: white; }
  .tool-nav .active    { background: #2563eb; color: white; cursor: default; }
</style>

<nav class="tool-nav">
  <span class="active">
    <!-- Scale icon -->
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M12 3v18M3 9h18M5 20h14M8 3h8"/>
    </svg>
    Trial Balance
  </span>
  <a href="/audit">
    <!-- FileSearch icon -->
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <circle cx="10" cy="15" r="2"/>
      <line x1="16" y1="21" x2="13.4" y2="18.4"/>
    </svg>
    Audit &amp; Annotate
  </a>
</nav>
```

### If your Trial Balance app is React

Copy `frontend/src/components/ToolNav.tsx` from this repo into your
Trial Balance app and swap which tool is `active: true`.

---

## Environment variable summary

### FastAPI service (Render)
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `AUDIT_SECRET` | Shared signing secret (generate with `openssl rand -hex 32`) |
| `DATABASE_URL` | Render PostgreSQL connection string |
| `CORS_ORIGINS` | `https://trial-balance-toolv2.onrender.com` (or your Express host domain) |

### Express app (Render)
| Variable | Description |
|---|---|
| `AUDIT_SECRET` | **Same** shared secret as above |
| `AUDIT_API_URL` | Internal URL of the FastAPI Render service |
