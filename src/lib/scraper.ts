/**
 * Social Media Scraper Library
 * Pure JavaScript — works on Vercel serverless
 * Uses public HTTP endpoints and HTML parsing
 */

interface XProfile {
  handle: string
  name: string
  bio: string
  followers: number | null
  following: number | null
  tweets: number | null
  verified: boolean
  location: string
  website: string
  joined: string
  avatar: string
  recent_tweets: Tweet[]
  error: string | null
}

interface Tweet {
  text: string
  date: string
  likes: number
  retweets: number
  replies: number
  url: string
}

interface IGProfile {
  handle: string
  name: string
  bio: string
  followers: number | null
  following: number | null
  posts: number | null
  verified: boolean
  is_private: boolean
  external_url: string
  avatar: string
  recent_posts: IGPost[]
  error: string | null
}

interface IGPost {
  url: string
  type: 'image' | 'video' | 'carousel'
  caption: string
  likes: number | null
  comments: number | null
  date: string
  hashtags: string[]
}

// ─── X / Twitter Scraper ─────────────────────────────────────────────────

function cleanHandle(handle: string): string {
  return handle
    .replace(/^(https?:\/\/)?(www\.)?(mobile\.)?(twitter\.com|x\.com)\/?/, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim()
}

async function fetchXProfile(handle: string): Promise<XProfile> {
  const clean = cleanHandle(handle)
  const profile: XProfile = {
    handle: clean,
    name: '',
    bio: '',
    followers: null,
    following: null,
    tweets: null,
    verified: false,
    location: '',
    website: '',
    joined: '',
    avatar: '',
    recent_tweets: [],
    error: null,
  }

  if (!clean) {
    profile.error = 'Empty handle'
    return profile
  }

  // Method 1: Try syndication API (no auth)
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile?screen_name=${encodeURIComponent(clean)}&limit=5`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bot/0.1)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.body) {
        const html = data.body
        // Parse follower count
        const followerMatch = html.match(/\"followers_count\"[:\s]*(\d+)/)
        if (followerMatch) profile.followers = parseInt(followerMatch[1])
        const followingMatch = html.match(/\"friends_count\"[:\s]*(\d+)/)
        if (followingMatch) profile.following = parseInt(followingMatch[1])
        const tweetsMatch = html.match(/\"statuses_count\"[:\s]*(\d+)/)
        if (tweetsMatch) profile.tweets = parseInt(tweetsMatch[1])
        // Parse name, bio from meta tags
        const nameMatch = html.match(/<title>([^<]+) \(/i) || html.match(/\"name\"[:\s]*\"([^\"]+)\"/)
        if (nameMatch) profile.name = nameMatch[1].replace(/\s*\(@\w+\)\s* on X.*$/i, '').trim()
        // Parse verified
        profile.verified = html.includes('"verified"') && html.includes('true')
        // Parse recent tweets
        const tweetsMatches = html.matchAll(/"text"[:\s]*"([^"]+)"/g)
        const datesMatches = html.matchAll(/"created_at"[:\s]*"([^"]+)"/g)
        const likesMatches = html.matchAll(/"favorite_count"[:\s]*(\d+)/g)
        const rtsMatches = html.matchAll(/"retweet_count"[:\s]*(\d+)/g)
        const urlsMatches = html.matchAll(/"url"[:\s]*"([^"]+)"/g)
        const tweets: Tweet[] = []
        let i = 0
        for (const m of tweetsMatches) {
          const text = decodeHTML(m[1])
          const dateArr: RegExpMatchArray[] = Array.from(datesMatches)
          const likesArr: RegExpMatchArray[] = Array.from(likesMatches)
          const rtsArr: RegExpMatchArray[] = Array.from(rtsMatches)
          const urlsArr: RegExpMatchArray[] = Array.from(urlsMatches)
          if (text && text.length > 10) {
            tweets.push({
              text,
              date: dateArr[i]?.[1] || '',
              likes: parseInt(likesArr[i]?.[1] || '0'),
              retweets: parseInt(rtsArr[i]?.[1] || '0'),
              replies: 0,
              url: `https://x.com/${clean}/status/${i + 1}`,
            })
          }
          if (tweets.length >= 5) break
          i++
        }
        profile.recent_tweets = tweets
        if (profile.followers !== null) return profile
      }
    }
  } catch (e) {
    profile.error = `Syndication API failed: ${e instanceof Error ? e.message : 'Unknown'}`
  }

  // Method 2: Fetch x.com page and parse HTML
  try {
    const res = await fetch(`https://x.com/${clean}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    // Parse OG tags
    const ogTitle = html.match(/<meta property="og:title"[^>]*content="([^"]+)"/)?.[1] || ''
    const ogDesc = html.match(/<meta property="og:description"[^>]*content="([^"]+)"/)?.[1] || ''
    const ogImg = html.match(/<meta property="og:image"[^>]*content="([^"]+)"/)?.[1] || ''
    profile.name = ogTitle.replace(/^@\w+\s*\|\s*/, '').replace(/\s*on X$/i, '').trim() || clean
    profile.bio = ogDesc || profile.bio
    profile.avatar = ogImg || ''
    // Parse follower count from script tags
    const followersMatch = html.match(/"followers_count"\s*:\s*(\d+)/)
    const followingMatch = html.match(/"friends_count"\s*:\s*(\d+)/)
    const statusesMatch = html.match(/"statuses_count"\s*:\s*(\d+)/)
    if (followersMatch) profile.followers = parseInt(followersMatch[1])
    if (followingMatch) profile.following = parseInt(followingMatch[1])
    if (statusesMatch) profile.tweets = parseInt(statusesMatch[1])
    profile.verified = html.includes('"is_blue_verified":true') || html.includes('"verified":true')
    // Parse location
    const locationMatch = html.match(/"location"\s*:\s*"([^"]+)"/)
    if (locationMatch) profile.location = locationMatch[1]
    // Parse website
    const websiteMatch = html.match(/"url"\s*:\s*"([^"]+)"/)
    if (websiteMatch) profile.website = websiteMatch[1]
    if (profile.followers !== null) return profile
  } catch (e) {
    profile.error = `x.com scrape failed: ${e instanceof Error ? e.message : 'Unknown'}`
  }

  // Method 3: nitter.net (open source Twitter frontend) as fallback
  try {
    const res = await fetch(`https://nitter.net/${clean}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const html = await res.text()
      const subsMatch = html.match(/<a[^>]*href="[^"]*sub[^"]*"[^>]*>\s*([\d,\.]+)/i)
      const followingMatch = html.match(/<a[^>]*href="[^"]*sub[^"]*"[^>]*>\s*([\d,\.]+)/i)
      // Just return what we can parse
      if (!profile.name) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
        if (titleMatch) profile.name = titleMatch[1].replace(` (@${clean})`, '').replace(' - Nitter', '').trim()
      }
    }
  } catch {
    // Nitter failed, continue
  }

  return profile
}

