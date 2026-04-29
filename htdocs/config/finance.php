<?php
declare(strict_types=1);

function financeTableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int)$stmt->fetchColumn() > 0;
}

function financeColumnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table
           AND COLUMN_NAME = :column'
    );
    $stmt->execute([
        ':table' => $table,
        ':column' => $column,
    ]);
    return (int)$stmt->fetchColumn() > 0;
}

function financeIndexExists(PDO $pdo, string $table, string $index): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table
           AND INDEX_NAME = :index'
    );
    $stmt->execute([
        ':table' => $table,
        ':index' => $index,
    ]);
    return (int)$stmt->fetchColumn() > 0;
}

function roundMoney(float $value): float
{
    return round($value, 2);
}

function parseMoneyValue($value): float
{
    if (is_int($value) || is_float($value)) {
        return roundMoney((float)$value);
    }

    if (!is_string($value)) {
        throw new InvalidArgumentException('Valor monetario invalido.');
    }

    $normalized = trim($value);
    if ($normalized === '') {
        return 0.0;
    }

    $normalized = preg_replace('/[^\d,.\-]/', '', $normalized) ?? '';
    if ($normalized === '') {
        throw new InvalidArgumentException('Valor monetario invalido.');
    }

    if (str_contains($normalized, ',') && str_contains($normalized, '.')) {
        $normalized = str_replace('.', '', $normalized);
    }
    $normalized = str_replace(',', '.', $normalized);

    if (!is_numeric($normalized)) {
        throw new InvalidArgumentException('Valor monetario invalido.');
    }

    return roundMoney((float)$normalized);
}

function ensureFinancialSchema(PDO $pdo): void
{
    static $checked = false;

    if ($checked) {
        return;
    }

    if (!financeColumnExists($pdo, 'clientes', 'saldo_devendo')) {
        $pdo->exec(
            "ALTER TABLE clientes
             ADD COLUMN saldo_devendo DECIMAL(12,2) NOT NULL DEFAULT 0.00
             AFTER status"
        );
    }

    if (!financeColumnExists($pdo, 'produtos', 'preco')) {
        $pdo->exec(
            "ALTER TABLE produtos
             ADD COLUMN preco DECIMAL(10,2) NOT NULL DEFAULT 0.00
             AFTER estoque"
        );
    }

    if (!financeColumnExists($pdo, 'vendas', 'valor_total')) {
        $pdo->exec(
            "ALTER TABLE vendas
             ADD COLUMN valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00
             AFTER data_pagamento"
        );
    }

    if (!financeColumnExists($pdo, 'vendas', 'valor_pendente')) {
        $pdo->exec(
            "ALTER TABLE vendas
             ADD COLUMN valor_pendente DECIMAL(12,2) NOT NULL DEFAULT 0.00
             AFTER valor_total"
        );
    }

    if (!financeColumnExists($pdo, 'venda_itens', 'preco_unitario')) {
        $pdo->exec(
            "ALTER TABLE venda_itens
             ADD COLUMN preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00
             AFTER quantidade"
        );
    }

    if (!financeColumnExists($pdo, 'venda_itens', 'valor_total')) {
        $pdo->exec(
            "ALTER TABLE venda_itens
             ADD COLUMN valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00
             AFTER preco_unitario"
        );
    }

    if (!financeTableExists($pdo, 'transacoes_financeiras')) {
        $pdo->exec(
            "CREATE TABLE transacoes_financeiras (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    if (!financeColumnExists($pdo, 'transacoes_financeiras', 'created_at')) {
        if (financeColumnExists($pdo, 'transacoes_financeiras', 'criado_em')) {
            $pdo->exec(
                "ALTER TABLE transacoes_financeiras
                 CHANGE COLUMN criado_em created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
            );
        } else {
            $pdo->exec(
                "ALTER TABLE transacoes_financeiras
                 ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
            );
        }
    }

    if (!financeIndexExists($pdo, 'transacoes_financeiras', 'idx_transacoes_data')) {
        $pdo->exec(
            "ALTER TABLE transacoes_financeiras
             ADD INDEX idx_transacoes_data (created_at)"
        );
    }

    $pdo->exec(
        "UPDATE venda_itens vi
         INNER JOIN produtos p ON p.id = vi.produto_id
         SET vi.preco_unitario = CASE
             WHEN COALESCE(vi.preco_unitario, 0) > 0 THEN ROUND(vi.preco_unitario, 2)
             WHEN COALESCE(p.preco, 0) > 0 THEN ROUND(p.preco, 2)
             ELSE 0.00
         END"
    );

    $pdo->exec(
        "UPDATE venda_itens
         SET valor_total = CASE
             WHEN COALESCE(valor_total, 0) > 0 THEN ROUND(valor_total, 2)
             ELSE ROUND(quantidade * COALESCE(preco_unitario, 0), 2)
         END"
    );

    $pdo->exec(
        "UPDATE vendas v
         LEFT JOIN (
             SELECT
                 venda_id,
                 ROUND(SUM(
                     CASE
                         WHEN COALESCE(valor_total, 0) > 0 THEN valor_total
                         ELSE quantidade * COALESCE(preco_unitario, 0)
                     END
                 ), 2) AS fallback_total
             FROM venda_itens
             GROUP BY venda_id
         ) itens ON itens.venda_id = v.id
         SET v.valor_total = CASE
             WHEN COALESCE(v.valor_total, 0) <= 0 THEN COALESCE(itens.fallback_total, 0)
             ELSE ROUND(v.valor_total, 2)
         END"
    );

    $pdo->exec(
        "UPDATE vendas
         SET valor_pendente = CASE
             WHEN status_venda <> 'Finalizada' THEN 0.00
             WHEN status_pagamento = 'Pago' THEN 0.00
             WHEN COALESCE(valor_pendente, 0) <= 0 THEN COALESCE(valor_total, 0)
             ELSE ROUND(valor_pendente, 2)
         END"
    );

    $pdo->exec(
        "UPDATE vendas
         SET forma_pagamento = 'Fiado'
         WHERE LOWER(TRIM(forma_pagamento)) IN ('credit', 'credito rotativo', 'fiado')"
    );

    $pdo->exec(
        "UPDATE transacoes_financeiras
         SET forma_pagamento = 'Fiado'
         WHERE forma_pagamento IS NOT NULL
           AND LOWER(TRIM(forma_pagamento)) IN ('credit', 'credito rotativo', 'fiado')"
    );

    $pdo->exec(
        "UPDATE vendas
         SET forma_pagamento = 'Fiado'
         WHERE status_venda = 'Finalizada'
           AND status_pagamento = 'Pendente'
           AND COALESCE(valor_pendente, 0) > 0"
    );

    $pdo->exec(
        "UPDATE transacoes_financeiras
         SET forma_pagamento = 'Fiado'
         WHERE tipo = 'debito_venda'"
    );

    syncClientOutstandingBalances($pdo);
    $checked = true;
}

function syncClientOutstandingBalances(PDO $pdo): void
{
    $pdo->exec(
        "UPDATE clientes c
         LEFT JOIN (
             SELECT cliente_id, COALESCE(SUM(valor_pendente), 0) AS total_pendente
             FROM vendas
             WHERE COALESCE(valor_pendente, 0) > 0
             GROUP BY cliente_id
         ) financeiros ON financeiros.cliente_id = c.id
         SET c.saldo_devendo = COALESCE(financeiros.total_pendente, 0)"
    );
}

function adjustClientOutstandingBalance(PDO $pdo, int $clientId, float $delta): array
{
    $stmt = $pdo->prepare('SELECT saldo_devendo FROM clientes WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $clientId]);
    $row = $stmt->fetch();

    if (!$row) {
        throw new RuntimeException('Cliente nao encontrado.');
    }

    $before = roundMoney((float)$row['saldo_devendo']);
    $after = roundMoney(max(0.0, $before + $delta));

    $update = $pdo->prepare('UPDATE clientes SET saldo_devendo = :saldo WHERE id = :id');
    $update->execute([
        ':saldo' => $after,
        ':id' => $clientId,
    ]);

    return [
        'before' => $before,
        'after' => $after,
    ];
}

function registerFinancialTransaction(PDO $pdo, array $payload): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO transacoes_financeiras
            (cliente_id, venda_id, tipo, valor, saldo_anterior, saldo_posterior, forma_pagamento, descricao, observacao)
         VALUES
            (:cliente_id, :venda_id, :tipo, :valor, :saldo_anterior, :saldo_posterior, :forma_pagamento, :descricao, :observacao)'
    );

    $stmt->execute([
        ':cliente_id' => (int)$payload['client_id'],
        ':venda_id' => isset($payload['sale_id']) ? (int)$payload['sale_id'] : null,
        ':tipo' => (string)$payload['type'],
        ':valor' => roundMoney((float)$payload['amount']),
        ':saldo_anterior' => roundMoney((float)$payload['balance_before']),
        ':saldo_posterior' => roundMoney((float)$payload['balance_after']),
        ':forma_pagamento' => $payload['payment_method'] !== null ? (string)$payload['payment_method'] : null,
        ':descricao' => (string)$payload['description'],
        ':observacao' => isset($payload['note']) && trim((string)$payload['note']) !== ''
            ? trim((string)$payload['note'])
            : null,
    ]);
}

