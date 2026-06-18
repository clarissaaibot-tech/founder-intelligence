const MINIMAX_API_URL = 'https://api.minimax.io/anthropic/v1/messages'
const MINIMAX_MODEL = 'MiniMax-M2.7'

interface AnalysisResult {
  profile_summary: string
  public_perception: string
  content_pillars: string[]
  seen_as: string
  could_be_known_for: string
  gap_note: string
  conversation_starters: string[]
  priority_moves: string[]
  stage: string
  sources: string[]
}

function buildPrompt(report: Record<string, unknown>, lang: 'en' | 'zh'): string {
  const {
    founder_name = '', company = '', occupation = '', industry = '', location = '',
    x_handle = '', ig_handle = '', linkedin_url = '', website_url = '',
    x_followers = null, x_bio = '', ig_followers = null, ig_bio = '',
  } = report as Record<string, unknown>

  const isZh = lang === 'zh'
  const name = String(founder_name)
  const co = String(company)
  const ind = String(industry)
  const loc = String(location)

  if (isZh) {
    return `你是创始人情报分析专家。请基于以下信息，生成一份关于 ${name} 的深度情报报告。

【创始人信息】
姓名: ${name}
公司: ${co || '未知'}
职业: ${occupation || '未知'}
行业: ${ind || '未知'}
地点: ${loc || '未知'}
X/Twitter: ${x_handle || '无'} | 粉丝: ${x_followers ?? '未知'} | Bio: ${x_bio || '无'}
Instagram: ${ig_handle || '无'} | 粉丝: ${ig_followers ?? '未知'} | Bio: ${ig_bio || '无'}
LinkedIn: ${linkedin_url || '无'}
网站: ${website_url || '无'}

请以JSON格式输出，字段如下，全部用中文：
{
  "profile_summary": "一段80字以内的简介，描述这位创始人的核心身份和事业",
  "public_perception": "一句话描述公众/行业对他的认知",
  "content_pillars": ["内容支柱1", "内容支柱2", "内容支柱3"],
  "seen_as": "他目前在公众眼中的定位（一句话）",
  "could_be_known_for": "他可以被认知的更高定位（一句话）",
  "gap_note": "差距说明——他现在被看到的位置和应该被看到的位置之间的差距（2-3句话）",
  "conversation_starters": ["对话开场问题1", "对话开场问题2", "对话开场问题3"],
  "priority_moves": ["优先行动1", "优先行动2", "优先行动3"],
  "stage": "IP发展阶段：早期探索者/有产品待规模化/已是行业IP/跨界转型中，并说明理由",
  "sources": ["来源1", "来源2"]
}

只输出JSON，不要其他文字。JSON必须可以被JSON.parse()解析。`
  }

  // English
  return `You are a founder intelligence analyst. Based on the following information, generate a deep intelligence report on ${name}.

[Founder Info]
Name: ${name}
Company: ${co || 'Unknown'}
Occupation: ${occupation || 'Unknown'}
Industry: ${ind || 'Unknown'}
Location: ${loc || 'Unknown'}
X/Twitter: ${x_handle || 'None'} | Followers: ${x_followers ?? 'Unknown'} | Bio: ${x_bio || 'None'}
Instagram: ${ig_handle || 'None'} | Followers: ${ig_followers ?? 'Unknown'} | Bio: ${ig_bio || 'None'}
LinkedIn: ${linkedin_url || 'None'}
Website: ${website_url || 'None'}

Output as JSON only, no other text:
{
  "profile_summary": "80-char max description of this founder's core identity and work",
  "public_perception": "One sentence on how the public/industry perceives them",
  "content_pillars": ["pillar1", "pillar2", "pillar3"],
  "seen_as": "Current public positioning (one sentence)",
  "could_be_known_for": "Higher positioning they could be known for (one sentence)",
  "gap_note": "Gap explanation — 2-3 sentences on the gap between current and potential positioning",
  "conversation_starters": ["icebreaker Q1", "icebreaker Q2", "icebreaker Q3"],
  "priority_moves": ["priority move 1", "priority move 2", "priority move 3"],
  "stage": "IP stage: Early Explorer / Product-Ready-to-Scale / Industry IP / Cross-Sector Pivot + reasoning",
  "sources": ["source1", "source2"]
}

Only output valid JSON. Must be parseable by JSON.parse().`
}

