import type { RequestHandler } from 'express'
import { config } from '../config/index.js'
import { pingDb } from '../db/index.js'
import { docsAuthConfigured } from '../admin/basic-auth.js'
import {
  isStorageConfigured,
  pingStorage,
  storageBucketName,
  useSignedUrls,
} from '../storage/gcs.js'

const startedAt = Date.now()

function formatUptime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// The feature routers mounted in app.ts. Kept in sync by hand — one row per slice.
const SERVICES: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'Authentication', path: '/api/v1/auth' },
  { name: 'Vendors', path: '/api/v1/vendors' },
  { name: 'Invoices', path: '/api/v1/invoices' },
  { name: 'Departments', path: '/api/v1/departments' },
  { name: 'Cost centres', path: '/api/v1/cost-centres' },
  { name: 'Sub-cost-centres', path: '/api/v1/sub-cost-centres' },
  { name: 'Batches', path: '/api/v1/batches' },
  { name: 'Users', path: '/api/v1/users' },
  { name: 'Payments', path: '/api/v1/payments' },
  { name: 'Bank accounts', path: '/api/v1/bank-accounts' },
]

// Inline SVGs (no external requests; not subject to img-src CSP).
const ICONS = {
  swagger: '<path d="M4 6h16M4 12h16M4 18h10" stroke-width="1.6" stroke-linecap="round"/>',
  redoc: '<path d="M5 4h9l5 5v11a0 0 0 0 1 0 0H5z" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 4v5h5" stroke-width="1.6"/>',
  spec: '<path d="M9 7 4.5 12 9 17M15 7l4.5 5L15 17" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  health:
    '<path d="M3.5 12h4l2-5 3 9 2-4h5.5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
}

function card(href: string, icon: string, title: string, desc: string, external = false): string {
  const target = external ? ' target="_blank" rel="noreferrer"' : ''
  return `<a class="card" href="${href}"${target}>
    <span class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${icon}</svg></span>
    <span class="card-body"><span class="card-title">${title}</span><span class="card-desc">${desc}</span></span>
    <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 17 17 7M9 7h8v8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>`
}

// One status row inside a health panel: a coloured dot + label on the left, a status chip on the right.
function row(label: string, sub: string, ok: boolean, status: string): string {
  return `<div class="hrow">
    <span class="hrow-main"><span class="dot ${ok ? 'ok' : 'bad'}"></span>
      <span class="hrow-tx"><span class="hrow-label">${label}</span><span class="hrow-sub">${sub}</span></span>
    </span>
    <span class="chip ${ok ? 'chip-ok' : 'chip-bad'}">${status}</span>
  </div>`
}

