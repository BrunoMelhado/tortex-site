<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/finance.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

try {
    requireAuthSession(true);
    $method = requireMethod(['GET', 'POST', 'PUT']);
    $pdo = db();
    ensureFinancialSchema($pdo);
    ensureSalesSchema($pdo);

    if ($method === 'GET') {
        $search = trim((string)($_GET['search'] ?? ''));
        $stock = trim((string)($_GET['stock'] ?? 'all'));
        $status = trim((string)($_GET['status'] ?? 'all'));

        $sql = 'SELECT id, nome, estoque, preco, status FROM produtos WHERE 1=1';
        $params = [];

        if ($search !== '') {
            $sql .= ' AND nome LIKE :nome';
            $params[':nome'] = '%' . $search . '%';
        }
        if ($stock === 'in') {
            $sql .= ' AND estoque > 0';
        } elseif ($stock === 'out') {
            $sql .= ' AND estoque = 0';
        }
        if ($status === 'active' || $status === 'inactive') {
            $sql .= ' AND status = :status';
            $params[':status'] = normalizeStatusToDb($status);
        }

        $sql .= ' ORDER BY id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $products = array_map(static function (array $row): array {
            $price = roundMoney((float)($row['preco'] ?? 0));

            return [
                'id' => formatCode('PRD', (int)$row['id']),
                'name' => $row['nome'],
                'stock' => (int)$row['estoque'],
                'price' => $price,
                'preco' => $price,
                'isActive' => strtolower($row['status']) === 'ativo',
            ];
        }, $rows);

        jsonResponse(['success' => true, 'data' => $products]);
    }

    $body = readJsonBody();

    try {
        $price = parseMoneyValue($body['price'] ?? $body['preco'] ?? 0);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(['success' => false, 'message' => 'Preco do produto invalido.'], 422);
    }

    if ($method === 'POST') {
        $name = trim((string)($body['name'] ?? ''));
        $stock = (int)($body['stock'] ?? -1);
        $isActive = (bool)($body['isActive'] ?? true);

        if ($name === '' || $stock < 0 || $price <= 0) {
            jsonResponse(['success' => false, 'message' => 'Dados do produto invalidos.'], 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO produtos (nome, estoque, preco, status)
             VALUES (:nome, :estoque, :preco, :status)'
        );
        $stmt->execute([
            ':nome' => $name,
            ':estoque' => $stock,
            ':preco' => $price,
            ':status' => $isActive ? 'ativo' : 'inativo',
        ]);

        $newId = (int)$pdo->lastInsertId();
        jsonResponse([
            'success' => true,
            'data' => [
                'id' => formatCode('PRD', $newId),
                'name' => $name,
                'stock' => $stock,
                'price' => $price,
                'preco' => $price,
                'isActive' => $isActive,
            ],
        ], 201);
    }

    $idCode = (string)($body['id'] ?? '');
    $id = parseCodeToInt($idCode, 'PRD');
    $name = trim((string)($body['name'] ?? ''));
    $stock = (int)($body['stock'] ?? -1);
    $isActive = (bool)($body['isActive'] ?? true);

    if ($name === '' || $stock < 0 || $price <= 0) {
        jsonResponse(['success' => false, 'message' => 'Dados do produto invalidos.'], 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE produtos
         SET nome = :nome, estoque = :estoque, preco = :preco, status = :status
         WHERE id = :id'
    );
    $stmt->execute([
        ':nome' => $name,
        ':estoque' => $stock,
        ':preco' => $price,
        ':status' => $isActive ? 'ativo' : 'inativo',
        ':id' => $id,
    ]);

    jsonResponse([
        'success' => true,
        'data' => [
            'id' => formatCode('PRD', $id),
            'name' => $name,
            'stock' => $stock,
            'price' => $price,
            'preco' => $price,
            'isActive' => $isActive,
        ],
    ]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
