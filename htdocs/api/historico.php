<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/finance.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

function buildHistorySalePayload(array $row, string $todayIso): array
{
    $totalAmount = roundMoney((float)($row['valor_total'] ?? 0));
    $pendingAmount = roundMoney((float)($row['valor_pendente'] ?? 0));
    $dueDateIso = getSaleDueDateIso($row['data_pagamento'] ?? null, (string)$row['data_venda']);

    return [
        'id' => formatCode('VEN', (int)$row['sale_id']),
        'clientId' => formatCode('CLI', (int)$row['client_id']),
        'clientName' => $row['client_name'],
        'clientPhone' => $row['telefone'],
        'clientEmail' => $row['email'],
        'building' => $row['predio'],
        'floor' => $row['andar'],
        'deliveryType' => $row['tipo'],
        'paymentMethod' => paymentMethodToView((string)$row['forma_pagamento']),
        'paymentStatus' => $row['status_pagamento'],
        'saleStatus' => $row['status_venda'],
        'saleDate' => $row['data_venda'],
        'paymentDate' => $row['data_pagamento'],
        'totalAmount' => $totalAmount,
        'pendingAmount' => $pendingAmount,
        'financialStatus' => resolveFinancialLaunchStatus(
            (string)$row['status_venda'],
            (string)$row['status_pagamento'],
            $totalAmount,
            $pendingAmount,
            $dueDateIso,
            $todayIso
        ),
        'items' => [],
    ];
}

try {
    requireAuthSession(true);
    requireMethod(['GET']);
    $pdo = db();
    ensureFinancialSchema($pdo);
    ensureSalesSchema($pdo);

    $clientCode = trim((string)($_GET['cliente'] ?? $_GET['clientId'] ?? ''));
    $paymentStatus = trim((string)($_GET['status_pagamento'] ?? ''));
    $saleStatus = trim((string)($_GET['status_venda'] ?? ''));
    $startDate = trim((string)($_GET['data_inicio'] ?? ''));
    $endDate = trim((string)($_GET['data_fim'] ?? ''));

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
        WHERE v.status_venda = 'Finalizada'
    ";
    $params = [];

    if ($clientCode !== '') {
        $sql .= ' AND v.cliente_id = :cliente_id';
        $params[':cliente_id'] = parseCodeToInt($clientCode, 'CLI');
    }
    if ($paymentStatus !== '' && $paymentStatus !== 'all') {
        $sql .= ' AND v.status_pagamento = :status_pagamento';
        $params[':status_pagamento'] = $paymentStatus;
    }
    if ($saleStatus !== '' && $saleStatus !== 'all') {
        $sql .= ' AND v.status_venda = :status_venda';
        $params[':status_venda'] = $saleStatus;
    }
    if ($startDate !== '') {
        $sql .= ' AND DATE(v.data_venda) >= :data_inicio';
        $params[':data_inicio'] = $startDate;
    }
    if ($endDate !== '') {
        $sql .= ' AND DATE(v.data_venda) <= :data_fim';
        $params[':data_fim'] = $endDate;
    }

    $sql .= ' ORDER BY v.data_venda DESC, v.id DESC, vi.id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        jsonResponse(['success' => true, 'data' => []]);
    }

    $salesById = [];
    $todayIso = todayYmd();
    foreach ($rows as $row) {
        $saleId = (int)$row['sale_id'];
        if (!isset($salesById[$saleId])) {
            $salesById[$saleId] = buildHistorySalePayload($row, $todayIso);
        }

        $salesById[$saleId]['items'][] = [
            'productId' => formatCode('PRD', (int)$row['produto_id']),
            'productName' => $row['product_name'],
            'quantity' => (int)$row['quantidade'],
            'unitPrice' => roundMoney((float)$row['preco_unitario']),
            'totalAmount' => roundMoney((float)$row['item_total']),
        ];
    }

    jsonResponse(['success' => true, 'data' => array_values($salesById)]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
