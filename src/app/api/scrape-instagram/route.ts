import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60s timeout for instagrapi

interface InstagramResult {
  handle: string
  full_name: string
  bio: string
  followers: number
  following: number
  media_count: number
  is_private: boolean
  is_verified: boolean
  external_url: string
  success: boolean
  error: string | null
}

function runPython(scriptPath: string, handle: string): Promise<InstagramResult> {
  return new Promise((resolve) => {
    const result: InstagramResult = {
      handle,
      full_name: '',
      bio: '',
      followers: 0,
      following: 0,
      media_count: 0,
      is_private: false,
      is_verified: false,
      external_url: '',
      success: false,
      error: null,
    }

    const proc = spawn('python3', [scriptPath, handle], {
      timeout: 30000,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      result.error = `Process error: ${err.message}`
      resolve(result)
    })

    proc.on('close', (code) => {
      if (code !== 0 || stderr) {
        result.error = stderr || `Process exited with code ${code}`
        resolve(result)
        return
      }

      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed as InstagramResult)
      } catch {
        result.error = `Failed to parse output: ${stdout.slice(0, 200)}`
        resolve(result)
      }
    })

    // Timeout safety
    setTimeout(() => {
      proc.kill()
      result.error = 'Script timed out after 30s'
      resolve(result)
    }, 30000)
  })
}

export async function POST(req: NextRequest) {
  try {
    const { instagramHandle } = await req.json()

    if (!instagramHandle) {
      return NextResponse.json({ error: 'Missing instagramHandle' }, { status: 400 })
    }

    // Clean the handle
    const handle = instagramHandle
      .replace(/^(https?:\/\/)?(www\.)?instagram\.com\/?/, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '')
      .trim()

    if (!handle) {
      return NextResponse.json({ error: 'Invalid Instagram handle' }, { status: 400 })
    }

    // Path to Python script
    const scriptPath = join(process.cwd(), 'scripts', 'scrape_instagram.py')

    const result = await runPython(scriptPath, handle)

    if (!result.success) {
      console.error('Instagram scrape error:', result.error)
      // Return the error but with partial data - don't fail the whole request
      return NextResponse.json({
        success: false,
        error: result.error,
        handle,
        // MiniMax can still use the handle for gap analysis
        partial: true,
      })
    }

    return NextResponse.json({
      success: true,
      handle: result.handle,
      full_name: result.full_name,
      bio: result.bio,
      followers: result.followers,
      following: result.following,
      media_count: result.media_count,
      is_private: result.is_private,
      is_verified: result.is_verified,
      external_url: result.external_url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Scrape Instagram error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
