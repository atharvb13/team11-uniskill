-- ============================================================
-- UniSkill — E2E Encryption: User Public Keys Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- ── user_public_keys table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_public_keys (
  user_id    uuid        PRIMARY KEY
                         REFERENCES public.users(id) ON DELETE CASCADE,
  public_key text        NOT NULL,           -- base64-encoded SPKI (ECDH P-256)
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Auto-update timestamp ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_public_keys_updated_at ON public.user_public_keys;
CREATE TRIGGER trg_user_public_keys_updated_at
  BEFORE UPDATE ON public.user_public_keys
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read any public key
-- (public keys are not secret — that is the point of asymmetric crypto)
DROP POLICY IF EXISTS "keys_select" ON public.user_public_keys;
CREATE POLICY "keys_select" ON public.user_public_keys
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only the owner can insert or update their own key
DROP POLICY IF EXISTS "keys_upsert" ON public.user_public_keys;
CREATE POLICY "keys_upsert" ON public.user_public_keys
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTE: The backend uses the service-role client (supabase_admin_client),
-- which bypasses RLS.  The policies above apply to direct
-- Supabase client calls from the browser if you ever add them.
-- ============================================================
