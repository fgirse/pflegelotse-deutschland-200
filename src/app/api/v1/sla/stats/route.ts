import { NextResponse, type NextRequest } from 'next/server'
import { slaStats } from '@/server/sla/service'
import { requireAuth } from '@/server/auth/guard'

// GET /api/v1/sla/stats — SLA-Monitoring (/F440/). Geschützt.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  const stats = await slaStats()
  return NextResponse.json(stats)
}
