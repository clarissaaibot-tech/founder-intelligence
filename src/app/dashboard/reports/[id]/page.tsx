'use client'
import { useEffect, useState, useCallback } from 'react'
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

type AnalysisData = {
  // Core fields
  profile_summary: string
  public_perception: string
  bio_deep_dive?: string
  content_pillars: string[]
  content_themes?: { theme: string; frequency: string; engagement: string }[]
  seen_as: string
  could_be_known_for: string
  gap_note: string
  competitive_positioning?: string
  ip_opportunities?: string[]
  audience_profile?: {
    demographics?: string
    interests?: string
    pain_points?: string
  }
  personal_brand_score?: {
    score: number
    max: number
    breakdown: string
  }
  social_reach_analysis?: {
    x_metrics?: { followers: number | null; engagement_rate?: string; reach_assessment?: string }
    ig_metrics?: { followers: number | null; posts: number | null; engagement_rate?: string; reach_assessment?: string }
  }
  web_presence_summary?: {
    mentions?: number
    sentiment?: string
    key_articles?: string[]
  }
  conversation_starters: string[]
  priority_moves: string[]
  stage: string
  sources: string[]
}

function Section({ title, children, lang }: { title: string; children: React.ReactNode; lang: 'en' | 'zh' }) {
  const labels: Record<string, Record<'en' | 'zh', string>> = {
    'Profile Summary': { en: 'Profile Summary', zh: '人物简介' },
    'Public Perception': { en: 'Public Perception', zh: '公众印象' },
    'Bio Deep Dive': { en: 'Bio Deep Dive', zh: 'Bio 深度解读' },
    'Content Pillars': { en: 'Content Pillars', zh: '内容支柱' },
    'Content Themes': { en: 'Content Themes', zh: '内容主题' },
    'Audience Profile': { en: 'Audience Profile', zh: '受众画像' },
    'Competitive Positioning': { en: 'Competitive Positioning', zh: '竞争定位' },
    'IP Opportunities': { en: 'IP Opportunities', zh: 'IP 机会' },
    'Personal Brand Score': { en: 'Personal Brand Score', zh: '个人品牌评分' },
    'Social Reach': { en: 'Social Reach Analysis', zh: '社交媒体影响力' },
    'Web Presence': { en: 'Web Presence', zh: '网络存在感' },
    'Seen As': { en: 'Currently Seen As', zh: '目前定位' },
    'Could Be Known For': { en: 'Could Be Known For', zh: '潜在定位' },
    'Gap Note': { en: 'Gap Analysis', zh: '差距分析' },
    'Conversation Starters': { en: 'Conversation Starters', zh: '对话开场白' },
    'Priority Moves': { en: 'Priority Moves', zh: '优先行动' },
    'Stage': { en: 'IP Stage', zh: 'IP 阶段' },
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

function ArrayField({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <span className="empty">—</span>
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 4 }}>{item}</li>
      ))}
    </ul>
  )
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: 16, color, minWidth: 36 }}>{score}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/{max}</span></span>
    </div>
  )
}

