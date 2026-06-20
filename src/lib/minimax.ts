import { researchFounder, type ResearchData } from './scraper'

const MINIMAX_API_URL = 'https://api.minimax.io/anthropic/v1/messages'
const MINIMAX_MODEL = 'MiniMax-M2.7'

interface AnalysisSection {
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
  // New detailed fields
  bio_deep_dive: string
  audience_profile: { demographics: string; interests: string; pain_points: string }
  content_themes: { theme: string; frequency: string; engagement: string }[]
  competitive_positioning: string
  ip_opportunities: string[]
  personal_brand_score: { score: number; max: number; breakdown: string }
  social_reach_analysis: {
    x_metrics: { followers: number | null; engagement_rate: string; reach_assessment: string }
    ig_metrics: { followers: number | null; posts: number | null; engagement_rate: string; reach_assessment: string }
  }
  web_presence_summary: { mentions: number; sentiment: string; key_articles: string[] }
}

async function callMiniMax(prompt: string, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        max_tokens: maxTokens,
        temperature: 0.5,
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
    return textBlock?.text || ''
  } catch (err: unknown) {
    clearTimeout(timeout)
    throw err
  }
}

function parseJSONResponse(text: string): Record<string, unknown> {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) } catch {}
  }
  throw new Error('Could not parse JSON from response: ' + text.slice(0, 200))
}

