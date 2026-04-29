<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../auth_check.php';

try {
    requireAuthSession(true);
    requireMethod(['GET']);
    $pdo = db();

    $tables = ['clientes', 'produtos', 'vendas', 'venda_itens'];
    $status = [];

    foreach ($tables as $table) {
        $stmt = $pdo->query("SELECT COUNT(*) AS total FROM {$table}");
        $row = $stmt->fetch();
        $status[$table] = (int)($row['total'] ?? 0);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Conexao com banco OK.',
        'data' => [
            'database' => 'if0_41280861_db_tortas',
            'tables' => $status,
        ],
    ]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
