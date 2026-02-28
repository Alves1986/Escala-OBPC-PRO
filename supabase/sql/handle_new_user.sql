-- Reescrita segura da função usada pelo trigger on_auth_user_created.
-- Objetivo: criar profile padrão de membro e criar membership apenas quando invite metadata existir.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_org_text text;
  v_ministry_text text;
  v_org_id uuid;
  v_ministry_id uuid;
BEGIN
  -- Log básico de criação do usuário no auth.
  RAISE NOTICE '[handle_new_user] user created: id=%, email=%', NEW.id, NEW.email;

  -- Lê nome do metadata; se vier vazio, usa fallback amigável.
  v_full_name := NULLIF(NEW.raw_user_meta_data ->> 'full_name', '');
  IF v_full_name IS NULL THEN
    v_full_name := 'Usuário';
  END IF;

  -- Extrai IDs do invite de forma tolerante a nomes alternativos de chave.
  -- Se não houver invite, esses valores ficam NULL e o fluxo continua sem erro.
  v_org_text := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'organization_id', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'org_id', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'orgId', '')
  );

  v_ministry_text := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'ministry_id', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'ministryId', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'ministry', '')
  );

  IF v_org_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_org_id := v_org_text::uuid;
  END IF;

  IF v_ministry_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_ministry_id := v_ministry_text::uuid;
  END IF;

  -- Cria/atualiza profile padrão SEM admin automático.
  -- role fixo "member" e is_admin false.
  INSERT INTO public.profiles (
    id,
    email,
    name,
    organization_id,
    ministry_id,
    is_admin,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_org_id,
    v_ministry_id,
    false,
    'member'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
        ministry_id = COALESCE(EXCLUDED.ministry_id, public.profiles.ministry_id),
        is_admin = false,
        role = 'member';

  -- Se invite metadata existir, cria membership inicial de membro.
  -- Se invite não existir, não falha: apenas pula esta etapa.
  IF v_org_id IS NOT NULL AND v_ministry_id IS NOT NULL THEN
    RAISE NOTICE '[handle_new_user] invite found: org=%, ministry=%', v_org_id, v_ministry_id;

    INSERT INTO public.organization_memberships (
      organization_id,
      ministry_id,
      profile_id,
      role,
      functions
    ) VALUES (
      v_org_id,
      v_ministry_id,
      NEW.id,
      'member',
      '[]'::jsonb
    )
    ON CONFLICT (organization_id, ministry_id, profile_id) DO NOTHING;

    RAISE NOTICE '[handle_new_user] membership created/ensured: profile_id=%', NEW.id;
  ELSE
    RAISE NOTICE '[handle_new_user] invite metadata absent; membership not created for user %', NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Segurança: não quebrar signup por erro de metadata/tratamento.
    RAISE NOTICE '[handle_new_user] non-fatal error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Garantia de vínculo do trigger com a função atualizada.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
