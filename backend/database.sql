-- Tabela de usuários
CREATE TABLE usuarios (
    id UUID PRIMARY KEY, -- Alterado para UUID para compatibilidade com Supabase Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    stripe_customer_id VARCHAR(100),
    subscription_status VARCHAR(50) DEFAULT 'trialing',
    subscription_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de entradas
CREATE TABLE entradas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data_entrada DATE NOT NULL,
    forma_recebimento VARCHAR(50) NOT NULL,
    descricao TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de cartões
CREATE TABLE cartoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    bandeira VARCHAR(50) NOT NULL,
    limite DECIMAL(10,2) NOT NULL,
    data_fechamento INTEGER NOT NULL,
    data_vencimento INTEGER NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de despesas (atualizada com parcelas)
CREATE TABLE despesas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    tipo_pagamento VARCHAR(50) NOT NULL,
    data_despesa DATE NOT NULL,
    local VARCHAR(255),
    descricao TEXT,
    parcelas INTEGER DEFAULT 1,
    cartao_id INTEGER REFERENCES cartoes(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela para extrato de cartão de crédito (parcelamento)
CREATE TABLE extrato_cartao (
    id SERIAL PRIMARY KEY,
    cartao_id INTEGER REFERENCES cartoes(id) ON DELETE CASCADE,
    despesa_id INTEGER REFERENCES despesas(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    parcela_numero INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,
    pago BOOLEAN DEFAULT FALSE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);