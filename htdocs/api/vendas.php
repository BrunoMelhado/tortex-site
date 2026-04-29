<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/finance.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

function mapSaleRow(array $row): array
{
    return [
        'id' => formatCode('VEN', (int)$row['sale_id']),
        'clientId' => formatCode('CLI', (int)$row['client_id']),
        'clientName' => $row['client_name'],
        'clientPhone' => $row['telefone'],
        'clientEmail' => $row['email'],
        'saleDate' => $row['data_venda'],
        'paymentDate' => $row['data_pagamento'],
        'saleStatus' => $row['status_venda'],
        'paymentStatus' => $row['status_pagamento'],
        'paymentMethod' => paymentMethodToView((string)$row['forma_pagamento']),
        'deliveryType' => $row['tipo'],
        'building' => $row['predio'],
        'floor' => $row['andar'],
        'estimatedDelivery' => $row['tipo'] === 'entrega' ? '25 min' : '',
        'totalAmount' => roundMoney((float)($row['valor_total'] ?? 0)),
        'pendingAmount' => roundMoney((float)($row['valor_pendente'] ?? 0)),
        'items' => [],
    ];
}

function ensureSaleDates(string $paymentTiming, string $paymentDate): void
{
    if ($paymentTiming === 'immediate' || $paymentTiming === 'same_day') {
        return;
    }

    $today = new DateTimeImmutable('today');
    $tomorrow = $today->modify('+1 day');

    if ($paymentDate === '') {
        jsonResponse(['success' => false, 'message' => 'Campo data obrigatorio.'], 422);
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $paymentDate);
    if (!$date) {
        jsonResponse(['success' => false, 'message' => 'Data de pagamento invalida.'], 422);
    }

    if ($date < $tomorrow) {
        jsonResponse(['success' => false, 'message' => 'Venda fiado exige data futura de vencimento.'], 422);
    }
}

function parseRequestBoolean($value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int)$value === 1;
    }
    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        return in_array($normalized, ['1', 'true', 'sim', 'yes', 'on'], true);
    }
    return false;
}

function parseOptionalMoneyValue($value): ?float
{
    if ($value === null) {
        return null;
    }
    if (is_string($value) && trim($value) === '') {
        return null;
    }

    return parseMoneyValue($value);
}

function parseOptionalIsoDateFilter(string $value, string $fieldLabel): ?string
{
    $normalized = trim($value);
    if ($normalized === '') {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $normalized);
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors)
        && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0);

    if (!$date || $hasErrors) {
        jsonResponse(['success' => false, 'message' => "{$fieldLabel} invalida."], 422);
    }

    return $date->format('Y-m-d');
}

function normalizeCreateSaleItems(array $body): array
{
    if (array_key_exists('items', $body)) {
        $rawItems = $body['items'];
        if (!is_array($rawItems) || $rawItems === []) {
            throw new InvalidArgumentException('Adicione pelo menos um item na venda.');
        }

        $normalizedItems = [];
        foreach ($rawItems as $rawItem) {
            if (!is_array($rawItem)) {
                throw new InvalidArgumentException('Itens da venda invalidos.');
            }

            try {
                $unitPrice = parseOptionalMoneyValue($rawItem['unitPrice'] ?? null);
            } catch (InvalidArgumentException $exception) {
                throw new InvalidArgumentException('Preco unitario invalido.');
            }

            $normalizedItems[] = [
                'productCode' => trim((string)($rawItem['productId'] ?? '')),
                'quantity' => (int)($rawItem['quantity'] ?? 0),
                'unitPrice' => $unitPrice,
            ];
        }

        return $normalizedItems;
    }

    try {
        $unitPrice = parseOptionalMoneyValue($body['unitPrice'] ?? null);
    } catch (InvalidArgumentException $exception) {
        throw new InvalidArgumentException('Preco unitario invalido.');
    }

    return [[
        'productCode' => trim((string)($body['productId'] ?? '')),
        'quantity' => (int)($body['quantity'] ?? 0),
        'unitPrice' => $unitPrice,
    ]];
}

