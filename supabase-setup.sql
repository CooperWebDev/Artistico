-- COMPLETE RESET: Supabase Database Setup for Artistico
-- This script DROPS everything first, then recreates from scratch

-- STEP 1: DROP EVERYTHING (ignore errors if objects don't exist)
-- Drop triggers (ignore errors)
DO $$
BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users';
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors
    NULL;
END $$;

-- Drop functions (ignore errors)
DO $$
BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS update_user_verification()';
    EXECUTE 'DROP FUNCTION IF EXISTS handle_new_user()';
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors
    NULL;
END $$;

-- Drop policies and tables (ignore all errors)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on user_profiles if table exists
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename IN ('user_profiles', 'wallpapers')
    LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.schemaname || '.' || policy_record.tablename;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors
            NULL;
        END;
    END LOOP;

    -- Drop storage policies
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors
            NULL;
        END;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    -- Ignore all errors
    NULL;
END $$;

-- Drop tables (ignore errors)
DROP TABLE IF EXISTS wallpapers CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- NOTE: Cannot directly delete storage bucket via SQL - Storage API required
-- We'll recreate it below (it will be skipped if it already exists)

-- STEP 2: RECREATE EVERYTHING FROM SCRATCH

-- Create storage bucket (skip if already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpapers', 'wallpapers', true)
ON CONFLICT (id) DO NOTHING;

-- Users table extension
CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NULL,
  username text NULL,
  password text NULL,
  avatar_url text NULL,
  bio text NULL,
  is_verified boolean NULL DEFAULT true,
  verified_at timestamp without time zone NULL DEFAULT now(),
  created_at timestamp without time zone NULL DEFAULT now(),
  updated_at timestamp without time zone NULL DEFAULT now(),
  constraint user_profiles_pkey primary key (id)
) TABLESPACE pg_default;

-- Disable RLS for user_profiles to allow trigger inserts and direct updates
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Allow all operations on user_profiles"
  ON public.user_profiles FOR ALL
  USING (true);

-- Wallpapers table
CREATE TABLE wallpapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'nature',
  likes_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
-- Enable RLS on tables
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;

-- Wallpapers policies
CREATE POLICY "Allow all operations on wallpapers"
  ON wallpapers FOR ALL
  USING (true);

-- Storage policies for wallpapers bucket
-- Note: Cannot disable RLS on storage.objects via SQL - manage via dashboard
CREATE POLICY "Allow all on storage objects"
  ON storage.objects FOR ALL
  USING (bucket_id = 'wallpapers');

-- User likes table
CREATE TABLE user_likes (
  user_id UUID NOT NULL,
  wallpaper_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, wallpaper_id)
);

-- Enable RLS
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all on user_likes"
  ON user_likes FOR ALL
  USING (true);