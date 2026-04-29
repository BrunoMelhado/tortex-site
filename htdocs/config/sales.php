<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance.php';
require_once __DIR__ . '/inventory.php';

function ensureSalesSchema(PDO $pdo): void
{
    static $checked = false;

    if ($checked) {
        return;
    }

    $columnWasAdded = false;
    if (!financeColumnExists($pdo, 'vendas', 'estoque_movimentado')) {
        $pdo->exec(
            "ALTER TABLE vendas
             ADD COLUMN estoque_movimentado TINYINT(1) NOT NULL DEFAULT 0
             AFTER valor_pendente"
        );
        $columnWasAdded = true;
    }

    if ($columnWasAdded) {
        // Corrige vendas antigas: antes desta migracao toda venda baixava estoque,
        // mesmo sem estar finalizada.
        $pdo->exec(
            "UPDATE produtos p
             INNER JOIN (
                 SELECT vi.produto_id, SUM(vi.quantidade) AS quantidade_retorno
                 FROM venda_itens vi
                 INNER JOIN vendas v ON v.id = vi.venda_id
                 WHERE v.status_venda <> 'Finalizada'
                 GROUP BY vi.produto_id
             ) ajustes ON ajustes.produto_id = p.id
             SET p.estoque = p.estoque + ajustes.quantidade_retorno"
        );

        $pdo->exec(
            "UPDATE vendas
             SET estoque_movimentado = CASE
                 WHEN status_venda = 'Finalizada' THEN 1
                 ELSE 0
             END"
        );
    }

    $checked = true;
}

function saleIsFinalizedStatus(string $status): bool
{
    return trim($status) === 'Finalizada';
}

function saleUsesFiado(string $paymentMethod): bool
{
    return paymentMethodIsFiado($paymentMethod);
}

function saleHasStockMovement(array $sale): bool
{
    return (int)($sale['estoque_movimentado'] ?? 0) === 1;
}

function normalizeSalePaymentStatus(string $paymentStatus): string
{
    return trim($paymentStatus) === 'Pago' ? 'Pago' : 'Pendente';
}

function resolveSalePaymentDate(string $paymentStatus, ?string $requestedPaymentDate, ?string $fallbackPaymentDate): ?string
{
    if ($paymentStatus === 'Pago') {
        return todayYmd();
    }

    $requested = trim((string)$requestedPaymentDate);
    if ($requested !== '') {
        return substr($requested, 0, 10);
    }

    $fallback = trim((string)$fallbackPaymentDate);
    if ($fallback !== '') {
        return substr($fallback, 0, 10);
    }

    return null;
}

function calculateSalePendingAmount(
    bool $willBeFinalized,
    string $paymentMethod,
    string $paymentStatus,
    float $totalAmount,
    float $currentPendingAmount
): float {
    if (!$willBeFinalized) {
        return 0.0;
    }

    if ($paymentStatus !== 'Pendente' || !saleUsesFiado($paymentMethod) || $totalAmount <= 0) {
        return 0.0;
    }

    if ($currentPendingAmount > 0) {
        return roundMoney(min($currentPendingAmount, $totalAmount));
    }

    return roundMoney($totalAmount);
}

function getDefaultOpenSaleStatus(?string $currentStatus): string
{
    $status = trim((string)$currentStatus);
    if ($status === '' || $status === 'Finalizada') {
        return 'Em preparacao';
    }

    return $status;
}

function getSaleForUpdate(PDO $pdo, int $saleId): array
{
    $stmt = $pdo->prepare(
        'SELECT
            id,
            cliente_id,
            forma_pagamento,
            status_pagamento,
            status_venda,
            data_pagamento,
            data_venda,
            valor_total,
            valor_pendente,
            estoque_movimentado
         FROM vendas
         WHERE id = :id
         FOR UPDATE'
    );
    $stmt->execute([':id' => $saleId]);
    $sale = $stmt->fetch();

    if (!$sale) {
        throw new RuntimeException('Venda nao encontrada.');
    }

    return $sale;
}