const STYLES = `
:root{
  --bg:#080b10; --panel:#0d1219; --line:rgba(255,255,255,.08);
  --text:#eaf0f6; --muted:#8a93a3; --faint:#5c6573;
  --accent:#5ee3a6; --accent-2:#39c0ff; --accent-ink:#06281c;
  --bad:#f0683a;
  --radius:18px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body{
  font-family:'Poppins',system-ui,sans-serif; color:var(--text); background:var(--bg);
  min-height:100dvh; display:grid; place-items:center; padding:2.5rem 1.25rem; position:relative; overflow-x:hidden;
}
body::before{content:'';position:fixed;inset:0;z-index:-2;
  background:
    radial-gradient(60rem 40rem at 12% -8%, rgba(94,227,166,.16), transparent 60%),
    radial-gradient(50rem 38rem at 105% 12%, rgba(57,192,255,.12), transparent 55%),
    var(--bg);
}
body::after{content:'';position:fixed;inset:0;z-index:-1;opacity:.5;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:46px 46px;
  -webkit-mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent 80%);
          mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent 80%);
}
.wrap{width:100%;max-width:780px}
.reveal{opacity:0;transform:translateY(14px);animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes rise{to{opacity:1;transform:none}}
.brand{display:flex;align-items:center;gap:.85rem;margin-bottom:2.4rem}
.mark{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex:none;
  background:linear-gradient(150deg,var(--accent),#2bbf86);
  box-shadow:0 8px 30px -8px rgba(94,227,166,.55), inset 0 1px 0 rgba(255,255,255,.4);}
.mark span{font-weight:700;font-size:1.45rem;color:var(--accent-ink);letter-spacing:-.04em}
.brand .bt{display:flex;flex-direction:column;line-height:1.15}
.brand .bt b{font-weight:600;font-size:1.02rem;letter-spacing:-.01em}
.brand .bt small{color:var(--muted);font-size:.74rem;font-weight:400;letter-spacing:.02em}
.eyebrow{font-size:.7rem;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--accent);margin-bottom:1rem}
h1{font-weight:600;font-size:clamp(2.1rem,5.5vw,3.25rem);letter-spacing:-.035em;line-height:1.02}
h1 .thin{font-weight:300;color:var(--muted)}
.lede{margin-top:1rem;color:var(--muted);font-size:1.02rem;font-weight:300;max-width:46ch;line-height:1.6}
.status{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.8rem}
.pill{display:inline-flex;align-items:center;gap:.5rem;padding:.42rem .8rem;border:1px solid var(--line);
  border-radius:999px;background:rgba(255,255,255,.02);font-size:.78rem;font-weight:400;color:var(--muted)}
.pill b{color:var(--text);font-weight:500}
.dot{width:.5rem;height:.5rem;border-radius:50%;flex:none;position:relative}
.dot.ok{background:var(--accent);box-shadow:0 0 0 0 rgba(94,227,166,.5);animation:pulse 2.4s infinite}
.dot.bad{background:var(--bad)}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(94,227,166,.45)}70%{box-shadow:0 0 0 7px rgba(94,227,166,0)}100%{box-shadow:0 0 0 0 rgba(94,227,166,0)}}
.panels{margin-top:2.2rem;display:grid;grid-template-columns:1fr 1fr;gap:.85rem}
.panel{border:1px solid var(--line);border-radius:var(--radius);
  background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));padding:1.1rem 1.15rem}
.panel-h{display:flex;align-items:center;gap:.55rem;margin-bottom:.85rem;font-size:.72rem;font-weight:600;
  letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.panel-h .dot{width:.46rem;height:.46rem}
.hrow{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.55rem 0;border-top:1px solid var(--line)}
.hrow:first-of-type{border-top:0;padding-top:0}
.hrow-main{display:flex;align-items:flex-start;gap:.6rem;min-width:0}
.hrow-main .dot{margin-top:.42rem}
.hrow-tx{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.hrow-label{font-size:.9rem;font-weight:500;letter-spacing:-.01em}
.hrow-sub{font-size:.72rem;color:var(--muted);font-weight:300;line-height:1.4;overflow:hidden;text-overflow:ellipsis}
.chip{flex:none;font-size:.68rem;font-weight:500;padding:.26rem .6rem;border-radius:999px;letter-spacing:.01em;white-space:nowrap}
.chip-ok{color:var(--accent);background:rgba(94,227,166,.1);border:1px solid rgba(94,227,166,.28)}
.chip-bad{color:var(--bad);background:rgba(240,104,58,.1);border:1px solid rgba(240,104,58,.3)}
.grid{margin-top:.85rem;display:grid;grid-template-columns:1fr 1fr;gap:.85rem}
.card{display:flex;align-items:center;gap:1rem;padding:1.05rem 1.15rem;border:1px solid var(--line);
  border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));
  text-decoration:none;color:var(--text);transition:transform .25s,border-color .25s,background .25s;position:relative;overflow:hidden}
.card:hover{transform:translateY(-3px);border-color:rgba(94,227,166,.5);background:linear-gradient(180deg,rgba(94,227,166,.07),rgba(255,255,255,.015))}
.card-ico{width:40px;height:40px;border-radius:11px;flex:none;display:grid;place-items:center;
  background:rgba(94,227,166,.1);border:1px solid rgba(94,227,166,.22);color:var(--accent)}
.card-ico svg{width:20px;height:20px}
.card-body{display:flex;flex-direction:column;gap:.12rem;min-width:0}
.card-title{font-weight:500;font-size:.95rem;letter-spacing:-.01em}
.card-desc{font-size:.78rem;color:var(--muted);font-weight:300}
.card-arrow{width:17px;height:17px;margin-left:auto;color:var(--faint);transition:transform .25s,color .25s;flex:none}
.card:hover .card-arrow{color:var(--accent);transform:translate(2px,-2px)}
.section-label{margin:2.2rem 0 .9rem;font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
footer{margin-top:2.6rem;padding-top:1.3rem;border-top:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;align-items:center;color:var(--faint);font-size:.74rem;font-weight:300}
footer .sep{color:var(--line)}
footer a{color:var(--muted);text-decoration:none}
footer a:hover{color:var(--accent)}
@media(max-width:560px){.panels,.grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.reveal{animation:none;opacity:1;transform:none}.dot.ok{animation:none}}
`

