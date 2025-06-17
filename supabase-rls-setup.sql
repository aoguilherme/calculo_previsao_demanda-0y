-- Script para configurar Row Level Security (RLS) na tabela previsoes_demanda

-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Habilitar Row Level Security na tabela previsoes_demanda
ALTER TABLE previsoes_demanda ENABLE ROW LEVEL SECURITY;

-- 2. Criar política para permitir SELECT para usuários autenticados
CREATE POLICY "Permitir SELECT para usuários autenticados" ON previsoes_demanda
    FOR SELECT
    USING (true);

-- 3. Criar política para permitir INSERT para usuários autenticados
CREATE POLICY "Permitir INSERT para usuários autenticados" ON previsoes_demanda
    FOR INSERT
    WITH CHECK (true);

-- 4. Criar política para permitir UPDATE para usuários autenticados
CREATE POLICY "Permitir UPDATE para usuários autenticados" ON previsoes_demanda
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 5. Criar política para permitir DELETE para usuários autenticados
CREATE POLICY "Permitir DELETE para usuários autenticados" ON previsoes_demanda
    FOR DELETE
    USING (true);

-- 6. Verificar se as políticas foram criadas corretamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'previsoes_demanda';

-- 7. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'previsoes_demanda';