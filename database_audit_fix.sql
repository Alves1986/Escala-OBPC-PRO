-- DIAGNÓSTICO:
-- O código da aplicação (App.tsx e supabaseService.ts) foi atualizado para salvar e ler
-- uma chave composta (RuleUUID_YYYY-MM-DD) na coluna 'event_id'.
--
-- PROBLEMA ATUAL:
-- 1. A coluna 'event_id' na tabela 'schedule_assignments' provavelmente está tipada como UUID.
-- 2. O backend rejeita a gravação de 'UUID_DATA' (string) nessa coluna (Erro: invalid input syntax for type uuid).
-- 3. Se por acaso salvou apenas o UUID, a leitura falha ao mapear para a data específica na UI (Chave incompleta).
--
-- SOLUÇÃO:
-- Alterar 'event_id' para TEXT para aceitar a chave composta gerada pelo frontend.
-- Ajustar a constraint de unicidade para garantir que (event_id, role) seja único.

BEGIN;

-- 1. Remover Foreign Key se existir (pois agora event_id armazenará uma string composta, não apenas o UUID da regra)
ALTER TABLE schedule_assignments
DROP CONSTRAINT IF EXISTS schedule_assignments_event_id_fkey;

-- 2. Alterar o tipo da coluna para TEXT para suportar 'RuleID_YYYY-MM-DD'
ALTER TABLE schedule_assignments
ALTER COLUMN event_id TYPE text;

-- 3. Garantir que organization_id não seja nulo (Segurança Multi-tenant)
ALTER TABLE schedule_assignments
ALTER COLUMN organization_id SET NOT NULL;

-- 4. Remover constraints de unicidade antigas/conflitantes
ALTER TABLE schedule_assignments
DROP CONSTRAINT IF EXISTS schedule_assignments_event_id_role_key;

ALTER TABLE schedule_assignments
DROP CONSTRAINT IF EXISTS unique_assignment;

-- 5. Criar índice único correto para evitar duplicação na mesma função do mesmo evento/data
-- Esta constraint é EXIGIDA pelo 'onConflict' do código upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_assignments_composite 
ON schedule_assignments (event_id, role);

-- 6. Opcional: Limpeza de dados órfãos ou inválidos (Safe Mode)
-- DELETE FROM schedule_assignments WHERE event_id NOT LIKE '%_%'; -- Remove entradas antigas sem data

COMMIT;
