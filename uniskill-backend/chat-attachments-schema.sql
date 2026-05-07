-- ============================================================
-- UniSkill — Chat Attachments Schema Update
-- Run this in your Supabase SQL editor AFTER chat-schema.sql
-- ============================================================

-- Add attachment columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url  text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type text;   -- 'image' | 'file'
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_size bigint; -- bytes

-- ── Supabase Storage bucket for chat attachments ──────────────────────────
-- Run this manually in the Supabase dashboard under Storage > New Bucket:
--   Name: chat-attachments
--   Public: true
--
-- Or run via SQL (requires Supabase service role):
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — users can upload to their own folder
DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments');
