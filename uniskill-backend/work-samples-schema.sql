-- ============================================================
-- UniSkill — Work Samples Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- ── work_samples table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_samples (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_skill_id   uuid        NOT NULL REFERENCES public.user_skills(id) ON DELETE CASCADE,
  file_url        text        NOT NULL,
  file_type       text        NOT NULL CHECK (file_type IN ('pdf', 'video', 'image')),
  file_name       text,
  file_size       bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_samples_user_skill_idx
  ON public.work_samples(user_skill_id);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.work_samples ENABLE ROW LEVEL SECURITY;

-- Anyone can read (samples are public profile data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_samples' AND policyname = 'work_samples_public_read'
  ) THEN
    CREATE POLICY "work_samples_public_read" ON public.work_samples
      FOR SELECT USING (true);
  END IF;
END $$;

-- Only the owning user can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_samples' AND policyname = 'work_samples_owner_insert'
  ) THEN
    CREATE POLICY "work_samples_owner_insert" ON public.work_samples
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_skills
          WHERE id = user_skill_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Only the owning user can delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_samples' AND policyname = 'work_samples_owner_delete'
  ) THEN
    CREATE POLICY "work_samples_owner_delete" ON public.work_samples
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.user_skills
          WHERE id = user_skill_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Supabase Storage bucket ────────────────────────────────
-- Creates the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-samples', 'work-samples', true)
ON CONFLICT (id) DO NOTHING;

-- ── Storage policies ───────────────────────────────────────
-- Users can upload to their own folder only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'work_samples_insert'
  ) THEN
    CREATE POLICY "work_samples_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'work-samples'
        AND auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  END IF;
END $$;

-- Anyone can read (public profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'work_samples_select'
  ) THEN
    CREATE POLICY "work_samples_select" ON storage.objects
      FOR SELECT USING (bucket_id = 'work-samples');
  END IF;
END $$;

-- Users can delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'work_samples_delete'
  ) THEN
    CREATE POLICY "work_samples_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'work-samples'
        AND auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  END IF;
END $$;
