-- Script para adicionar colunas de perfil a tabela utilizadores
-- Executar no SQL Server Management Studio (SSMS)

-- Adicionar coluna idade (opcional, permite NULL)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'idade')
BEGIN
    ALTER TABLE utilizadores ADD idade INT NULL;
    PRINT 'Coluna idade adicionada com sucesso.';
END
ELSE
BEGIN
    PRINT 'Coluna idade ja existe.';
END
GO

-- Adicionar coluna peso (opcional, permite NULL, decimal para valores como 70.5)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'peso')
BEGIN
    ALTER TABLE utilizadores ADD peso DECIMAL(5,1) NULL;
    PRINT 'Coluna peso adicionada com sucesso.';
END
ELSE
BEGIN
    PRINT 'Coluna peso ja existe.';
END
GO

-- Adicionar coluna meta_diaria (objetivo diario em litros, default 2.0)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'meta_diaria')
BEGIN
    ALTER TABLE utilizadores ADD meta_diaria DECIMAL(3,1) NULL DEFAULT 2.0;
    PRINT 'Coluna meta_diaria adicionada com sucesso.';
END
ELSE
BEGIN
    PRINT 'Coluna meta_diaria ja existe.';
END
GO

-- Verificar as colunas adicionadas
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'utilizadores'
ORDER BY ORDINAL_POSITION;
