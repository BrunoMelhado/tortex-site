<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/finance.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

function buildFinanceClientPayload(array $row): array
{
    $balanceDue = roundMoney((float)$row['saldo_devendo']);

    return [
        'clientId' => formatCode('CLI', (int)$row['id']),
        'clientName' => $row['nome'],
        'phone' => $row['telefone'],
        'email' => $row['email'],
        'building' => $row['predio'],
        'floor' => $row['andar'],
        'balanceDue' => $balanceDue,
        'saldo_devendo' => $balanceDue,
        'pendingSalesCount' => 0,
        'overdueSalesCount' => 0,
        'nextDueDate' => '',
        'pendingSales' => [],
    ];
}

function isOverdueFinanceDate(string $dateIso, string $todayIso): bool
{
    return $dateIso !== '' && $dateIso < $todayIso;
}

try {
    requireAuthSession(true);
    $method = requireMethod(['GET', 'POST']);
    $pdo = db();
    ensureFinancialSchema($pdo);
    ensureSalesSchema($pdo);

    if ($method === 'GET') {
        $clientsStmt = $pdo->query(
            'SELECT id, nome, telefone, email, predio, andar, saldo_devendo
             FROM clientes
             WHERE saldo_devendo > 0
             ORDER BY nome ASC'
        );
        $clientRows = $clientsStmt->fetchAll();

        $clientsById = [];
        foreach ($clientRows as $row) {
            $clientsById[(int)$row['id']] = buildFinanceClientPayload($row);
        }

        if ($clientsById) {
            $salesStmt = $pdo->query(
                'SELECT id, cliente_id, forma_pagamento, status_pagamento, status_venda, data_venda, data_pagamento, valor_total, valor_pendente
                 FROM vendas
                 WHERE status_venda = \'Finalizada\'
                   AND valor_pendente > 0
                 ORDER BY cliente_id ASC, COALESCE(data_pagamento, DATE(data_venda)) ASC, id ASC'
            );
            $saleRows = $salesStmt->fetchAll();

            $todayIso = todayYmd();
            foreach ($saleRows as $row) {
                $clientId = (int)$row['cliente_id'];
                if (!isset($clientsById[$clientId])) {
                    continue;
                }

                $dueDate = getSaleDueDateIso($row['data_pagamento'] ?? null, (string)$row['data_venda']);
                $pendingAmount = roundMoney((float)$row['valor_pendente']);
                $totalAmount = roundMoney((float)$row['valor_total']);
                $paidAmount = roundMoney(max(0.0, $totalAmount - $pendingAmount));
                $financialStatus = resolveFinancialLaunchStatus(
                    (string)$row['status_venda'],
                    (string)$row['status_pagamento'],
                    $totalAmount,
                    $pendingAmount,
                    $dueDate,
                    $todayIso
                );

                $clientsById[$clientId]['pendingSales'][] = [
                    'saleId' => formatCode('VEN', (int)$row['id']),
                    'saleDate' => $row['data_venda'],
                    'paymentDate' => $row['data_pagamento'],
                    'dueDate' => $dueDate,
                    'paymentMethod' => paymentMethodToView((string)$row['forma_pagamento']),
                    'paymentStatus' => $row['status_pagamento'],
                    'saleStatus' => $row['status_venda'],
                    'totalAmount' => $totalAmount,
                    'paidAmount' => $paidAmount,
                    'remainingAmount' => $pendingAmount,
                    'pendingAmount' => $pendingAmount,
                    'financialStatus' => $financialStatus,
                ];

                $clientsById[$clientId]['pendingSalesCount']++;
                if ($clientsById[$clientId]['nextDueDate'] === '' || ($dueDate !== '' && $dueDate < $clientsById[$clientId]['nextDueDate'])) {
                    $clientsById[$clientId]['nextDueDate'] = $dueDate;
                }
                if (isOverdueFinanceDate($dueDate, $todayIso)) {
                    $clientsById[$clientId]['overdueSalesCount']++;
                }
            }

        }

        $clients = array_values($clientsById);
        usort(
            $clients,
            static fn (array $left, array $right): int => $right['balanceDue'] <=> $left['balanceDue']
                ?: $left['clientName'] <=> $right['clientName']
        );

        $summary = [
            'totalReceivable' => 0.0,
            'debtorCount' => count($clients),
            'pendingSalesCount' => 0,
            'overdueCount' => 0,
            'overdueAmount' => 0.0,
        ];

        $todayIso = todayYmd();
        foreach ($clients as $client) {
            $summary['totalReceivable'] = roundMoney($summary['totalReceivable'] + (float)$client['balanceDue']);
            $summary['pendingSalesCount'] += (int)$client['pendingSalesCount'];
            $summary['overdueCount'] += (int)$client['overdueSalesCount'];

            foreach ($client['pendingSales'] as $sale) {
                if (isOverdueFinanceDate((string)$sale['dueDate'], $todayIso)) {
                    $summary['overdueAmount'] = roundMoney($summary['overdueAmount'] + (float)$sale['pendingAmount']);
                }
            }
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'clients' => $clients,
            ],
        ]);
    }

    $body = readJsonBody();
    $clientCode = trim((string)($body['clientId'] ?? ''));
    $saleCode = trim((string)($body['saleId'] ?? ''));
    $paymentMethod = paymentMethodToDb(trim((string)($body['paymentMethod'] ?? '')));
    $note = trim((string)($body['note'] ?? ''));

    try {
        $amount = parseMoneyValue($body['amount'] ?? 0);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(['success' => false, 'message' => 'Valor do pagamento invalido.'], 422);
    }

    if ($clientCode === '' || $paymentMethod === '' || $amount <= 0) {
        jsonResponse(['success' => false, 'message' => 'Informe cliente, forma de pagamento e valor do pagamento.'], 422);
    }
    if (paymentMethodIsFiado($paymentMethod)) {
        jsonResponse(['success' => false, 'message' => 'Pagamento deve usar Pix, Caju ou Dinheiro.'], 422);
    }

    $clientId = parseCodeToInt($clientCode, 'CLI');
    $saleId = $saleCode !== '' ? parseCodeToInt($saleCode, 'VEN') : null;

    $pdo->beginTransaction();
    try {
        $clientStmt = $pdo->prepare('SELECT id, nome, saldo_devendo FROM clientes WHERE id = :id FOR UPDATE');
        $clientStmt->execute([':id' => $clientId]);
        $client = $clientStmt->fetch();

        if (!$client) {
            throw new RuntimeException('Cliente nao encontrado.');
        }

        $balanceBefore = roundMoney((float)$client['saldo_devendo']);
        if ($balanceBefore <= 0) {
            throw new RuntimeException('Este cliente nao possui saldo pendente.');
        }
        if ($amount > $balanceBefore + 0.009) {
            throw new RuntimeException('O valor informado excede o saldo pendente do cliente.');
        }

        if ($saleId !== null) {
            $salesStmt = $pdo->prepare(
                'SELECT id, valor_pendente, data_pagamento
                 FROM vendas
                 WHERE id = :sale_id
                   AND cliente_id = :cliente_id
                   AND status_venda = \'Finalizada\'
                   AND valor_pendente > 0
                 FOR UPDATE'
            );
            $salesStmt->execute([
                ':sale_id' => $saleId,
                ':cliente_id' => $clientId,
            ]);
            $pendingSales = $salesStmt->fetchAll();

            if (!$pendingSales) {
                throw new RuntimeException('A venda informada nao possui saldo pendente.');
            }

            $salePendingAmount = roundMoney((float)$pendingSales[0]['valor_pendente']);
            if ($amount > $salePendingAmount + 0.009) {
                throw new RuntimeException('O valor informado excede o saldo pendente desta venda.');
            }
        } else {
            $salesStmt = $pdo->prepare(
                'SELECT id, valor_pendente, data_pagamento
                 FROM vendas
                 WHERE cliente_id = :cliente_id
                   AND status_venda = \'Finalizada\'
                   AND valor_pendente > 0
                 ORDER BY COALESCE(data_pagamento, DATE(data_venda)) ASC, id ASC
                 FOR UPDATE'
            );
            $salesStmt->execute([':cliente_id' => $clientId]);
            $pendingSales = $salesStmt->fetchAll();
        }

        if (!$pendingSales) {
            throw new RuntimeException('Nao ha vendas pendentes para este cliente.');
        }

        $remainingAmount = $amount;
        $runningBalanceBefore = $balanceBefore;
        $paymentDate = (new DateTimeImmutable('today'))->format('Y-m-d');
        $appliedSales = [];

        foreach ($pendingSales as $sale) {
            if ($remainingAmount <= 0) {
                break;
            }

            $currentPending = roundMoney((float)$sale['valor_pendente']);
            $appliedAmount = roundMoney(min($remainingAmount, $currentPending));
            if ($appliedAmount <= 0) {
                continue;
            }

            $newPendingAmount = roundMoney($currentPending - $appliedAmount);
            $remainingAmount = roundMoney($remainingAmount - $appliedAmount);
            $runningBalanceAfter = roundMoney(max(0.0, $runningBalanceBefore - $appliedAmount));

            $updateSaleStmt = $pdo->prepare(
                'UPDATE vendas
                 SET valor_pendente = :valor_pendente,
                     status_pagamento = :status_pagamento,
                     data_pagamento = :data_pagamento
                 WHERE id = :id'
            );
            $updateSaleStmt->execute([
                ':valor_pendente' => $newPendingAmount,
                ':status_pagamento' => $newPendingAmount <= 0 ? 'Pago' : 'Pendente',
                ':data_pagamento' => $newPendingAmount <= 0 ? $paymentDate : $sale['data_pagamento'],
                ':id' => (int)$sale['id'],
            ]);

            registerFinancialTransaction($pdo, [
                'client_id' => $clientId,
                'sale_id' => (int)$sale['id'],
                'type' => 'pagamento_manual',
                'amount' => $appliedAmount,
                'balance_before' => $runningBalanceBefore,
                'balance_after' => $runningBalanceAfter,
                'payment_method' => $paymentMethod,
                'description' => sprintf('Pagamento manual registrado para a venda %s.', formatCode('VEN', (int)$sale['id'])),
                'note' => $note !== '' ? $note : null,
            ]);

            $appliedSales[] = [
                'saleId' => formatCode('VEN', (int)$sale['id']),
                'amountPaid' => $appliedAmount,
                'remainingPendingAmount' => $newPendingAmount,
            ];
            $runningBalanceBefore = $runningBalanceAfter;
        }

        if ($remainingAmount > 0.009) {
            throw new RuntimeException('Nao foi possivel alocar o pagamento integralmente.');
        }

        $balanceAfter = roundMoney(max(0.0, $balanceBefore - $amount));
        $updateClientStmt = $pdo->prepare('UPDATE clientes SET saldo_devendo = :saldo_devendo WHERE id = :id');
        $updateClientStmt->execute([
            ':saldo_devendo' => $balanceAfter,
            ':id' => $clientId,
        ]);

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
            'clientId' => formatCode('CLI', $clientId),
            'saleId' => $saleId !== null ? formatCode('VEN', $saleId) : null,
            'amountPaid' => $amount,
            'remainingBalance' => $balanceAfter,
            'appliedSales' => $appliedSales,
        ],
    ]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