const BRAND = `<div class="brand reveal" style="animation-delay:.02s">
    <div class="mark"><span>m</span></div>
    <div class="bt"><b>SpendMate</b><small>Credit-card invoice tracker · Mesa</small></div>
  </div>`

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>${STYLES}</style>
</head>
<body><main class="wrap">${body}</main></body>
</html>`
}

/**
 * PUBLIC landing page (GET /). Deliberately generic — no environment name, DB status, internal
 * latency, version-leaking runtime info, or the list of API routes. Anything operationally
 * sensitive lives behind basic auth on /health.
 */
export const landing: RequestHandler = (_req, res) => {
  const body = `
  ${BRAND}
  <p class="eyebrow reveal" style="animation-delay:.08s">Procure&#8202;-&#8202;to&#8202;-&#8202;Pay Platform</p>
  <h1 class="reveal" style="animation-delay:.14s">Mesa&nbsp;Finance&nbsp;API <span class="thin">is running.</span></h1>
  <p class="lede reveal" style="animation-delay:.2s">Vendor onboarding, invoicing with GST &amp; TDS, multi-level approvals, and payment recording — served over a typed REST API.</p>

  <div class="status reveal" style="animation-delay:.26s">
    <span class="pill"><span class="dot ok"></span><b>API operational</b></span>
  </div>

  <div class="grid reveal" style="animation-delay:.32s">
    ${card('/docs', ICONS.swagger, 'API Explorer', 'Interactive Swagger UI', true)}
    ${card('/redoc', ICONS.redoc, 'Reference', 'Readable Redoc documentation', true)}
    ${card('/openapi.json', ICONS.spec, 'OpenAPI Schema', 'Machine-readable 3.1 spec', true)}
    ${card('/health', ICONS.health, 'System Health', 'Live status (sign-in required)', true)}
  </div>

  <footer class="reveal" style="animation-delay:.4s">
    <span>Mesa School of Business</span><span class="sep">·</span>
    <a href="/health">/health</a>
    <span style="margin-left:auto">&copy; ${new Date().getFullYear()}</span>
  </footer>`
  res.type('html').send(page('SpendMate · API', body))
}

/**
 * AUTHENTICATED status dashboard (GET /health, behind DOCS_USERNAME/DOCS_PASSWORD basic auth).
 * Shows DB connectivity + latency, per-service status, environment, uptime and runtime details —
 * everything intentionally kept off the public landing page.
 */
export const health: RequestHandler = async (_req, res) => {
  const dbStart = Date.now()
  const dbOk = await Promise.race([
    pingDb()
      .then(() => true)
      .catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
  ])
  const dbMs = Date.now() - dbStart

  const docsOn = docsAuthConfigured()
  const uptime = formatUptime(Math.floor((Date.now() - startedAt) / 1000))
  const env = config.NODE_ENV

  // Google Cloud Storage reachability (bucket exists) — only probed when configured.
  const gcsConfigured = isStorageConfigured()
  let gcsOk = false
  let gcsMs = 0
  if (gcsConfigured) {
    const gcsStart = Date.now()
    gcsOk = await Promise.race([
      pingStorage()
        .then(() => true)
        .catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
    ])
    gcsMs = Date.now() - gcsStart
  }

  const allOk = dbOk && (!gcsConfigured || gcsOk)

  const gcsSub = !gcsConfigured
    ? 'GCS_BUCKET_NAME unset — file uploads disabled'
    : gcsOk
      ? `Bucket "${storageBucketName()}" reachable · ${gcsMs}ms · ${useSignedUrls() ? 'signed-URL mode' : 'proxy-upload mode'}`
      : 'Bucket unreachable — check service-account credentials / bucket name'

  const systemRows = [
    row('API server', 'HTTP request handler', true, 'Operational'),
    row(
      'PostgreSQL database',
      dbOk ? `Connection successful · ${dbMs}ms round-trip` : 'Connection failed — check DATABASE_URL / Cloud SQL',
      dbOk,
      dbOk ? 'Connected' : 'Unreachable',
    ),
    row('Authentication (JWT)', 'Access & refresh signing keys loaded', true, 'Ready'),
    row(
      'Google Cloud Storage',
      gcsSub,
      gcsConfigured && gcsOk,
      !gcsConfigured ? 'Disabled' : gcsOk ? 'Connected' : 'Unreachable',
    ),
    row(
      'API documentation',
      docsOn ? 'Swagger / Redoc behind basic auth' : 'DOCS_USERNAME/PASSWORD unset — endpoints disabled',
      docsOn,
      docsOn ? 'Enabled' : 'Disabled',
    ),
  ].join('')

  const serviceRows = SERVICES.map((s) => row(s.name, s.path, dbOk, dbOk ? 'Active' : 'Degraded')).join('')

  const body = `
  ${BRAND}
  <p class="eyebrow reveal" style="animation-delay:.08s">Operations</p>
  <h1 class="reveal" style="animation-delay:.14s">System <span class="thin">health.</span></h1>
  <p class="lede reveal" style="animation-delay:.2s">Live status of the API, database and feature services. This view is authenticated and never exposed on the public landing page.</p>

  <div class="status reveal" style="animation-delay:.26s">
    <span class="pill"><span class="dot ${allOk ? 'ok' : 'bad'}"></span><b>${allOk ? 'All systems operational' : 'Service degraded'}</b></span>
    <span class="pill">env&nbsp;<b>${env}</b></span>
    <span class="pill">version&nbsp;<b>v1.0.0</b></span>
    <span class="pill">uptime&nbsp;<b>${uptime}</b></span>
  </div>

  <div class="panels reveal" style="animation-delay:.3s">
    <div class="panel">
      <div class="panel-h"><span class="dot ${allOk ? 'ok' : 'bad'}"></span>System health</div>
      ${systemRows}
    </div>
    <div class="panel">
      <div class="panel-h"><span class="dot ${dbOk ? 'ok' : 'bad'}"></span>Services</div>
      ${serviceRows}
    </div>
  </div>

  <p class="section-label reveal" style="animation-delay:.36s">Documentation &amp; tools</p>
  <div class="grid reveal" style="animation-delay:.4s">
    ${card('/docs', ICONS.swagger, 'API Explorer', 'Interactive Swagger UI', true)}
    ${card('/redoc', ICONS.redoc, 'Reference', 'Readable Redoc documentation', true)}
    ${card('/openapi.json', ICONS.spec, 'OpenAPI Schema', 'Machine-readable 3.1 spec', true)}
    ${card('/readyz', ICONS.health, 'Readiness', 'DB-backed readiness probe (JSON)', true)}
  </div>

  <footer class="reveal" style="animation-delay:.46s">
    <span>Mesa School of Business</span><span class="sep">·</span>
    <span>Node ${process.version}</span><span class="sep">·</span>
    <a href="/healthz">/healthz</a>
    <span style="margin-left:auto">&copy; ${new Date().getFullYear()}</span>
  </footer>`
  res.type('html').send(page('SpendMate · System Health', body))
}
