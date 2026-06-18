'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : error.message)
    } else {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Check if user already exists — try login first
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
    if (!loginErr) {
      // Already has account, just redirect
      window.location.href = '/dashboard'
      return
    }

    // Try signup — skip email confirmation for faster testing
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/dashboard',
        data: { skip_email_confirmation: true }
      }
    })

    if (error) {
      setError(error.message)
    } else {
      // Auto sign in after signup
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setSuccess('账号创建成功！请查收验证邮件，然后登录。')
        setMode('login')
      } else {
        window.location.href = '/dashboard'
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Founder Intelligence</div>

        {mode === 'login' ? (
          <>
            <h1 className="login-title">登录</h1>
            <p className="login-sub">输入你的账号信息，进入创始人情报系统。</p>
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label>邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="team@company.com"
                  required
                />
              </div>
              <div className="login-field">
                <label>密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-dim)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                没有账号？注册团队账号
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="login-title">注册</h1>
            <p className="login-sub">创建团队账号，开始生成创始人情报报告。</p>
            <form className="login-form" onSubmit={handleSignUp}>
              <div className="login-field">
                <label>邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="team@company.com"
                  required
                />
              </div>
              <div className="login-field">
                <label>密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="设置密码（至少6位）"
                  minLength={6}
                  required
                />
              </div>
              {error && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? '创建中...' : '创建账号并登录'}
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-dim)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                已有账号？登录
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
