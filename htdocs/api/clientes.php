<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/finance.php';
require_once __DIR__ . '/../config/sales.php';
require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../auth_check.php';

function mapClientRow(array $row): array
{
    $balanceDue = roundMoney((float)($row['saldo_devendo'] ?? 0));

    return [
        'id' => formatCode('CLI', (int)$row['id']),
        'name' => $row['nome'],
        'phone' => $row['telefone'],
        'email' => $row['email'],
        'building' => $row['predio'],
        'floor' => $row['andar'],
        'status' => normalizeStatusToFront($row['status']),
        'balanceDue' => $balanceDue,
        'saldo_devendo' => $balanceDue,
    ];
}

function clientHasBlockingDebt(PDO $pdo, int $clientId): bool
{
    $balanceStmt = $pdo->prepare('SELECT saldo_devendo FROM clientes WHERE id = :id FOR UPDATE');
    $balanceStmt->execute([':id' => $clientId]);
    $row = $balanceStmt->fetch();
    $balanceDue = roundMoney((float)($row['saldo_devendo'] ?? 0));
    if ($balanceDue > 0) {
        return true;
    }

    $pendingStmt = $pdo->prepare(
        "SELECT COUNT(*) AS total
         FROM vendas
         WHERE cliente_id = :id
           AND (status_pagamento = 'Pendente' OR valor_pendente > 0)"
    );
    $pendingStmt->execute([':id' => $clientId]);
    return (int)($pendingStmt->fetch()['total'] ?? 0) > 0;
}

function deleteClientRelations(PDO $pdo, int $clientId): void
{
    $salesStmt = $pdo->prepare('SELECT id FROM vendas WHERE cliente_id = :id ORDER BY id DESC');
    $salesStmt->execute([':id' => $clientId]);
    $saleIds = $salesStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    foreach ($saleIds as $saleId) {
        deleteSaleWithReversal($pdo, (int)$saleId);
    }

    $deleteTransactionsStmt = $pdo->prepare('DELETE FROM transacoes_financeiras WHERE cliente_id = :id');
    $deleteTransactionsStmt->execute([':id' => $clientId]);
}

