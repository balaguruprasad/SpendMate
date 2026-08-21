import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 moved connection config out of schema.prisma into here.
// The CLI uses datasource.url for `migrate dev` / `migrate deploy` / `generate`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
