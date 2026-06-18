'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
export default function NewReportPage() {
  const [form, setForm] = useState({founder_name:'',company:'',occupation:'',industry:'',location:'',x_handle:'',ig_handle:'',linkedin_url:'',website_url:'',report_language:'bilingual'})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient(); const router = useRouter()
  function set(field:string,v:string){setForm(f=>({...f,[field]:v}))}
  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault()
    if(!form.founder_name.trim()){setError('请填写创始人姓名');return}
    setLoading(true);setError('')
    const {data:{user}} = await supabase.auth.getUser()
    if(!user){router.replace('/');return}
    const {data:report,error:err} = await supabase.from('founder_reports').insert({
      founder_name:form.founder_name.trim(),
      company:form.company.trim()||null, occupation:form.occupation.trim()||null,
      industry:form.industry.trim()||null, x_handle:form.x_handle.trim()||null,
      ig_handle:form.ig_handle.trim()||null, linkedin_url:form.linkedin_url.trim()||null,
      website_url:form.website_url.trim()||null, report_language:form.report_language, status:'pending',
    }).select().single()
    if(err||!report){setError('创建失败：'+(err?.message||'未知错误'));setLoading(false);return}
    router.push('/dashboard/reports/'+report.id)
  }
  return (
    <div className="dashboard">
      <header className="dash-header"><div className="dash-logo">Founder Intelligence</div><div className="dash-header-right"><Link href="/dashboard" className="dash-logout">← 返回列表</Link></div></header>
      <main className="dash-main">
        <Link href="/dashboard" className="back-link">← 返回报告列表</Link>
        <div className="new-report-card">
          <h1 className="new-report-title">新建报告</h1>
          <p className="new-report-sub">填写创始人的基本信息，系统将自动抓取并分析其公开社交媒体档案。</p>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group form-full"><label>创始人姓名 *</label><input type="text" value={form.founder_name} onChange={e=>set('founder_name',e.target.value)} placeholder="例如：Matthew Lim" required/></div>
              <div className="form-group"><label>公司名称</label><input type="text" value={form.company} onChange={e=>set('company',e.target.value)} placeholder="例如：MLA Associates"/></div>
              <div className="form-group"><label>职业头衔</label><input type="text" value={form.occupation} onChange={e=>set('occupation',e.target.value)} placeholder="例如：Interior Designer"/></div>
              <div className="form-group"><label>行业</label><input type="text" value={form.industry} onChange={e=>set('industry',e.target.value)} placeholder="例如：Interior Design"/></div>
              <div className="form-group"><label>地点</label><input type="text" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="例如：Kuala Lumpur, Malaysia"/></div>
              <div className="form-group form-full" style={{marginTop:8}}><label style={{color:'var(--accent)',fontSize:11,letterSpacing:2}}>社交媒体链接（选填）</label></div>
              <div className="form-group"><label>X / Twitter</label><input type="text" value={form.x_handle} onChange={e=>set('x_handle',e.target.value)} placeholder="@username 或完整链接"/></div>
              <div className="form-group"><label>Instagram</label><input type="text" value={form.ig_handle} onChange={e=>set('ig_handle',e.target.value)} placeholder="@username 或完整链接"/></div>
              <div className="form-group"><label>LinkedIn</label><input type="url" value={form.linkedin_url} onChange={e=>set('linkedin_url',e.target.value)} placeholder="https://linkedin.com/in/..."/></div>
              <div className="form-group"><label>Website</label><input type="url" value={form.website_url} onChange={e=>set('website_url',e.target.value)} placeholder="https://..."/></div>
              <div className="form-group form-full"><label>报告语言</label><select value={form.report_language} onChange={e=>set('report_language',e.target.value)}><option value="bilingual">双语（英文 + 华文）</option><option value="en">英文</option><option value="zh">华文</option></select></div>
              {error&&<div className="form-full login-error" style={{padding:'12px 16px'}}>{error}</div>}
              <button type="submit" className="form-submit" disabled={loading}>{loading?'创建中...':'生成报告'}</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
