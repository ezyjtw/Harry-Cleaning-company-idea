import { PrismaClient } from '@prisma/client'

// catchmentPolygon is a large stored isochrone (100s of KB of GeoJSON per
// cleaner) that ONLY the coverage predicate should ever read. Globally omitted
// so no include/no-select query can lift it by accident — loading it on hot
// paths (/api/cleaners on every homepage view) starved the connection pool and
// 503'd the dashboard's 8-query burst. The four coverage consumers re-enable
// it explicitly with `omit: { catchmentPolygon: false }` or an explicit select.
const createClient = () =>
  new PrismaClient({
    omit: { cleanerProfile: { catchmentPolygon: true } },
  })

type AppPrismaClient = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient }

export const prisma = globalForPrisma.prisma || createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
