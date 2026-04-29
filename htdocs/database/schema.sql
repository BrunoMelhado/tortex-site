-- MySQL 8+ / MariaDB compativel
-- Execute este script no banco if0_41280861_db_tortas

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  senha VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email),
  KEY idx_usuarios_nome (nome),
  KEY idx_usuarios_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(160) NOT NULL,
  predio VARCHAR(20) NOT NULL,
  andar VARCHAR(30) NOT NULL,
  status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
  saldo_devendo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clientes_telefone (telefone),
  UNIQUE KEY uq_clientes_email (email),
  KEY idx_clientes_nome (nome),
  KEY idx_clientes_status (status),
  KEY idx_clientes_saldo (saldo_devendo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produtos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  estoque INT UNSIGNED NOT NULL DEFAULT 0,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_produtos_nome (nome),
  KEY idx_produtos_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT UNSIGNED NOT NULL,
  tipo ENUM('retirada', 'entrega') NOT NULL,
  forma_pagamento VARCHAR(40) NOT NULL,
  status_pagamento ENUM('Pago', 'Pendente') NOT NULL DEFAULT 'Pendente',
  status_venda ENUM('Em preparacao', 'Em andamento', 'Finalizada') NOT NULL DEFAULT 'Em preparacao',
  data_venda DATETIME NOT NULL,
  data_pagamento DATE NULL,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  valor_pendente DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  estoque_movimentado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vendas_cliente (cliente_id),
  KEY idx_vendas_data_venda (data_venda),
  KEY idx_vendas_status_pagamento (status_pagamento),
  KEY idx_vendas_valor_pendente (valor_pendente),
  CONSTRAINT fk_vendas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venda_itens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venda_id INT UNSIGNED NOT NULL,
  produto_id INT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  KEY idx_venda_itens_venda (venda_id),
  KEY idx_venda_itens_produto (produto_id),
  CONSTRAINT fk_venda_itens_venda FOREIGN KEY (venda_id) REFERENCES vendas(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_venda_itens_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT UNSIGNED NOT NULL,
  venda_id INT UNSIGNED NULL,
  tipo ENUM('debito_venda', 'pagamento_manual', 'pagamento_venda', 'estorno_debito') NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  saldo_anterior DECIMAL(12,2) NOT NULL,
  saldo_posterior DECIMAL(12,2) NOT NULL,
  forma_pagamento VARCHAR(40) NULL,
  descricao VARCHAR(255) NOT NULL,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_transacoes_cliente (cliente_id),
  KEY idx_transacoes_venda (venda_id),
  KEY idx_transacoes_tipo (tipo),
  KEY idx_transacoes_data (created_at),
  CONSTRAINT fk_transacoes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transacoes_venda FOREIGN KEY (venda_id) REFERENCES vendas(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
