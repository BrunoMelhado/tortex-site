<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

try {
    requireAuthSession(true);
    requireMethod(['GET']);
    $pdo = db();
    ensureSalesSchema($pdo);

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');

    $salesDayStmt = $pdo->prepare(
        "SELECT COUNT(*) AS total
         FROM vendas
         WHERE status_venda = 'Finalizada'
           AND DATE(data_venda) = :today"
    );
    $salesDayStmt->execute([':today' => $today]);
    $salesDay = (int)$salesDayStmt->fetch()['total'];

    $pendingStmt = $pdo->query("SELECT COUNT(*) AS total FROM vendas WHERE status_venda <> 'Finalizada'");
    $pendingSales = (int)$pendingStmt->fetch()['total'];

    $stockStmt = $pdo->query('SELECT COALESCE(SUM(estoque), 0) AS total FROM produtos');
    $stockTotal = (int)$stockStmt->fetch()['total'];

    $ordersStmt = $pdo->query(
        "SELECT
            v.id,
            c.nome AS customer,
            v.status_venda,
            TIMESTAMPDIFF(MINUTE, v.data_venda, NOW()) AS elapsed_minutes
         FROM vendas v
         INNER JOIN clientes c ON c.id = v.cliente_id
         WHERE v.status_venda <> 'Finalizada'
         ORDER BY v.id DESC
         LIMIT 5"
    );
    $ordersRows = $ordersStmt->fetchAll();

    $statusMap = [
        'Em preparacao' => 'Pendente',
        'Em andamento' => 'Preparando',
        'Finalizada' => 'Finalizado',
    ];

    $orders = array_map(static function (array $row) use ($statusMap): array {
        $status = $statusMap[$row['status_venda']] ?? 'Pendente';
        $elapsed = max(0, (int)$row['elapsed_minutes']);
        $saleCode = formatCode('VEN', (int)$row['id']);
        return [
            'id' => '#' . $saleCode,
            'saleId' => $saleCode,
            'customer' => $row['customer'],
            'status' => $status,
            'elapsedTime' => 'ha ' . $elapsed . ' min',
        ];
    }, $ordersRows);

    $metrics = [
        [
            'id' => 'sales-day',
            'label' => 'Total Vendas Dia',
            'value' => (string)$salesDay,
            'type' => 'highlight',
        ],
        [
            'id' => 'orders-pending',
            'label' => 'Pedidos Pendentes',
            'value' => (string)$pendingSales,
            'type' => 'warning',
            'badge' => $pendingSales > 0 ? 'Atencao' : 'Ok',
        ],
        [
            'id' => 'stock-current',
            'label' => 'Estoque Atual',
            'value' => $stockTotal . ' itens',
            'type' => 'default',
        ],
    ];

    jsonResponse([
        'success' => true,
        'data' => [
            'metrics' => $metrics,
            'orders' => $orders,
        ],
    ]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