function buildRichPrompt(data: ResearchData, lang: 'en' | 'zh'): string {
  const { founder_name, company, occupation, industry, location, x_handle, ig_handle, linkedin_url, website_url, x_profile, ig_profile, web_results } = data
  const isZh = lang === 'zh'
  const hasX = x_profile && !x_profile.error && x_profile.handle
  const hasIG = ig_profile && !ig_profile.error && ig_profile.handle

  // Recent tweets for context
  const recentTweetsText = hasX && x_profile.recent_tweets.length > 0
    ? x_profile.recent_tweets.map(t => `[${t.date}] ${t.text} | ❤️${t.likes} 🔁${t.retweets}`).join('\n')
    : '无推文数据'

  // Recent IG posts
  const recentPostsText = hasIG && ig_profile.recent_posts.length > 0
    ? ig_profile.recent_posts.map(p => `[${p.date}] ${p.type.toUpperCase()} | ❤️${p.likes ?? '?'} 💬${p.comments ?? '?'} | ${p.caption.slice(0, 150)}`).join('\n')
    : '无帖子数据'

  // Web search results
  const webText = web_results.length > 0
    ? web_results.slice(0, 8).map((r, i) => `[${i + 1}] ${r.title}\n   ${r.snippet}\n   来源: ${r.source}`).join('\n\n')
    : '无搜索结果'

  // X metrics
  const xMetrics = hasX
    ? `  - 账号: @${x_profile.handle}\n  - 名称: ${x_profile.name || '未知'}\n  - Bio: ${x_profile.bio || '无'}\n  - 粉丝: ${x_profile.followers ? x_profile.followers.toLocaleString() : '无法获取'}\n  - 关注: ${x_profile.following ? x_profile.following.toLocaleString() : '无法获取'}\n  -推文数: ${x_profile.tweets ? x_profile.tweets.toLocaleString() : '无法获取'}\n  - 认证: ${x_profile.verified ? '✅ 已认证' : '❌ 未认证'}\n  - 地点: ${x_profile.location || '未公开'}\n  - 网站: ${x_profile.website || '无'}\n  - 最近推文:\n${recentTweetsText}`
    : `  - 账号: ${x_handle || '未提供'}\n  - 状态: 未抓取到数据`

  // IG metrics
  const igMetrics = hasIG
    ? `  - 账号: @${ig_profile.handle}\n  - 名称: ${ig_profile.name || '未知'}\n  - Bio: ${ig_profile.bio || '无'}\n  - 粉丝: ${ig_profile.followers ? ig_profile.followers.toLocaleString() : '无法获取'}\n  - 关注: ${ig_profile.following ? ig_profile.following.toLocaleString() : '无法获取'}\n  - 帖子数: ${ig_profile.posts ? ig_profile.posts.toLocaleString() : '无法获取'}\n  - 认证: ${ig_profile.verified ? '✅ 已认证' : '❌ 未认证'}\n  - 私密: ${ig_profile.is_private ? '🔒 私密账号' : '🌐 公开账号'}\n  - 外部链接: ${ig_profile.external_url || '无'}\n  - 最近帖子:\n${recentPostsText}`
    : `  - 账号: ${ig_handle || '未提供'}\n  - 状态: 未抓取到数据`

  const langLabel = isZh ? '华文' : 'English'
  const nothing = isZh ? '无' : 'None'
  const unknown = isZh ? '未知' : 'Unknown'

  if (isZh) {
    return `你是资深创始人情报分析专家。请基于以下多维度数据，生成一份**深度个性化**的创始人情报报告。

【创始人基础信息】
姓名: ${founder_name}
公司: ${company || '未知'}
职业: ${occupation || '未知'}
行业: ${industry || '未知'}
地点: ${location || '未知'}
LinkedIn: ${linkedin_url || '无'}
网站: ${website_url || '无'}

【X/Twitter 详细数据】
${xMetrics}

【Instagram 详细数据】
${igMetrics}

【网络搜索结果】
${webText}

请生成以下JSON格式的分析报告（全部用中文）：

{
  "profile_summary": "120字以内的个人核心叙事，融合职业背景、个人品牌印象、社交媒体气质",
  "public_perception": "一句话精准描述公众/行业对他的认知",
  "bio_deep_dive": "深度解读他的Bio——从措辞风格判断他的个人品牌定位、价值观、目标受众",
  "audience_profile": {
    "demographics": "粉丝人口统计：年龄层、职业、地区分布推测",
    "interests": "粉丝兴趣标签（3-5个关键词）",
    "pain_points": "他的内容主要解决的粉丝痛点"
  },
  "content_pillars": ["他从哪三个角度创作内容（附例子）"],
  "content_themes": [
    {"theme": "主题名称", "frequency": "出现频率", "engagement": "互动表现"}
  ],
  "seen_as": "他现在在公众眼中的定位（一句话）",
  "could_be_known_for": "他能被更高认知的定位（一句话，野心但可实现）",
  "gap_note": "差距说明——他的现状和理想定位之间的GAP（2-3句，要具体指出哪个平台、什么内容不到位）",
  "competitive_positioning": "他在同类创始人中的竞争定位分析——他跟同赛道其他人有什么差异化的点",
  "ip_opportunities": ["他还没做但应该做的3个IP机会"],
  "personal_brand_score": {
    "score": 数字1-10,
    "max": 10,
    "breakdown": "评分理由，从认知度、一致性、差异化、活跃度四个维度评分"
  },
  "social_reach_analysis": {
    "x_metrics": {"followers": 数字或null, "engagement_rate": "高/中/低及原因", "reach_assessment": "他的X影响力评估"},
    "ig_metrics": {"followers": 数字或null, "posts": 数字或null, "engagement_rate": "高/中/低及原因", "reach_assessment": "他的IG影响力评估"}
  },
  "web_presence_summary": {"mentions": 搜索到的结果数量, "sentiment": "正面/中性/混合", "key_articles": ["最重要的3篇文章标题"]},
  "conversation_starters": ["给他起新外号（1句）", "第一句话开场白（1句）", "深入追问话题（1句）"],
  "priority_moves": ["第一优先：具体行动（平台+内容形式+频率）", "第二优先：同上", "第三优先：同上"],
  "stage": "IP发展阶段：早期探索者/有产品待规模化/已是行业IP/跨界转型中，并说明理由",
  "sources": ["来源链接1", "来源链接2"]
}

只输出JSON，不要任何其他文字。JSON必须可以被JSON.parse()解析。`
  }

  // English prompt
  return `You are a senior founder intelligence analyst. Generate a deeply personalized intelligence report based on comprehensive multi-source data.

[FOUNDER BASICS]
Name: ${founder_name}
Company: ${company || 'Unknown'}
Occupation: ${occupation || 'Unknown'}
Industry: ${industry || 'Unknown'}
Location: ${location || 'Unknown'}
LinkedIn: ${linkedin_url || 'None'}
Website: ${website_url || 'None'}

[X/TWITTER DETAILED DATA]
${xMetrics}

[INSTAGRAM DETAILED DATA]
${igMetrics}

[WEB SEARCH RESULTS]
${webText}

Generate this JSON report in English:

{
  "profile_summary": "120-char max personal narrative: blend of career background, personal brand impression, social media persona",
  "public_perception": "One precise sentence on how the public/industry perceives them",
  "bio_deep_dive": "Deep dive into their bio — what their word choices, tone, and positioning reveal about their brand, values, and target audience",
  "audience_profile": {
    "demographics": "Follower demographics: age range, professions, geographic distribution (inferred)",
    "interests": "Follower interest tags (3-5 keywords)",
    "pain_points": "The main follower pain points their content addresses"
  },
  "content_pillars": ["The 3 content angles they create from (with examples)"],
  "content_themes": [
    {"theme": "Theme name", "frequency": "How often it appears", "engagement": "How it performs"}
  ],
  "seen_as": "Current public positioning (one sentence)",
  "could_be_known_for": "Higher positioning they could credibly claim (one sentence — ambitious but achievable)",
  "gap_note": "Gap analysis — specific platform and content gaps between where they are and where they should be (2-3 sentences, be concrete)",
  "competitive_positioning": "Competitive analysis vs. similar founders in their space — what makes them differentiated",
  "ip_opportunities": ["3 IP opportunities they haven't pursued but should"],
  "personal_brand_score": {
    "score": number 1-10,
    "max": 10,
    "breakdown": "Reasoned score from 4 dimensions: awareness, consistency, differentiation, activity level"
  },
  "social_reach_analysis": {
    "x_metrics": {"followers": number or null, "engagement_rate": "High/Medium/Low + why", "reach_assessment": "Assessment of their X influence"},
    "ig_metrics": {"followers": number or null, "posts": number or null, "engagement_rate": "High/Medium/Low + why", "reach_assessment": "Assessment of their IG influence"}
  },
  "web_presence_summary": {"mentions": number of search results found, "sentiment": "Positive/Mixed/Neutral", "key_articles": ["Title of 3 most important articles found"]},
  "conversation_starters": ["Give them a new nickname (1 sentence)", "Opening icebreaker (1 sentence)", "Deep-dive question to ask (1 sentence)"],
  "priority_moves": ["Priority 1: specific action (platform + content format + frequency)", "Priority 2: same structure", "Priority 3: same structure"],
  "stage": "IP Stage: Early Explorer / Product-Ready-to-Scale / Industry IP / Cross-Sector Pivot + reasoning",
  "sources": ["Source URL 1", "Source URL 2"]
}

Output JSON only. No other text. Must be parseable by JSON.parse().`
}