function resolveCreatePaymentStatus(string $paymentTiming): string
{
    return ($paymentTiming === 'immediate' || $paymentTiming === 'same_day')
        ? 'Pago'
        : 'Pendente';
}

try {
    requireAuthSession(true);
    $method = requireMethod(['GET', 'POST', 'PUT', 'DELETE']);
    $pdo = db();
    ensureFinancialSchema($pdo);
    ensureSalesSchema($pdo);

    if ($method === 'GET') {
        $startDateParam = trim((string)($_GET['data_inicio'] ?? ''));
        $endDateParam = trim((string)($_GET['data_fim'] ?? ''));
        $singleDateParam = trim((string)($_GET['data_venda'] ?? ''));

        if ($singleDateParam !== '' && $startDateParam === '' && $endDateParam === '') {
            $startDateParam = $singleDateParam;
            $endDateParam = $singleDateParam;
        }

        $startDate = parseOptionalIsoDateFilter($startDateParam, 'Data inicial');
        $endDate = parseOptionalIsoDateFilter($endDateParam, 'Data final');
        if ($startDate !== null && $endDate !== null && $startDate > $endDate) {
            jsonResponse(['success' => false, 'message' => 'Data inicial nao pode ser maior que a data final.'], 422);
        }

        $sql = "
            SELECT
                v.id AS sale_id,
                v.cliente_id AS client_id,
                c.nome AS client_name,
                c.telefone,
                c.email,
                c.predio,
                c.andar,
                v.tipo,
                v.forma_pagamento,
                v.status_pagamento,
                v.status_venda,
                v.data_venda,
                v.data_pagamento,
                v.valor_total,
                v.valor_pendente,
                vi.produto_id,
                vi.quantidade,
                vi.preco_unitario,
                vi.valor_total AS item_total,
                p.nome AS product_name
            FROM vendas v
            INNER JOIN clientes c ON c.id = v.cliente_id
            INNER JOIN venda_itens vi ON vi.venda_id = v.id
            INNER JOIN produtos p ON p.id = vi.produto_id
        ";
        $params = [];

        if ($startDate !== null && $endDate !== null) {
            $sql .= ' WHERE DATE(v.data_venda) BETWEEN :data_inicio AND :data_fim';
            $params[':data_inicio'] = $startDate;
            $params[':data_fim'] = $endDate;
        } elseif ($startDate !== null) {
            $sql .= ' WHERE DATE(v.data_venda) >= :data_inicio';
            $params[':data_inicio'] = $startDate;
        } elseif ($endDate !== null) {
            $sql .= ' WHERE DATE(v.data_venda) <= :data_fim';
            $params[':data_fim'] = $endDate;
        }

        $sql .= ' ORDER BY v.id DESC, vi.id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $salesById = [];
        foreach ($rows as $row) {
            $saleId = (int)$row['sale_id'];
            if (!isset($salesById[$saleId])) {
                $salesById[$saleId] = mapSaleRow($row);
            }
            $salesById[$saleId]['items'][] = [
                'productId' => formatCode('PRD', (int)$row['produto_id']),
                'productName' => $row['product_name'],
                'quantity' => (int)$row['quantidade'],
                'unitPrice' => roundMoney((float)($row['preco_unitario'] ?? 0)),
                'totalAmount' => roundMoney((float)($row['item_total'] ?? 0)),
            ];
        }

        jsonResponse(['success' => true, 'data' => array_values($salesById)]);
    }

    $body = readJsonBody();

    if ($method === 'POST') {
        $clientCode = trim((string)($body['clientId'] ?? ''));
        $deliveryType = trim((string)($body['deliveryType'] ?? 'retirada'));
        $paymentMethod = paymentMethodToDb(trim((string)($body['paymentMethod'] ?? '')));
        $paymentTiming = trim((string)($body['paymentTiming'] ?? ''));
        $paymentDate = trim((string)($body['paymentDate'] ?? ''));
        $shouldFinalizeSale = parseRequestBoolean($body['finalizeSale'] ?? false);

        try {
            $requestedItems = normalizeCreateSaleItems($body);
        } catch (InvalidArgumentException $exception) {
            jsonResponse(['success' => false, 'message' => $exception->getMessage()], 422);
        }

        if ($clientCode === '') {
            jsonResponse(['success' => false, 'message' => 'Preencha o cliente da venda.'], 422);
        }
        if ($requestedItems === []) {
            jsonResponse(['success' => false, 'message' => 'Adicione pelo menos um item na venda.'], 422);
        }
        if (!in_array($deliveryType, ['retirada', 'entrega'], true)) {
            jsonResponse(['success' => false, 'message' => 'Tipo de entrega invalido.'], 422);
        }

        ensureSaleDates($paymentTiming, $paymentDate);

        $clientId = parseCodeToInt($clientCode, 'CLI');
        $paymentStatus = resolveCreatePaymentStatus($paymentTiming);
        if ($paymentStatus === 'Pendente') {
            $paymentMethod = 'Fiado';
        } elseif (paymentMethodIsFiado($paymentMethod)) {
            jsonResponse(['success' => false, 'message' => 'Venda paga precisa de forma de pagamento imediata (Pix, Caju ou Dinheiro).'], 422);
        }
        $storedPaymentDate = resolveSalePaymentDate($paymentStatus, $paymentDate, null);

        $pdo->beginTransaction();
        try {
            $clientStmt = $pdo->prepare('SELECT id FROM clientes WHERE id = :id');
            $clientStmt->execute([':id' => $clientId]);
            if (!$clientStmt->fetch()) {
                throw new RuntimeException('Cliente nao encontrado.');
            }

            $productStmt = $pdo->prepare('SELECT id, nome, preco, estoque FROM produtos WHERE id = :id FOR UPDATE');
            $productsById = [];
            $requestedQuantityByProductId = [];
            $preparedItems = [];

            foreach ($requestedItems as $item) {
                $productCode = trim((string)($item['productCode'] ?? ''));
                $quantity = (int)($item['quantity'] ?? 0);

                if ($productCode === '' || $quantity < 1) {
                    throw new RuntimeException('Cada item da venda precisa de produto e quantidade validos.');
                }

                $productId = parseCodeToInt($productCode, 'PRD');
                if (!isset($productsById[$productId])) {
                    $productStmt->execute([':id' => $productId]);
                    $product = $productStmt->fetch();
                    if (!$product) {
                        throw new RuntimeException('Produto nao encontrado.');
                    }
                    $productsById[$productId] = $product;
                }

                $requestedQuantityByProductId[$productId] = ($requestedQuantityByProductId[$productId] ?? 0) + $quantity;
                $preparedItems[] = [
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'unit_price' => $item['unitPrice'] ?? null,
                ];
            }

            foreach ($requestedQuantityByProductId as $productId => $requestedQuantity) {
                $availableStock = (int)($productsById[$productId]['estoque'] ?? 0);
                if ($requestedQuantity > $availableStock) {
                    throw new RuntimeException('Quantidade nao pode ser maior que o estoque disponivel.');
                }
            }

            $resolvedItems = [];
            $totalAmount = 0.0;
            foreach ($preparedItems as $item) {
                $product = $productsById[$item['product_id']];
                $resolvedUnitPrice = roundMoney(
                    $item['unit_price'] !== null && $item['unit_price'] > 0
                        ? (float)$item['unit_price']
                        : (float)$product['preco']
                );
                if ($resolvedUnitPrice <= 0) {
                    throw new RuntimeException('O produto selecionado nao possui preco valido.');
                }

                $itemTotal = roundMoney($item['quantity'] * $resolvedUnitPrice);
                $totalAmount = roundMoney($totalAmount + $itemTotal);
                $resolvedItems[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $resolvedUnitPrice,
                    'total_amount' => $itemTotal,
                ];
            }

            $dataVenda = (new DateTimeImmutable())->format('Y-m-d H:i:s');

            $saleStmt = $pdo->prepare(
                'INSERT INTO vendas
                    (cliente_id, tipo, forma_pagamento, status_pagamento, status_venda, data_venda, data_pagamento, valor_total, valor_pendente, estoque_movimentado)
                 VALUES
                    (:cliente_id, :tipo, :forma_pagamento, :status_pagamento, :status_venda, :data_venda, :data_pagamento, :valor_total, :valor_pendente, :estoque_movimentado)'
            );
            $saleStmt->execute([
                ':cliente_id' => $clientId,
                ':tipo' => $deliveryType,
                ':forma_pagamento' => $paymentMethod,
                ':status_pagamento' => $paymentStatus,
                ':status_venda' => 'Em preparacao',
                ':data_venda' => $dataVenda,
                ':data_pagamento' => $storedPaymentDate,
                ':valor_total' => $totalAmount,
                ':valor_pendente' => 0.0,
                ':estoque_movimentado' => 0,
            ]);

            $saleId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare(
                'INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, valor_total)
                 VALUES (:venda_id, :produto_id, :quantidade, :preco_unitario, :valor_total)'
            );
            foreach ($resolvedItems as $item) {
                $itemStmt->execute([
                    ':venda_id' => $saleId,
                    ':produto_id' => $item['product_id'],
                    ':quantidade' => $item['quantity'],
                    ':preco_unitario' => $item['unit_price'],
                    ':valor_total' => $item['total_amount'],
                ]);
            }

            if ($shouldFinalizeSale) {
                synchronizeSaleState($pdo, $saleId, [
                    'payment_method' => $paymentMethod,
                    'payment_status' => $paymentStatus,
                    'payment_date' => $storedPaymentDate,
                    'should_finalize' => true,
                ]);
            }

            $pdo->commit();
        } catch (Throwable $txError) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $txError;
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'id' => formatCode('VEN', $saleId),
            ],
        ], 201);
    }

    if ($method === 'DELETE') {
        $saleCode = trim((string)($body['id'] ?? ''));
        if ($saleCode === '') {
            jsonResponse(['success' => false, 'message' => 'Venda nao informada.'], 422);
        }

        $saleId = parseCodeToInt($saleCode, 'VEN');

        $pdo->beginTransaction();
        try {
            $result = deleteSaleWithReversal($pdo, $saleId);
            $pdo->commit();
        } catch (Throwable $txError) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $txError;
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'id' => formatCode('VEN', $saleId),
                'wasFinalized' => (bool)$result['was_finalized'],
                'hadStockMovement' => (bool)$result['had_stock_movement'],
            ],
        ]);
    }

    $saleCode = trim((string)($body['id'] ?? ''));
    $paymentMethod = paymentMethodToDb(trim((string)($body['paymentMethod'] ?? '')));
    $paymentStatus = trim((string)($body['paymentStatus'] ?? ''));
    $shouldFinalizeSale = parseRequestBoolean($body['finalizeSale'] ?? false);

    if ($saleCode === '' || $paymentMethod === '' || $paymentStatus === '') {
        jsonResponse(['success' => false, 'message' => 'Dados de edicao invalidos.'], 422);
    }
    if (!in_array($paymentStatus, ['Pago', 'Pendente'], true)) {
        jsonResponse(['success' => false, 'message' => 'Status do pagamento invalido.'], 422);
    }
    if ($paymentStatus === 'Pendente') {
        $paymentMethod = 'Fiado';
    } elseif (paymentMethodIsFiado($paymentMethod)) {
        jsonResponse(['success' => false, 'message' => 'Venda paga precisa de forma de pagamento imediata (Pix, Caju ou Dinheiro).'], 422);
    }

    $saleId = parseCodeToInt($saleCode, 'VEN');

    $pdo->beginTransaction();
    try {
        synchronizeSaleState($pdo, $saleId, [
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentStatus,
            'payment_date' => $body['paymentDate'] ?? null,
            'should_finalize' => $shouldFinalizeSale,
        ]);
        $pdo->commit();
    } catch (Throwable $txError) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $txError;
    }

    jsonResponse(['success' => true]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
