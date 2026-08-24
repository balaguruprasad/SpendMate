import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Adds .openapi() to Zod and lets the generator read Zod schemas. Call once, before schemas load.
extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Mesa Finance API',
      version: '1.0.0',
      description: 'Procure-to-Pay / Accounts Payable backend for Mesa School of Business.',
    },
    servers: [{ url: '/api/v1' }],
  })
}
