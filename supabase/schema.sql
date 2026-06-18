-- Founder Intelligence Reports Database

CREATE TABLE IF NOT EXISTS founder_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_name TEXT NOT NULL,
  x_handle TEXT,
  ig_handle TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  
  -- Social data (extracted)
  x_followers INTEGER,
  x_bio TEXT,
  x_tweets_preview JSONB,
  ig_followers INTEGER,
  ig_bio TEXT,
  ig_posts_preview JSONB,
  
  -- AI Analysis (stored as JSONB for flexibility)
  analysis_en JSONB,
  analysis_zh JSONB,
  
  -- Report metadata
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  report_language TEXT DEFAULT 'bilingual' CHECK (report_language IN ('en', 'zh', 'bilingual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

-- Row Level Security
ALTER TABLE founder_reports ENABLE ROW LEVEL SECURITY;

-- Team members can do everything (no auth in v1 — internal tool)
-- Public read/write for now (v1 only)
CREATE POLICY "public_all" ON founder_reports FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER founder_reports_updated_at
  BEFORE UPDATE ON founder_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