// ─── Instagram Scraper ────────────────────────────────────────────────────

async function fetchIGProfile(handle: string): Promise<IGProfile> {
  const clean = handle
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\/?/, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim()

  const profile: IGProfile = {
    handle: clean,
    name: '',
    bio: '',
    followers: null,
    following: null,
    posts: null,
    verified: false,
    is_private: false,
    external_url: '',
    avatar: '',
    recent_posts: [],
    error: null,
  }

  if (!clean) {
    profile.error = 'Empty handle'
    return profile
  }

  // Method 1: Instagram's public oembed endpoint (no auth needed)
  try {
    const oembedRes = await fetch(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=https://www.instagram.com/${encodeURIComponent(clean)}/&maxwidth=480&omitscript=true`,
      { signal: AbortSignal.timeout(5000) }
    )
    // This often requires token, but try anyway
    if (oembedRes.ok) {
      const data = await oembedRes.json()
      if (data.author_name) profile.name = data.author_name
      if (data.thumbnail_url) profile.avatar = data.thumbnail_url
    }
  } catch {
    // oembed failed, continue
  }

  // Method 2: Fetch public Instagram page and parse JSON-LD / HTML
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cookie': 'sessionid=; ds_user_id=;',
      },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Extract JSON data from script tags
    // Instagram embeds profile data in __arc_f沫a (or similar) script tags
    const scriptMatches = Array.from(html.matchAll(/<script[^>]*type="application\/json"[^>]*>([^<]+)<\/script>/gi))
    for (const m of scriptMatches) {
      try {
        const json = JSON.parse(m[1])
        if (json.props?.shortcode_media?.owner) {
          const o = json.props.shortcode_media.owner
          profile.name = o.full_name || clean
          profile.followers = o.followers_count ?? null
          profile.following = o.following_count ?? null
          profile.posts = o.media_count ?? null
          profile.verified = o.is_verified ?? false
          profile.is_private = o.is_private ?? false
          profile.avatar = o.profile_pic_url ?? ''
          return profile
        }
        if (json.props?.userData?.user) {
          const u = json.props.userData.user
          profile.name = u.full_name || clean
          profile.followers = u.followers?.count ?? null
          profile.following = u.follows?.count ?? null
          profile.posts = u.media?.count ?? null
          profile.verified = u.is_verified ?? false
          profile.is_private = u.is_private ?? false
          return profile
        }
      } catch {
        // Not the right script tag
      }
    }

    // Method 3: Try sharedData from Instagram's own format
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*(\{[^]*?\});\s*<\/script>/)
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1])
        const user = sharedData.entry_data?.ProfilePage?.[0]?.graphql?.user
        if (user) {
          profile.name = user.full_name || clean
          profile.bio = user.biography || ''
          profile.followers = user.edge_followers?.count ?? user.followers?.count ?? null
          profile.following = user.edge_follow?.count ?? user.following?.count ?? null
          profile.posts = user.edge_owner_to_timeline_media?.count ?? user.media?.count ?? null
          profile.verified = user.is_verified ?? false
          profile.is_private = user.is_private ?? false
          profile.avatar = user.profile_pic_url ?? ''
          profile.external_url = user.external_url?.replace(/\/$/, '') || ''
          // Get recent posts
          const posts = user.edge_owner_to_timeline_media?.edges ?? user.media?.nodes ?? []
          for (const edge of posts.slice(0, 6)) {
            const node = edge.node ?? edge
            const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? node.caption ?? ''
            const hashtags = caption.match(/#[^\s#]+/g) ?? []
            profile.recent_posts.push({
              url: `https://www.instagram.com/p/${node.shortcode}/`,
              type: node.__typename === 'GraphVideo' ? 'video' : node.__typename === 'GraphSidecar' ? 'carousel' : 'image',
              caption: caption.slice(0, 200),
              likes: node.edge_liked_by?.count ?? node.likes ?? null,
              comments: node.edge_media_to_comment?.count ?? node.comments ?? null,
              date: new Date(node.taken_at_timestamp * 1000).toISOString().split('T')[0],
              hashtags,
            })
          }
          return profile
        }
      } catch (e) {
        profile.error = `sharedData parse failed: ${e instanceof Error ? e.message : 'Unknown'}`
      }
    }

    // Method 4: Parse meta tags (fallback for name/description only)
    const ogTitle = html.match(/<meta property="og:title"[^>]*content="([^"]+)"/)?.[1] || ''
    const ogDesc = html.match(/<meta property="og:description"[^>]*content="([^"]+)"/)?.[1] || ''
    const ogImg = html.match(/<meta property="og:image"[^>]*content="([^"]+)"/)?.[1] || ''
    profile.name = ogTitle.replace(/^@\w+\s*on Instagram:\s*/, '').trim() || clean
    profile.bio = ogDesc || ''
    profile.avatar = ogImg || ''

    // Method 5: Try public API alternative (instagram-stats, publicbook)
    await tryInstagramStatsAPI(clean, profile)
  } catch (e) {
    profile.error = `instagram.com scrape failed: ${e instanceof Error ? e.message : 'Unknown'}`
  }

  return profile
}

