-- Supabase Database Setup for Anime Walls
-- ⚠️  WARNING: This script COMPLETELY CLEARS and recreates the database!
-- It will delete all existing data, tables, policies, and functions.
-- Only run this if you want to start fresh!

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS wallpapers CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop existing storage bucket
DROP BUCKET IF EXISTS wallpapers;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;

-- Drop existing functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_user_verification() CASCADE;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpapers', 'wallpapers', true)
ON CONFLICT (id) DO NOTHING;

-- Users table extension
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallpapers table
CREATE TABLE wallpapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'fanart',
  likes_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Drop ALL existing policies first
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Enable RLS on tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;

-- Wallpapers policies
CREATE POLICY "Anyone can view public wallpapers"
  ON wallpapers FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own wallpapers"
  ON wallpapers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert wallpapers"
  ON wallpapers FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own wallpapers"
  ON wallpapers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallpapers"
  ON wallpapers FOR DELETE
  USING (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Storage policies for wallpapers bucket
CREATE POLICY "Anyone can view wallpaper images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallpapers');

CREATE POLICY "Authenticated users can upload wallpapers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wallpapers' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own wallpaper images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own wallpaper images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Functions and triggers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, is_verified)
  VALUES (NEW.id, NEW.email, TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update user_profiles when email is verified (kept for compatibility)
CREATE OR REPLACE FUNCTION update_user_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE user_profiles
    SET is_verified = TRUE, verified_at = NEW.email_confirmed_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION update_user_verification();