function getSaleClientForUpdate(PDO $pdo, int $clientId): array
{
    $stmt = $pdo->prepare('SELECT id, saldo_devendo FROM clientes WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $clientId]);
    $client = $stmt->fetch();

    if (!$client) {
        throw new RuntimeException('Cliente nao encontrado.');
    }

    return $client;
}

function saleHasFiadoDebitTransaction(PDO $pdo, int $saleId): bool
{
    $stmt = $pdo->prepare(
        "SELECT id
         FROM transacoes_financeiras
         WHERE venda_id = :sale_id
           AND tipo = 'debito_venda'
         LIMIT 1"
    );
    $stmt->execute([':sale_id' => $saleId]);

    return (bool)$stmt->fetchColumn();
}

function getSaleTotalAmountForSync(PDO $pdo, array $sale): float
{
    $saleId = (int)$sale['id'];
    $storedTotalAmount = roundMoney((float)($sale['valor_total'] ?? 0));
    $itemsTotal = getSaleItemsTotal($pdo, $saleId);

    return $itemsTotal > 0 ? $itemsTotal : $storedTotalAmount;
}

function registerSaleFinancialChange(
    PDO $pdo,
    array $sale,
    array $client,
    string $paymentMethod,
    string $paymentStatus,
    bool $wasFinalized,
    bool $willBeFinalized,
    float $totalAmount,
    float $targetPendingAmount
): void {
    $currentPendingAmount = roundMoney((float)($sale['valor_pendente'] ?? 0));
    $clientId = (int)$sale['cliente_id'];
    $saleId = (int)$sale['id'];
    $saleCode = formatCode('VEN', $saleId);
    $currentBalance = roundMoney((float)($client['saldo_devendo'] ?? 0));

    if ($targetPendingAmount > $currentPendingAmount) {
        if (saleHasFiadoDebitTransaction($pdo, $saleId)) {
            throw new RuntimeException('Esta venda fiado ja possui lancamento financeiro. Use o Financeiro para ajustar pagamentos.');
        }

        $delta = roundMoney($targetPendingAmount - $currentPendingAmount);
        $balanceTransition = adjustClientOutstandingBalance($pdo, $clientId, $delta);

        registerFinancialTransaction($pdo, [
            'client_id' => $clientId,
            'sale_id' => $saleId,
            'type' => 'debito_venda',
            'amount' => $delta,
            'balance_before' => $balanceTransition['before'],
            'balance_after' => $balanceTransition['after'],
            'payment_method' => $paymentMethod,
            'description' => !$wasFinalized
                ? sprintf('Venda %s finalizada em fiado.', $saleCode)
                : sprintf('Debito fiado da venda %s registrado.', $saleCode),
            'note' => null,
        ]);
        return;
    }

    if ($targetPendingAmount < $currentPendingAmount) {
        $delta = roundMoney($currentPendingAmount - $targetPendingAmount);
        $balanceTransition = adjustClientOutstandingBalance($pdo, $clientId, -$delta);
        $isPaidSettlement = $paymentStatus === 'Pago' && $targetPendingAmount <= 0;

        registerFinancialTransaction($pdo, [
            'client_id' => $clientId,
            'sale_id' => $saleId,
            'type' => $isPaidSettlement ? 'pagamento_venda' : 'estorno_debito',
            'amount' => $delta,
            'balance_before' => $balanceTransition['before'],
            'balance_after' => $balanceTransition['after'],
            'payment_method' => $paymentMethod,
            'description' => $isPaidSettlement
                ? sprintf('Pagamento da venda %s confirmado.', $saleCode)
                : sprintf('Debito da venda %s removido.', $saleCode),
            'note' => null,
        ]);
        return;
    }

    $currentPaymentStatus = trim((string)($sale['status_pagamento'] ?? ''));
    if (
        $willBeFinalized
        && $paymentStatus === 'Pago'
        && $targetPendingAmount <= 0
        && $totalAmount > 0
        && (!$wasFinalized || $currentPaymentStatus !== 'Pago')
    ) {
        registerFinancialTransaction($pdo, [
            'client_id' => $clientId,
            'sale_id' => $saleId,
            'type' => 'pagamento_venda',
            'amount' => $totalAmount,
            'balance_before' => $currentBalance,
            'balance_after' => $currentBalance,
            'payment_method' => $paymentMethod,
            'description' => sprintf('Venda %s finalizada com pagamento confirmado.', $saleCode),
            'note' => null,
        ]);
    }
}

function synchronizeSaleState(PDO $pdo, int $saleId, array $payload): array
{
    $sale = getSaleForUpdate($pdo, $saleId);
    $client = getSaleClientForUpdate($pdo, (int)$sale['cliente_id']);

    $paymentMethod = paymentMethodToDb((string)($payload['payment_method'] ?? $sale['forma_pagamento']));
    $paymentStatus = normalizeSalePaymentStatus((string)($payload['payment_status'] ?? $sale['status_pagamento']));
    $shouldFinalize = (bool)($payload['should_finalize'] ?? false);

    if ($paymentStatus === 'Pendente') {
        $paymentMethod = 'Fiado';
    } elseif (paymentMethodIsFiado($paymentMethod)) {
        throw new RuntimeException('Vendas pagas precisam de forma de pagamento imediata (Pix, Caju ou Dinheiro).');
    }

    $wasFinalized = saleIsFinalizedStatus((string)$sale['status_venda']);
    $willBeFinalized = $shouldFinalize || $wasFinalized;
    $totalAmount = getSaleTotalAmountForSync($pdo, $sale);
    $targetPendingAmount = calculateSalePendingAmount(
        $willBeFinalized,
        $paymentMethod,
        $paymentStatus,
        $totalAmount,
        roundMoney((float)($sale['valor_pendente'] ?? 0))
    );
    $targetPaymentDate = resolveSalePaymentDate(
        $paymentStatus,
        isset($payload['payment_date']) ? (string)$payload['payment_date'] : null,
        (string)($sale['data_pagamento'] ?? '')
    );
    $targetSaleStatus = $willBeFinalized ? 'Finalizada' : getDefaultOpenSaleStatus((string)$sale['status_venda']);
    $hasStockMovement = saleHasStockMovement($sale);

    if ($willBeFinalized && !$hasStockMovement) {
        updateSaleInventory($pdo, $saleId, -1);
        $hasStockMovement = true;
    }

    registerSaleFinancialChange(
        $pdo,
        $sale,
        $client,
        $paymentMethod,
        $paymentStatus,
        $wasFinalized,
        $willBeFinalized,
        $totalAmount,
        $targetPendingAmount
    );

    $stmt = $pdo->prepare(
        'UPDATE vendas
         SET forma_pagamento = :forma_pagamento,
             status_pagamento = :status_pagamento,
             status_venda = :status_venda,
             data_pagamento = :data_pagamento,
             valor_total = :valor_total,
             valor_pendente = :valor_pendente,
             estoque_movimentado = :estoque_movimentado
         WHERE id = :id'
    );
    $stmt->execute([
        ':forma_pagamento' => $paymentMethod,
        ':status_pagamento' => $paymentStatus,
        ':status_venda' => $targetSaleStatus,
        ':data_pagamento' => $targetPaymentDate,
        ':valor_total' => $totalAmount,
        ':valor_pendente' => $targetPendingAmount,
        ':estoque_movimentado' => $hasStockMovement ? 1 : 0,
        ':id' => $saleId,
    ]);

    return [
        'sale_id' => $saleId,
        'client_id' => (int)$sale['cliente_id'],
        'payment_method' => $paymentMethod,
        'payment_status' => $paymentStatus,
        'sale_status' => $targetSaleStatus,
        'payment_date' => $targetPaymentDate,
        'pending_amount' => $targetPendingAmount,
        'total_amount' => $totalAmount,
        'stock_moved' => $hasStockMovement,
    ];
}

function deleteSaleWithReversal(PDO $pdo, int $saleId): array
{
    $sale = getSaleForUpdate($pdo, $saleId);
    $hadStockMovement = saleHasStockMovement($sale);

    if ($hadStockMovement) {
        updateSaleInventory($pdo, $saleId, 1);
    }

    $deleteTransactionsStmt = $pdo->prepare('DELETE FROM transacoes_financeiras WHERE venda_id = :sale_id');
    $deleteTransactionsStmt->execute([':sale_id' => $saleId]);

    $deleteItemsStmt = $pdo->prepare('DELETE FROM venda_itens WHERE venda_id = :sale_id');
    $deleteItemsStmt->execute([':sale_id' => $saleId]);

    $deleteSaleStmt = $pdo->prepare('DELETE FROM vendas WHERE id = :sale_id');
    $deleteSaleStmt->execute([':sale_id' => $saleId]);

    syncClientOutstandingBalances($pdo);

    return [
        'sale_id' => $saleId,
        'client_id' => (int)$sale['cliente_id'],
        'was_finalized' => saleIsFinalizedStatus((string)$sale['status_venda']),
        'had_stock_movement' => $hadStockMovement,
    ];
}
