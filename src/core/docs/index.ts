import path from 'node:path'
import express from 'express'
import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'
import { buildOpenApiDocument } from './registry.js'

// Self-host the Redoc bundle from node_modules (no third-party CDN).
const redocBundleDir = path.join(process.cwd(), 'node_modules', 'redoc', 'bundles')

const redocHtml = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Mesa Finance — API Reference</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{margin:0}</style></head>
<body><redoc spec-url="/openapi.json"></redoc>
<script src="/redoc-assets/redoc.standalone.js"></script>
</body></html>`

export function mountDocs(app: Express): void {
  const doc = buildOpenApiDocument()

  app.get('/openapi.json', (_req, res) => {
    res.json(doc)
  })

  // Swagger UI — interactive explorer (serves its own bundled assets).
  app.use(
    '/docs',
    ...swaggerUi.serve,
    swaggerUi.setup(doc as unknown as Parameters<typeof swaggerUi.setup>[0], {
      customSiteTitle: 'Mesa Finance — API Docs',
    }),
  )

  // Redoc — self-hosted bundle + a tiny HTML host page.
  app.use('/redoc-assets', express.static(redocBundleDir))
  app.get('/redoc', (_req, res) => {
    res.type('html').send(redocHtml)
  })
}