try {
    requireAuthSession(true);
    $method = requireMethod(['GET', 'POST', 'PUT', 'DELETE']);
    $pdo = db();
    ensureFinancialSchema($pdo);
    ensureSalesSchema($pdo);

    if ($method === 'GET') {
        $name = trim((string)($_GET['name'] ?? ''));
        $phone = trim((string)($_GET['phone'] ?? ''));
        $status = trim((string)($_GET['status'] ?? 'all'));

        $sql = 'SELECT id, nome, telefone, email, predio, andar, status, saldo_devendo FROM clientes WHERE 1=1';
        $params = [];

        if ($name !== '') {
            $sql .= ' AND nome LIKE :nome';
            $params[':nome'] = '%' . $name . '%';
        }
        if ($phone !== '') {
            $sql .= ' AND telefone LIKE :telefone';
            $params[':telefone'] = '%' . $phone . '%';
        }
        if ($status === 'active' || $status === 'inactive') {
            $sql .= ' AND status = :status';
            $params[':status'] = normalizeStatusToDb($status);
        }

        $sql .= ' ORDER BY id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $clients = array_map(static fn (array $row): array => mapClientRow($row), $rows);

        jsonResponse(['success' => true, 'data' => $clients]);
    }

    $body = readJsonBody();

    if ($method === 'POST') {
        $name = trim((string)($body['name'] ?? ''));
        $phone = trim((string)($body['phone'] ?? ''));
        $email = trim((string)($body['email'] ?? ''));
        $building = trim((string)($body['building'] ?? ''));
        $floor = trim((string)($body['floor'] ?? ''));
        $status = trim((string)($body['status'] ?? 'active'));

        if ($name === '' || $phone === '' || $email === '' || $building === '' || $floor === '') {
            jsonResponse(['success' => false, 'message' => 'Campos obrigatorios nao preenchidos.'], 422);
        }

        $dup = $pdo->prepare('SELECT id FROM clientes WHERE nome = :nome OR telefone = :telefone OR email = :email LIMIT 1');
        $dup->execute([':nome' => $name, ':telefone' => $phone, ':email' => $email]);
        if ($dup->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Nome, telefone ou email ja cadastrado.'], 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO clientes (nome, telefone, email, predio, andar, status)
             VALUES (:nome, :telefone, :email, :predio, :andar, :status)'
        );
        $stmt->execute([
            ':nome' => $name,
            ':telefone' => $phone,
            ':email' => $email,
            ':predio' => $building,
            ':andar' => $floor,
            ':status' => normalizeStatusToDb($status),
        ]);

        $newId = (int)$pdo->lastInsertId();
        jsonResponse([
            'success' => true,
            'data' => [
                'id' => formatCode('CLI', $newId),
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'building' => $building,
                'floor' => $floor,
                'status' => $status === 'inactive' ? 'inactive' : 'active',
                'balanceDue' => 0.0,
                'saldo_devendo' => 0.0,
            ],
        ], 201);
    }

    if ($method === 'DELETE') {
        $idCode = trim((string)($body['id'] ?? ''));
        if ($idCode === '') {
            jsonResponse(['success' => false, 'message' => 'Cliente nao informado.'], 422);
        }

        try {
            $id = parseCodeToInt($idCode, 'CLI');
        } catch (Throwable $exception) {
            jsonResponse(['success' => false, 'message' => 'Codigo de cliente invalido.'], 422);
        }

        $pdo->beginTransaction();
        try {
            $clientStmt = $pdo->prepare('SELECT id FROM clientes WHERE id = :id FOR UPDATE');
            $clientStmt->execute([':id' => $id]);
            if (!$clientStmt->fetch()) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                jsonResponse(['success' => false, 'message' => 'Cliente nao encontrado.'], 404);
            }

            if (clientHasBlockingDebt($pdo, $id)) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                jsonResponse(
                    ['success' => false, 'message' => 'Este cliente nao pode ser excluido porque possui dividas vinculadas a conta.'],
                    409
                );
            }

            deleteClientRelations($pdo, $id);

            $deleteClientStmt = $pdo->prepare('DELETE FROM clientes WHERE id = :id');
            $deleteClientStmt->execute([':id' => $id]);
            syncClientOutstandingBalances($pdo);
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
                'id' => formatCode('CLI', $id),
            ],
        ]);
    }

    $idCode = (string)($body['id'] ?? '');
    $id = parseCodeToInt($idCode, 'CLI');
    $name = trim((string)($body['name'] ?? ''));
    $phone = trim((string)($body['phone'] ?? ''));
    $email = trim((string)($body['email'] ?? ''));
    $building = trim((string)($body['building'] ?? ''));
    $floor = trim((string)($body['floor'] ?? ''));
    $status = trim((string)($body['status'] ?? 'active'));

    if ($name === '' || $phone === '' || $email === '' || $building === '' || $floor === '') {
        jsonResponse(['success' => false, 'message' => 'Campos obrigatorios nao preenchidos.'], 422);
    }

    $dup = $pdo->prepare(
        'SELECT id FROM clientes
         WHERE (nome = :nome OR telefone = :telefone OR email = :email)
           AND id <> :id
         LIMIT 1'
    );
    $dup->execute([
        ':nome' => $name,
        ':telefone' => $phone,
        ':email' => $email,
        ':id' => $id,
    ]);
    if ($dup->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Nome, telefone ou email ja cadastrado.'], 409);
    }

    $stmt = $pdo->prepare(
        'UPDATE clientes
         SET nome = :nome, telefone = :telefone, email = :email, predio = :predio, andar = :andar, status = :status
         WHERE id = :id'
    );
    $stmt->execute([
        ':nome' => $name,
        ':telefone' => $phone,
        ':email' => $email,
        ':predio' => $building,
        ':andar' => $floor,
        ':status' => normalizeStatusToDb($status),
        ':id' => $id,
    ]);

    $balanceStmt = $pdo->prepare('SELECT saldo_devendo FROM clientes WHERE id = :id');
    $balanceStmt->execute([':id' => $id]);
    $balanceDue = roundMoney((float)($balanceStmt->fetch()['saldo_devendo'] ?? 0));

    jsonResponse([
        'success' => true,
        'data' => [
            'id' => formatCode('CLI', $id),
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
            'building' => $building,
            'floor' => $floor,
            'status' => $status === 'inactive' ? 'inactive' : 'active',
            'balanceDue' => $balanceDue,
            'saldo_devendo' => $balanceDue,
        ],
    ]);
} catch (Throwable $exception) {
    handleApiException($exception);
}
