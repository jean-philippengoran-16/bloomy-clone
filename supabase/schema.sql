-- ─────────────────────────────────────────────────────────────────────────────
-- Bloomy Clone — Supabase Schema
-- Coller et exécuter intégralement dans Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.couples (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couples_different_users CHECK (user_a <> user_b)
);

CREATE TABLE IF NOT EXISTS public.couple_invites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        UNIQUE NOT NULL,
  creator_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id       uuid        REFERENCES public.couples(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pending',
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  claimed_at      timestamptz,
  CONSTRAINT valid_status      CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  CONSTRAINT valid_code_format CHECK (code ~ '^[A-Z]{2}-[0-9]{4}$')
);

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS couple_invites_code_idx    ON public.couple_invites (code);
CREATE INDEX IF NOT EXISTS couple_invites_creator_idx ON public.couple_invites (creator_user_id);

-- Perf : colonnes utilisées dans les policies RLS
CREATE INDEX IF NOT EXISTS couples_user_a_idx ON public.couples (user_a);
CREATE INDEX IF NOT EXISTS couples_user_b_idx ON public.couples (user_b);

-- Garantie métier : 1 invitation pending max par créateur (index partiel)
CREATE UNIQUE INDEX IF NOT EXISTS couple_invites_one_pending_per_creator_idx
  ON public.couple_invites (creator_user_id)
  WHERE status = 'pending';

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.couples        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couples_select_own"  ON public.couples;
DROP POLICY IF EXISTS "invites_select_own"  ON public.couple_invites;

-- Un membre peut lire uniquement son propre couple
-- (select auth.uid()) évite une ré-évaluation par ligne
CREATE POLICY "couples_select_own"
  ON public.couples
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_a
    OR (SELECT auth.uid()) = user_b
  );

-- Le créateur peut lire uniquement ses propres invitations
CREATE POLICY "invites_select_own"
  ON public.couple_invites
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = creator_user_id);

-- Pas de policy INSERT/UPDATE/DELETE directe — tout passe par les fonctions SECURITY DEFINER.

-- ── Function: create_couple_invite ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_couple_invite()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    uuid;
  v_code       text;
  v_invite_id  uuid;
  v_expires_at timestamptz;
  v_attempts   int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Empêcher un utilisateur déjà en couple de générer un code
  IF EXISTS (
    SELECT 1 FROM public.couples
    WHERE user_a = v_user_id OR user_b = v_user_id
  ) THEN
    RAISE EXCEPTION 'user_already_in_couple';
  END IF;

  -- Annuler les invitations pending précédentes du même utilisateur
  -- (le partial unique index garantit qu'il n'y en a qu'une, mais on sécurise aussi via UPDATE)
  UPDATE public.couple_invites
  SET    status = 'cancelled'
  WHERE  creator_user_id = v_user_id
    AND  status = 'pending';

  -- Générer un code unique au format AA-1234
  LOOP
    v_code :=
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int) ||
      '-' ||
      lpad(floor(1000 + random() * 9000)::text, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.couple_invites WHERE code = v_code
    );

    v_attempts := v_attempts + 1;
    IF v_attempts >= 10 THEN
      RAISE EXCEPTION 'code_generation_failed';
    END IF;
  END LOOP;

  v_expires_at := now() + interval '15 minutes';

  INSERT INTO public.couple_invites (code, creator_user_id, status, expires_at)
  VALUES (v_code, v_user_id, 'pending', v_expires_at)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'code',       v_code,
    'invite_id',  v_invite_id,
    'expires_at', v_expires_at
  );
END;
$$;

-- Verrouillage : on retire d'abord toute permission par défaut, puis on ré-accorde au rôle voulu
REVOKE EXECUTE ON FUNCTION public.create_couple_invite()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_couple_invite()        FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_couple_invite()        TO   authenticated;

-- ── Function: claim_couple_invite ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_couple_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    uuid;
  v_invite     public.couple_invites%ROWTYPE;
  v_couple_id  uuid;
  v_claimed_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verrouillage de ligne pour éviter les claims concurrents
  SELECT * INTO v_invite
  FROM   public.couple_invites
  WHERE  code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;

  IF v_invite.status = 'claimed' THEN
    RAISE EXCEPTION 'code_already_claimed';
  END IF;

  IF v_invite.status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'code_invalid';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.couple_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'code_expired';
  END IF;

  IF v_invite.creator_user_id = v_user_id THEN
    RAISE EXCEPTION 'cannot_claim_own_code';
  END IF;

  -- Empêcher qu'un utilisateur déjà en couple en rejoigne un second
  IF EXISTS (
    SELECT 1 FROM public.couples
    WHERE user_a = v_user_id OR user_b = v_user_id
  ) THEN
    RAISE EXCEPTION 'user_already_in_couple';
  END IF;

  -- Empêcher que le créateur soit déjà dans un autre couple
  IF EXISTS (
    SELECT 1 FROM public.couples
    WHERE user_a = v_invite.creator_user_id OR user_b = v_invite.creator_user_id
  ) THEN
    RAISE EXCEPTION 'creator_already_in_couple';
  END IF;

  v_claimed_at := now();

  INSERT INTO public.couples (user_a, user_b)
  VALUES (v_invite.creator_user_id, v_user_id)
  RETURNING id INTO v_couple_id;

  UPDATE public.couple_invites
  SET  status     = 'claimed',
       claimed_at = v_claimed_at,
       couple_id  = v_couple_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'couple_id',       v_couple_id,
    'creator_user_id', v_invite.creator_user_id,
    'claimed_at',      v_claimed_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_couple_invite(text)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_couple_invite(text)     FROM anon;
