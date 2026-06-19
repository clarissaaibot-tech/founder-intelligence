'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Report {
  id: string
  founder_name: string
  company: string | null
  occupation: string | null
  industry: string | null
  location: string | null
  x_handle: string | null
  ig_handle: string | null
  linkedin_url: string | null
  website_url: string | null
  report_language: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error_message: string | null
  analysis_en: string | null
  analysis_zh: string | null
  created_at: string
}

function getField(obj: Record<string, unknown>, path: string): string {
  return (obj[path] as string) ?? '—'
}

function ReportSection({ title, children, lang }: { title: string; children: React.ReactNode; lang: 'en' | 'zh' }) {
  const labels: Record<string, Record<'en'|'zh', string>> = {
    'Profile Summary': { en: 'Profile Summary', zh: '人物简介' },
    'Public Perception': { en: 'Public Perception', zh: '公众印象' },
    'Content Pillars': { en: 'Content Pillars', zh: '内容支柱' },
    'Seen As': { en: 'Seen As', zh: '目前定位' },
    'Could Be Known For': { en: 'Could Be Known For', zh: '潜在定位' },
    'Gap Note': { en: 'Gap Note', zh: '差距说明' },
    'Conversation Starters': { en: 'Conversation Starters', zh: '对话开场' },
    'Priority Moves': { en: 'Priority Moves', zh: '优先行动' },
    'Stage': { en: 'Stage', zh: 'IP阶段' },
    'Sources': { en: 'Sources', zh: '来源' },
  }
  const l = labels[title]?.[lang] ?? title
  return (
    <div className="report-section">
      <h3 className="report-section-title">{l}</h3>
      <div className="report-section-content">{children}</div>
    </div>
  )
}

function renderField(data: Record<string, unknown>, key: string, lang: 'en'|'zh') {
  const val = getField(data, key)
  if (key === 'content_pillars' || key === 'conversation_starters' || key === 'priority_moves' || key === 'sources') {
    const arr = Array.isArray(data[key]) ? data[key] as string[] : []
    return arr.length > 0 ? arr.map((item, i) => <li key={i}>{item}</li>) : <span className="empty">—</span>
  }
  return <p>{val}</p>
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [report, setReport] = useState<Report | null>(null)
  const [lang, setLang] = useState<'en' | 'zh'>('zh')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState<string>('')
  const supabase = createClient()

  // Next.js 15+: params is a Promise
  useEffect(() => {
    params.then(p => setReportId(p.id))
  }, [params])

  async function fetchReport() {
    if (!reportId) return
    const { data } = await supabase.from('founder_reports').select('*').eq('id', reportId).single()
    if (data) setReport(data as Report)
  }

  async function triggerAnalysis() {
    if (!reportId) return
    setAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analysis failed')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (!reportId) return
    fetchReport()
    const interval = setInterval(fetchReport, 3000)
    return () => clearInterval(interval)
  }, [reportId])

  useEffect(() => {
    if (report && report.status === 'pending' && !analyzing) {
      triggerAnalysis()
    }
  }, [report?.status])

  if (!reportId || !report) return (
    <div className="dashboard">
      <header className="dash-header"><div className="dash-logo">Founder Intelligence</div></header>
      <main className="dash-main"><div className="loading">加载中...</div></main>
    </div>
  )

  const analysisData = lang === 'en'
    ? (report.analysis_en ? JSON.parse(report.analysis_en) : null)
    : (report.analysis_zh ? JSON.parse(report.analysis_zh) : null)

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">Founder Intelligence</div>
        <div className="dash-header-right">
          <Link href="/dashboard" className="dash-logout">← 返回列表</Link>
        </div>
      </header>
      <main className="dash-main">
        <Link href="/dashboard" className="back-link">← 返回报告列表</Link>

        <div className="report-card">
          <div className="report-header">
            <div>
              <h1 className="report-title">{report.founder_name}</h1>
              <p className="report-sub">
                {[report.company, report.occupation, report.industry, report.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="report-actions">
              <select value={lang} onChange={e => setLang(e.target.value as 'en'|'zh')}
                style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text)'}}>
                <option value="zh">华文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {report.status === 'pending' || report.status === 'processing' ? (
            <div className="report-generating">
              <div className="spinner" />
              <p>{report.status === 'pending' ? '准备分析...' : 'AI 正在分析中...'}</p>
              {analyzing && <p className="analyzing-note">调用 MiniMax API 生成报告，请稍候（最长30秒）</p>}
            </div>
          ) : report.status === 'error' ? (
            <div className="login-error" style={{padding:'16px'}}>
              <strong>分析出错：</strong> {report.error_message || error || '未知错误'}<br/>
              <button onClick={triggerAnalysis} style={{marginTop:12,padding:'8px 16px',background:'var(--accent)',color:'#000',border:'none',borderRadius:6,cursor:'pointer'}}>
                重试
              </button>
            </div>
          ) : analysisData ? (
            <div className="report-content">
              <ReportSection title="Profile Summary" lang={lang}>
                {renderField(analysisData, 'profile_summary', lang)}
              </ReportSection>
              <ReportSection title="Public Perception" lang={lang}>
                {renderField(analysisData, 'public_perception', lang)}
              </ReportSection>
              <ReportSection title="Content Pillars" lang={lang}>
                <ul>{renderField(analysisData, 'content_pillars', lang)}</ul>
              </ReportSection>
              <ReportSection title="Seen As" lang={lang}>
                {renderField(analysisData, 'seen_as', lang)}
              </ReportSection>
              <ReportSection title="Could Be Known For" lang={lang}>
                {renderField(analysisData, 'could_be_known_for', lang)}
              </ReportSection>
              <ReportSection title="Gap Note" lang={lang}>
                {renderField(analysisData, 'gap_note', lang)}
              </ReportSection>
              <ReportSection title="Conversation Starters" lang={lang}>
                <ul>{renderField(analysisData, 'conversation_starters', lang)}</ul>
              </ReportSection>
              <ReportSection title="Priority Moves" lang={lang}>
                <ul>{renderField(analysisData, 'priority_moves', lang)}</ul>
              </ReportSection>
              <ReportSection title="Stage" lang={lang}>
                {renderField(analysisData, 'stage', lang)}
              </ReportSection>
              <ReportSection title="Sources" lang={lang}>
                <ul>{renderField(analysisData, 'sources', lang)}</ul>
              </ReportSection>

              <div className="report-meta">
                <p>社交媒体: {[
                  report.x_handle && `X: ${report.x_handle}`,
                  report.ig_handle && `IG: ${report.ig_handle}`,
                  report.linkedin_url && `LI: ${report.linkedin_url}`,
                ].filter(Boolean).join(' | ') || '无'}</p>
                <p>创建时间: {new Date(report.created_at).toLocaleString('zh-CN')}</p>
              </div>
            </div>
          ) : (
            <div className="login-error" style={{padding:'16px'}}>
              报告数据格式异常，请重试生成
              <button onClick={triggerAnalysis} style={{marginTop:12,marginLeft:12,padding:'8px 16px',background:'var(--accent)',color:'#000',border:'none',borderRadius:6,cursor:'pointer'}}>
                重新分析
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
