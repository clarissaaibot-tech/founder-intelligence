import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateAnalysis } from '@/lib/minimax'

async function getReport(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('founder_reports')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error('Report not found')
  return data
}

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'Missing reportId' }, { status: 400 })

    const supabase = createServiceClient()

    // Update status to processing
    await supabase.from('founder_reports').update({ status: 'processing' }).eq('id', reportId)

    // Fetch report
    const report = await getReport(reportId)

    // Generate analysis
    const { analysis_en, analysis_zh } = await generateAnalysis(report)

    // Save results
    await supabase.from('founder_reports').update({
      analysis_en,
      analysis_zh,
      status: 'done',
    }).eq('id', reportId)

    return NextResponse.json({ success: true, reportId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Analyze error:', message)
    try {
      const supabase = createServiceClient()
      const { reportId } = await req.clone().json().catch(() => ({ reportId: null }))
      if (reportId) {
        await supabase.from('founder_reports').update({ status: 'error', error_message: message }).eq('id', reportId)
      }
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