function getSaleDueDateIso(?string $paymentDate, string $saleDate): string
{
    $normalizedPaymentDate = trim((string)$paymentDate);
    if ($normalizedPaymentDate !== '') {
        return substr($normalizedPaymentDate, 0, 10);
    }

    return substr($saleDate, 0, 10);
}

function getSaleItemsTotal(PDO $pdo, int $saleId): float
{
    $stmt = $pdo->prepare(
        'SELECT ROUND(COALESCE(SUM(
            CASE
                WHEN COALESCE(valor_total, 0) > 0 THEN valor_total
                ELSE quantidade * COALESCE(preco_unitario, 0)
            END
        ), 0), 2)
         FROM venda_itens
         WHERE venda_id = :sale_id'
    );
    $stmt->execute([':sale_id' => $saleId]);

    return roundMoney((float)$stmt->fetchColumn());
}

function resolveFinancialLaunchStatus(
    string $saleStatus,
    string $paymentStatus,
    float $totalAmount,
    float $pendingAmount,
    string $dueDateIso,
    ?string $todayIso = null
): string {
    $normalizedSaleStatus = trim($saleStatus);
    if ($normalizedSaleStatus !== 'Finalizada') {
        return 'Cancelado';
    }

    $normalizedPendingAmount = roundMoney(max(0.0, $pendingAmount));
    $normalizedTotalAmount = roundMoney(max(0.0, $totalAmount));
    if ($normalizedPendingAmount <= 0.0 || trim($paymentStatus) === 'Pago') {
        return 'Pago';
    }

    $referenceDate = $todayIso ?? todayYmd();
    if ($dueDateIso !== '' && $dueDateIso < $referenceDate) {
        return 'Atrasado';
    }

    if ($normalizedTotalAmount > 0.0 && $normalizedPendingAmount < $normalizedTotalAmount) {
        return 'Parcial';
    }

    return 'Em aberto';
}