async function tryInstagramStatsAPI(handle: string, profile: IGProfile): Promise<void> {
  // Try various free/public Instagram data APIs
  const endpoints = [
    `https://api.promodoroapi.com/instagram/profile?username=${handle}`,
    `https://insta-stats-api.com/@${handle}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.followers) profile.followers = parseInt(data.followers)
        if (data.following) profile.following = parseInt(data.following)
        if (data.media_count) profile.posts = parseInt(data.media_count)
        if (data.is_verified !== undefined) profile.verified = data.is_verified
        if (data.is_private !== undefined) profile.is_private = data.is_private
        if (profile.followers !== null) return
      }
    } catch {
      // Continue to next endpoint
    }
  }
}

// ─── Web Search ────────────────────────────────────────────────────────────

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

async function webSearch(query: string, limit = 10): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = []

  // Method 1: DuckDuckGo HTML (no API key needed)
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (res.ok) {
      const html = await res.text()
    // const resultMatches = html.matchAll(...) - convert to Array
    const resultMatches = Array.from(html.matchAll(
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    ))
    for (const m of resultMatches) {
        const url = m[1]
        const titleRaw = m[2].replace(/<[^>]+>/g, '').trim()
        const snippetRaw = m[3].replace(/<[^>]+>/g, '').trim()
        const title = decodeHTML(titleRaw)
        const snippet = decodeHTML(snippetRaw).replace(/\s*\.\.\./, '').trim()
        const urlObj = new URL(url.startsWith('http') ? url : `https://duckduckgo.com${url}`)
        if (!url.includes('duckduckgo') && !url.includes('yandex') && title && snippet) {
          results.push({
            title,
            url,
            snippet,
            source: urlObj.hostname.replace('www.', ''),
          })
        }
        if (results.length >= limit) break
      }
      if (results.length > 0) return results
    }
  } catch {
    // continue
  }

  // Method 2: Bing HTML
  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (res.ok) {
      const html = await res.text()
      const titles = html.matchAll(/<h2[^>]*>[\s]*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)
      const snippets = html.matchAll(/<p[^>]*class="b_paractl[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
      const titlesArr = Array.from(titles)
      const snippetsArr = Array.from(snippets)
      for (let i = 0; i < Math.min(titlesArr.length, limit); i++) {
        const url = titlesArr[i][1]
        const title = decodeHTML(titlesArr[i][2].replace(/<[^>]+>/g, '').trim())
        const snippet = decodeHTML(
          (snippetsArr[i]?.[1] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&hellip;/g, '...').replace(/&quot;/g, '"').trim()
        )
        if (url.startsWith('http') && title) {
          const urlObj = new URL(url)
          results.push({
            title,
            url,
            snippet: snippet.slice(0, 300),
            source: urlObj.hostname.replace('www.', ''),
          })
        }
      }
      if (results.length > 0) return results
    }
  } catch {
    // continue
  }

  // Method 3: Google search via serpapi-free endpoint
  try {
    const res = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&no_cache=true`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.organic_results) {
        for (const r of data.organic_results.slice(0, limit)) {
          results.push({
            title: r.title || '',
            url: r.link || '',
            snippet: r.snippet || '',
            source: new URL(r.link || 'http://x.com').hostname.replace('www.', ''),
          })
        }
        if (results.length > 0) return results
      }
    }
  } catch {
    // continue
  }

  return results
}

// ─── Full Research Pipeline ──────────────────────────────────────────────

interface ResearchData {
  founder_name: string
  company: string
  occupation: string
  industry: string
  location: string
  x_handle: string
  ig_handle: string
  linkedin_url: string
  website_url: string
  x_profile: XProfile
  ig_profile: IGProfile
  web_results: WebSearchResult[]
  scraped_at: string
}

async function researchFounder(
  report: Record<string, unknown>
): Promise<ResearchData> {
  const {
    founder_name = '',
    company = '',
    occupation = '',
    industry = '',
    location = '',
    x_handle = '',
    ig_handle = '',
    linkedin_url = '',
    website_url = '',
  } = report as Record<string, unknown>

  // Run all scrapers in parallel
  const [x_profile, ig_profile] = await Promise.all([
    x_handle ? fetchXProfile(String(x_handle)) : Promise.resolve(null),
    ig_handle ? fetchIGProfile(String(ig_handle)) : Promise.resolve(null),
  ])

  // Web search for founder name + company
  const searchQuery = [
    String(founder_name),
    company ? String(company) : '',
    occupation ? String(occupation) : '',
    location ? String(location) : '',
  ]
    .filter(Boolean)
    .join(' ')

  const web_results = searchQuery
    ? await webSearch(searchQuery, 10)
    : []

  return {
    founder_name: String(founder_name),
    company: String(company),
    occupation: String(occupation),
    industry: String(industry),
    location: String(location),
    x_handle: String(x_handle),
    ig_handle: String(ig_handle),
    linkedin_url: String(linkedin_url),
    website_url: String(website_url),
    x_profile: x_profile || {
      handle: '',
      name: '',
      bio: '',
      followers: null,
      following: null,
      tweets: null,
      verified: false,
      location: '',
      website: '',
      joined: '',
      avatar: '',
      recent_tweets: [],
      error: 'No X handle provided',
    },
    ig_profile: ig_profile || {
      handle: '',
      name: '',
      bio: '',
      followers: null,
      following: null,
      posts: null,
      verified: false,
      is_private: false,
      external_url: '',
      avatar: '',
      recent_posts: [],
      error: 'No IG handle provided',
    },
    web_results,
    scraped_at: new Date().toISOString(),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function decodeHTML(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export {
  fetchXProfile,
  fetchIGProfile,
  webSearch,
  researchFounder,
  type XProfile,
  type Tweet,
  type IGProfile,
  type IGPost,
  type WebSearchResult,
  type ResearchData,
}
