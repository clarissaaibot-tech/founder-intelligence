'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
type Report = {
  id: string; founder_name: string; company: string; occupation: string
  industry: string; status: string; created_at: string
}
export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const supabase = createClient()
  const router = useRouter()
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserEmail(user.email || '')
      const { data } = await supabase
        .from('founder_reports')
        .select('id, founder_name, company, occupation, industry, status, created_at')
        .order('created_at', { ascending: false })
      setReports((data as Report[]) || [])
      setLoading(false)
    }
    load()
  }, [])
  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }
  const statusLabel: Record<string,string> = { pending:'等待中', processing:'分析中', done:'已完成', error:'出错' }
  const statusClass: Record<string,string> = { pending:'status-pending', processing:'status-processing', done:'status-done', error:'status-error' }
  function fmt(d:string) { return new Date(d).toLocaleDateString('zh-CN', {year:'numeric',month:'short',day:'numeric'}) }
  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">Founder Intelligence</div>
        <div className="dash-header-right">
          <span className="dash-user">{userEmail}</span>
          <button className="dash-logout" onClick={handleLogout}>退出</button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-intro">
          <h1>创始人情报报告</h1>
          <p>输入创始人的社交媒体链接，生成会面前的深度情报报告。</p>
        </div>
        {loading ? (
          <div className="processing-state"><div className="processing-spinner"/><h2>加载中...</h2></div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <h3>还没有报告</h3>
            <p>创建你的第一份创始人情报报告。</p>
            <Link href="/dashboard/new" className="btn-primary">+ 新建报告</Link>
          </div>
        ) : (
          <>
            <div className="reports-grid">
              {reports.map(r => (
                <Link href={"/dashboard/reports/"+r.id} key={r.id} style={{display:'block'}}>
                  <div className="report-card">
                    <div className="report-card-header">
                      <div>
                        <div className="report-card-name">{r.founder_name}</div>
                        <div className="report-card-meta">{[r.occupation,r.company,r.industry].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className={"report-status "+(statusClass[r.status]||'status-pending')}>{statusLabel[r.status]||r.status}</span>
                    </div>
                    <div className="report-card-date">{fmt(r.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/dashboard/new" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',background:'var(--accent)',color:'#000',borderRadius:10,fontSize:14,fontWeight:700}}>+ 新建报告</Link>
          </>
        )}
      </main>
    </div>
  )
}