function SocialReachCard({ data, lang }: { data: AnalysisData['social_reach_analysis']; lang: 'en' | 'zh' }) {
  if (!data) return null
  const isZh = lang === 'zh'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {data.x_metrics && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, letterSpacing: 1 }}>X / TWITTER</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {data.x_metrics.followers != null ? data.x_metrics.followers.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>粉丝 Followers</div>
          {data.x_metrics.engagement_rate && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              互动: {data.x_metrics.engagement_rate}
            </div>
          )}
          {data.x_metrics.reach_assessment && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {data.x_metrics.reach_assessment}
            </div>
          )}
        </div>
      )}
      {data.ig_metrics && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#E1306C', marginBottom: 8, letterSpacing: 1 }}>INSTAGRAM</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {data.ig_metrics.followers != null ? data.ig_metrics.followers.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>粉丝 Followers</div>
          {data.ig_metrics.posts != null && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{data.ig_metrics.posts.toLocaleString()} 帖子</div>
          )}
          {data.ig_metrics.engagement_rate && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              互动: {data.ig_metrics.engagement_rate}
            </div>
          )}
          {data.ig_metrics.reach_assessment && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {data.ig_metrics.reach_assessment}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SafeRender({ report, lang }: { report: Report; lang: 'en' | 'zh' }) {
  let data: AnalysisData | null = null
  let parseError = ''
  try {
    const raw = lang === 'en' ? report.analysis_en : report.analysis_zh
    if (!raw) {
      parseError = 'No data'
    } else if (typeof raw === 'object') {
      data = raw as AnalysisData
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        parseError = 'Empty string'
      } else {
        data = JSON.parse(trimmed) as AnalysisData
      }
    }
  } catch (e: unknown) {
    parseError = e instanceof Error ? e.message : 'Unknown parse error'
  }

  if (!data) {
    const raw = lang === 'en' ? report.analysis_en : report.analysis_zh
    const debugInfo = typeof raw === 'string' ? raw.slice(0, 200) : String(raw)
    return (
      <div style={{ padding: '16px' }}>
        <strong>报告数据格式异常</strong>
        <p style={{ fontSize: 11, color: '#999', margin: '8px 0' }}>Raw: {debugInfo}</p>
        <p style={{ fontSize: 11, color: '#999' }}>Error: {parseError}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '6px 12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          刷新重试
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Core Summary */}
      <Section title="Profile Summary" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7 }}>{data.profile_summary}</p>
      </Section>

      <Section title="Public Perception" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7 }}>{data.public_perception}</p>
      </Section>

      {data.bio_deep_dive && (
        <Section title="Bio Deep Dive" lang={lang}>
          <p style={{ margin: 0, lineHeight: 1.7 }}>{data.bio_deep_dive}</p>
        </Section>
      )}

      {data.audience_profile && (
        <Section title="Audience Profile" lang={lang}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.audience_profile.demographics && (
              <div><strong style={{ fontSize: 11, color: 'var(--accent)' }}>人口统计</strong><p style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{data.audience_profile.demographics}</p></div>
            )}
            {data.audience_profile.interests && (
              <div><strong style={{ fontSize: 11, color: 'var(--accent)' }}>兴趣标签</strong><p style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{data.audience_profile.interests}</p></div>
            )}
            {data.audience_profile.pain_points && (
              <div><strong style={{ fontSize: 11, color: 'var(--accent)' }}>痛点</strong><p style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{data.audience_profile.pain_points}</p></div>
            )}
          </div>
        </Section>
      )}

      <Section title="Content Pillars" lang={lang}>
        <ArrayField items={data.content_pillars} />
      </Section>

      {data.content_themes && data.content_themes.length > 0 && (
        <Section title="Content Themes" lang={lang}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>主题</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>频率</th>
                <th style={{ textAlign: 'left', padding: '4px 0 4px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>互动</th>
              </tr>
            </thead>
            <tbody>
              {data.content_themes.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '6px 8px 6px 0', color: 'var(--text)' }}>{t.theme}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{t.frequency}</td>
                  <td style={{ padding: '6px 0 6px 8px', color: 'var(--text-secondary)' }}>{t.engagement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Seen As" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7 }}>{data.seen_as}</p>
      </Section>

      <Section title="Could Be Known For" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--accent)' }}>{data.could_be_known_for}</p>
      </Section>

      <Section title="Gap Note" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7 }}>{data.gap_note}</p>
      </Section>

      {data.competitive_positioning && (
        <Section title="Competitive Positioning" lang={lang}>
          <p style={{ margin: 0, lineHeight: 1.7 }}>{data.competitive_positioning}</p>
        </Section>
      )}

      {data.ip_opportunities && data.ip_opportunities.length > 0 && (
        <Section title="IP Opportunities" lang={lang}>
          <ArrayField items={data.ip_opportunities} />
        </Section>
      )}

      {data.personal_brand_score && (
        <Section title="Personal Brand Score" lang={lang}>
          <ScoreBar score={data.personal_brand_score.score} max={data.personal_brand_score.max} />
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {data.personal_brand_score.breakdown}
          </p>
        </Section>
      )}

      {data.social_reach_analysis && (
        <Section title="Social Reach" lang={lang}>
          <SocialReachCard data={data.social_reach_analysis} lang={lang} />
        </Section>
      )}

      {data.web_presence_summary && (
        <Section title="Web Presence" lang={lang}>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            {data.web_presence_summary.mentions != null && (
              <div><strong style={{ color: 'var(--accent)' }}>{data.web_presence_summary.mentions}</strong> 搜索结果</div>
            )}
            {data.web_presence_summary.sentiment && (
              <div><strong>情绪:</strong> {data.web_presence_summary.sentiment}</div>
            )}
          </div>
          {data.web_presence_summary.key_articles && data.web_presence_summary.key_articles.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 4px' }}>相关文章:</p>
              <ArrayField items={data.web_presence_summary.key_articles} />
            </div>
          )}
        </Section>
      )}

      <Section title="Conversation Starters" lang={lang}>
        <ArrayField items={data.conversation_starters} />
      </Section>

      <Section title="Priority Moves" lang={lang}>
        <ArrayField items={data.priority_moves} />
      </Section>

      <Section title="Stage" lang={lang}>
        <p style={{ margin: 0, lineHeight: 1.7 }}>{data.stage}</p>
      </Section>

      {data.sources && data.sources.length > 0 && (
        <Section title="Sources" lang={lang}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {data.sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                {s.startsWith('http') ? (
                  <a href={s} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                    {s.length > 60 ? s.slice(0, 60) + '...' : s}
                  </a>
                ) : s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="report-meta">
        <p>社交媒体: {[
          report.x_handle && `X: ${report.x_handle}`,
          report.ig_handle && `IG: ${report.ig_handle}`,
          report.linkedin_url && `LI: ${report.linkedin_url}`,
        ].filter(Boolean).join(' | ') || '无'}</p>
        <p>创建时间: {new Date(report.created_at).toLocaleString('zh-CN')}</p>
      </div>
    </>
  )
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [report, setReport] = useState<Report | null>(null)
  const [lang, setLang] = useState<'en' | 'zh'>('zh')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState<string>('')
  const [initError, setInitError] = useState('')
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    try {
      setSupabase(createClient())
    } catch (e) {
      setInitError('Supabase 客户端初始化失败：环境变量未正确配置')
    }
  }, [])

  useEffect(() => {
    params.then(p => setReportId(p.id))
  }, [params])

  const fetchReport = useCallback(async () => {
    if (!reportId || !supabase) return
    const { data } = await supabase.from('founder_reports').select('*').eq('id', reportId).single()
    if (data) setReport(data as Report)
  }, [reportId, supabase])

  const triggerAnalysis = useCallback(async () => {
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
  }, [reportId])

  useEffect(() => {
    if (!reportId || !supabase) return
    fetchReport()
    const interval = setInterval(fetchReport, 4000)
    return () => clearInterval(interval)
  }, [reportId, supabase, fetchReport])

  useEffect(() => {
    if (report && report.status === 'pending') {
      triggerAnalysis()
    }
  }, [report?.status, triggerAnalysis])

  if (initError) return (
    <div className="dashboard">
      <header className="dash-header"><div className="dash-logo">Founder Intelligence</div></header>
      <main className="dash-main">
        <div className="login-error" style={{ padding: '16px' }}>{initError}</div>
      </main>
    </div>
  )

  if (!reportId || !report) return (
    <div className="dashboard">
      <header className="dash-header"><div className="dash-logo">Founder Intelligence</div></header>
      <main className="dash-main"><div className="loading">加载中...</div></main>
    </div>
  )

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
              <select value={lang} onChange={e => setLang(e.target.value as 'en' | 'zh')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)' }}>
                <option value="zh">华文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {report.status === 'pending' || report.status === 'processing' ? (
            <div className="report-generating">
              <div className="spinner" />
              <p>{report.status === 'pending' ? '准备分析...' : 'AI 正在深度抓取 + 分析中...'}</p>
              {analyzing && <p className="analyzing-note">
                抓取 X 推文、Instagram 帖子、网络搜索 → 生成个性化报告（最长60秒）
              </p>}
            </div>
          ) : report.status === 'error' ? (
            <div className="login-error" style={{ padding: '16px' }}>
              <strong>分析出错：</strong> {report.error_message || error || '未知错误'}<br />
              <button onClick={() => triggerAnalysis()} style={{ marginTop: 12, padding: '8px 16px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                重试
              </button>
            </div>
          ) : (
            <SafeRender report={report} lang={lang} />
          )}
        </div>
      </main>
    </div>
  )
}
