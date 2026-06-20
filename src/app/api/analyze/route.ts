import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateAnalysis } from '@/lib/minimax'
import { spawn } from 'child_process'
import { join } from 'path'

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

async function scrapeInstagram(handle: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), 'scripts', 'scrape_instagram.py')
    const proc = spawn('python3', [scriptPath, handle], { timeout: 25000 })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })

    proc.on('error', () => resolve({}))
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed.success ? parsed : {})
      } catch {
        resolve({})
      }
    })

    setTimeout(() => { proc.kill(); resolve({}) }, 25000)
  })
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

    // Scrape Instagram if handle provided (non-blocking, graceful fallback)
    const enrichedReport = { ...report }
    if (report.ig_handle) {
      try {
        const cleanHandle = String(report.ig_handle)
          .replace(/^(https?:\/\/)?(www\.)?instagram\.com\/?/, '')
          .replace(/^@/, '')
          .replace(/\/.*$/, '')
          .trim()
        if (cleanHandle) {
          const igData = await scrapeInstagram(cleanHandle)
          if (igData && Object.keys(igData).length > 0) {
            enrichedReport.ig_bio = (igData as { bio?: string }).bio || report.ig_bio
            enrichedReport.ig_followers = (igData as { followers?: number }).followers || null
          }
        }
      } catch {
        // Instagram scrape failed — continue without it
      }
    }

    // Generate analysis
    const { analysis_en, analysis_zh } = await generateAnalysis(enrichedReport)

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