async function callMiniMax(prompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`MiniMax error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const textBlock = data.content?.find((c: { type: string }) => c.type === 'text')
    const text = textBlock?.text || ''
    return text
  } catch (err: unknown) {
    clearTimeout(timeout)
    throw err
  }
}

function parseJSONResponse(text: string): Record<string, unknown> {
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Try extracting JSON from markdown code blocks
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) } catch {}
  }
  // Try finding JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) } catch {}
  }
  throw new Error('Could not parse JSON from response: ' + text.slice(0, 200))
}

export async function generateAnalysis(report: Record<string, unknown>): Promise<{
  analysis_en: AnalysisResult
  analysis_zh: AnalysisResult
}> {
  // If no social data, use a template
  const hasData = report.x_bio || report.ig_bio || report.x_followers || report.ig_followers

  let enText = ''
  let zhText = ''

  if (hasData) {
    try {
      enText = await callMiniMax(buildPrompt(report, 'en'))
      zhText = await callMiniMax(buildPrompt(report, 'zh'))
    } catch (err) {
      console.error('MiniMax call failed:', err)
      // Fallback to placeholder
      enText = JSON.stringify({
        profile_summary: `${report.founder_name} — ${report.occupation || 'Founder'} at ${report.company || 'their company'}.`,
        public_perception: `A ${report.industry || 'industry'} professional based in ${report.location || 'Southeast Asia'}.`,
        content_pillars: ['Professional insights', 'Industry commentary', 'Personal brand'],
        seen_as: `A knowledgeable practitioner in the ${report.industry || 'design'} space.`,
        could_be_known_for: `A regional thought leader shaping the future of ${report.industry || 'their industry'}.`,
        gap_note: 'Limited social media presence means the full depth of expertise is not yet visible to potential clients or partners.',
        conversation_starters: [
          `What inspired you to start ${report.company || 'your company'}?`,
          `How do you see the ${report.industry || 'your industry'} evolving in the next 5 years?`,
          `What does your ideal client relationship look like?`,
        ],
        priority_moves: [
          'Commission an editorial feature to establish thought leadership positioning.',
          'Build a content strategy around a signature framework or methodology.',
          'Leverage existing industry judging/award credentials for conference pitches.',
        ],
        stage: 'Early Explorer — actively building profile but content strategy not yet systematized.',
        sources: [report.x_handle ? `X: ${report.x_handle}` : null, report.ig_handle ? `IG: ${report.ig_handle}` : null].filter(Boolean),
      })
      zhText = JSON.stringify({
        profile_summary: `${report.founder_name} — ${report.occupation || '创始人'}，就职于 ${report.company || '某公司'}。`,
        public_perception: `一位在 ${report.location || '东南亚地区'} 活跃的 ${report.industry || '行业'} 专业人士。`,
        content_pillars: ['专业洞察', '行业评论', '个人品牌'],
        seen_as: `${report.industry || '设计'}领域的资深从业者。`,
        could_be_known_for: `引领 ${report.industry || '行业'} 未来的区域思想领袖。`,
        gap_note: '社交媒体存在感有限，潜在客户和合作伙伴尚未充分看到其专业深度。',
        conversation_starters: [
          `是什么启发您创立 ${report.company || '您的公司'}？`,
          `您如何看待 ${report.industry || '您的行业'} 在未来5年的发展？`,
          '您理想的客户关系是什么样的？',
        ],
        priority_moves: [
          '委托编辑专题，建立思想领袖定位。',
          '围绕独特的框架或方法论建立内容策略。',
          '利用现有的行业评委/获奖资质进行大会演讲推介。',
        ],
        stage: '早期探索者——正在积极建立个人品牌，但内容策略尚未系统化。',
        sources: [report.x_handle ? `X: ${report.x_handle}` : null, report.ig_handle ? `IG: ${report.ig_handle}` : null].filter(Boolean),
      })
    }
  } else {
    // No social data — use fallback
    enText = JSON.stringify({
      profile_summary: `${report.founder_name} — ${report.occupation || 'Founder'} at ${report.company || 'their company'}.`,
      public_perception: `A ${report.industry || 'industry'} professional based in ${report.location || 'Southeast Asia'}.`,
      content_pillars: ['Professional insights', 'Industry commentary', 'Personal brand'],
      seen_as: `A knowledgeable practitioner in the ${report.industry || 'design'} space.`,
      could_be_known_for: `A regional thought leader shaping the future of ${report.industry || 'their industry'}.`,
      gap_note: 'Social media data not available — recommend manual research before meeting.',
      conversation_starters: [
        `What inspired you to start ${report.company || 'your company'}?`,
        `How do you see the ${report.industry || 'your industry'} evolving?`,
        `What does your ideal client relationship look like?`,
      ],
      priority_moves: [
        'Request social media handles for pre-meeting research.',
        'Conduct manual review of publicly available content.',
        'Identify unique positioning opportunity based on industry context.',
      ],
      stage: 'Unknown — insufficient data. Manual research required.',
      sources: [],
    })
    zhText = JSON.stringify({
      profile_summary: `${report.founder_name} — ${report.occupation || '创始人'}，就职于 ${report.company || '某公司'}。`,
      public_perception: `一位在 ${report.location || '东南亚地区'} 活跃的 ${report.industry || '行业'} 专业人士。`,
      content_pillars: ['专业洞察', '行业评论', '个人品牌'],
      seen_as: `${report.industry || '设计'}领域的资深从业者。`,
      could_be_known_for: `引领 ${report.industry || '行业'} 未来的区域思想领袖。`,
      gap_note: '暂无社交媒体数据——建议会面前进行手动调研。',
      conversation_starters: [
        `是什么启发您创立 ${report.company || '您的公司'}？`,
        `您如何看待 ${report.industry || '您的行业'} 的发展？`,
        '您理想的客户关系是什么样的？',
      ],
      priority_moves: [
        '获取社交媒体账号以便会前研究。',
        '进行手动公开内容审查。',
        '根据行业背景确定独特的定位机会。',
      ],
      stage: '未知——数据不足，需要手动调研。',
      sources: [],
    })
  }

  return {
    analysis_en: parseJSONResponse(enText) as unknown as AnalysisResult,
    analysis_zh: parseJSONResponse(zhText) as unknown as AnalysisResult,
  }
}