export async function generateAnalysis(report: Record<string, unknown>): Promise<{
  analysis_en: string
  analysis_zh: string
}> {
  // Step 1: Run full research pipeline (scrapes X, IG, web search — all in parallel)
  const researchData = await researchFounder(report)

  // Step 2: Check if we got meaningful data
  const hasRealData =
    (researchData.x_profile && !researchData.x_profile.error && researchData.x_profile.followers !== null) ||
    (researchData.ig_profile && !researchData.ig_profile.error && researchData.ig_profile.followers !== null) ||
    researchData.web_results.length > 0

  let enText = ''
  let zhText = ''

  if (hasRealData) {
    try {
      // Run both languages in parallel
      ;[enText, zhText] = await Promise.all([
        callMiniMax(buildRichPrompt(researchData, 'en'), 4000),
        callMiniMax(buildRichPrompt(researchData, 'zh'), 4000),
      ])
    } catch (err) {
      console.error('MiniMax call failed:', err)
      throw new Error(`MiniMax API failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  } else {
    // Very little data — still call MiniMax but warn it
    try {
      const promptWithWarning = buildRichPrompt(researchData, 'en').replace(
        '"sources": ["Source URL 1", "Source URL 2"]',
        '"sources": ["⚠️ Insufficient data — manual research required"]'
      )
      enText = await callMiniMax(promptWithWarning, 4000)
      const zhPrompt = buildRichPrompt(researchData, 'zh').replace(
        '"sources": ["来源链接1", "来源链接2"]',
        '"sources": ["⚠️ 数据不足——建议手动调研"]'
      )
      zhText = await callMiniMax(zhPrompt, 4000)
    } catch (err) {
      console.error('MiniMax call failed:', err)
      throw new Error(`MiniMax API failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return {
    analysis_en: JSON.stringify(parseJSONResponse(enText)),
    analysis_zh: JSON.stringify(parseJSONResponse(zhText)),
  }
}
