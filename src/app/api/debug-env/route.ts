import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.MINIMAX_API_KEY
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    prefix: key ? key.slice(0, 8) + '...' : null,
    // Never return the full key
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ SUPABASE_URL set' : '✗ MISSING',
    anonKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleSet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })
}