GRANT  EXECUTE ON FUNCTION public.claim_couple_invite(text)     TO   authenticated;

-- ── Shared game sessions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id  uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  deck_id    text        NOT NULL,
  card_ids   text[]      NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_sessions_valid_deck CHECK (
    deck_id IN (
      'who_is_v1',
      'would_you_rather_v1',
      'connection_v1',
      'chemistry_v1',
      'dare_v1'
    )
  ),
  CONSTRAINT game_sessions_card_count CHECK (cardinality(card_ids) = 10)
);

CREATE TABLE IF NOT EXISTS public.game_session_answers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  card_id    text        NOT NULL,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer     text        NOT NULL,
  custom_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_session_answers_valid_answer CHECK (
    answer IN (
      'me',
      'you',
      'both',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'other',
      'completed',
      'skipped'
    )
  )
);

ALTER TABLE public.game_session_answers
  ADD COLUMN IF NOT EXISTS custom_text text;

ALTER TABLE public.game_session_answers
  DROP CONSTRAINT IF EXISTS game_session_answers_valid_answer;

ALTER TABLE public.game_session_answers
  ADD CONSTRAINT game_session_answers_valid_answer CHECK (
    answer IN (
      'me',
      'you',
      'both',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'other',
      'completed',
      'skipped'
    )
  );

CREATE TABLE IF NOT EXISTS public.game_session_progress (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_index integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_session_progress_valid_index CHECK (current_index BETWEEN 0 AND 9)
);

CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_couple_deck_idx
  ON public.game_sessions (couple_id, deck_id);
CREATE INDEX IF NOT EXISTS game_sessions_couple_idx
  ON public.game_sessions (couple_id);

CREATE UNIQUE INDEX IF NOT EXISTS game_session_answers_unique_idx
  ON public.game_session_answers (session_id, card_id, user_id);
CREATE INDEX IF NOT EXISTS game_session_answers_lookup_idx
  ON public.game_session_answers (session_id, card_id);

CREATE UNIQUE INDEX IF NOT EXISTS game_session_progress_unique_idx
  ON public.game_session_progress (session_id, user_id);

ALTER TABLE public.game_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_sessions_select_own_couple"         ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_insert_own_couple"         ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_update_own_couple"         ON public.game_sessions;
DROP POLICY IF EXISTS "game_session_answers_select_own_couple"  ON public.game_session_answers;
DROP POLICY IF EXISTS "game_session_answers_insert_own_user"    ON public.game_session_answers;
DROP POLICY IF EXISTS "game_session_answers_update_own_user"    ON public.game_session_answers;
DROP POLICY IF EXISTS "game_session_progress_select_own_couple" ON public.game_session_progress;
DROP POLICY IF EXISTS "game_session_progress_insert_own_user"   ON public.game_session_progress;
DROP POLICY IF EXISTS "game_session_progress_update_own_user"   ON public.game_session_progress;

CREATE POLICY "game_sessions_select_own_couple"
  ON public.game_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.couples
      WHERE couples.id = couple_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_sessions_insert_own_couple"
  ON public.game_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.couples
      WHERE couples.id = couple_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_sessions_update_own_couple"
  ON public.game_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.couples
      WHERE couples.id = couple_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.couples
      WHERE couples.id = couple_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_answers_select_own_couple"
  ON public.game_session_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_answers_insert_own_user"
  ON public.game_session_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_answers_update_own_user"
  ON public.game_session_answers
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_progress_select_own_couple"
  ON public.game_session_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_progress_insert_own_user"
  ON public.game_session_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );

CREATE POLICY "game_session_progress_update_own_user"
  ON public.game_session_progress
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions
      JOIN public.couples ON couples.id = game_sessions.couple_id
      WHERE game_sessions.id = session_id
        AND (
          (SELECT auth.uid()) = couples.user_a
          OR (SELECT auth.uid()) = couples.user_b
        )
    )
  );
