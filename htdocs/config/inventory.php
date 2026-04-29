<?php
declare(strict_types=1);

function getSaleItemsForInventoryUpdate(PDO $pdo, int $saleId): array
{
    $stmt = $pdo->prepare(
        'SELECT
            vi.produto_id,
            vi.quantidade,
            p.nome AS produto_nome,
            p.estoque
         FROM venda_itens vi
         INNER JOIN produtos p ON p.id = vi.produto_id
         WHERE vi.venda_id = :sale_id
         ORDER BY vi.id ASC
         FOR UPDATE'
    );
    $stmt->execute([':sale_id' => $saleId]);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        throw new RuntimeException('A venda nao possui itens para movimentar estoque.');
    }

    $itemsByProduct = [];
    foreach ($rows as $row) {
        $productId = (int)$row['produto_id'];
        if (!isset($itemsByProduct[$productId])) {
            $itemsByProduct[$productId] = [
                'product_id' => $productId,
                'product_name' => $row['produto_nome'],
                'quantity' => 0,
                'stock' => (int)$row['estoque'],
            ];
        }

        $itemsByProduct[$productId]['quantity'] += (int)$row['quantidade'];
    }

    return array_values($itemsByProduct);
}

function updateSaleInventory(PDO $pdo, int $saleId, int $direction): void
{
    if (!in_array($direction, [-1, 1], true)) {
        throw new InvalidArgumentException('Direcao de estoque invalida.');
    }

    $items = getSaleItemsForInventoryUpdate($pdo, $saleId);
    $updateStmt = $pdo->prepare('UPDATE produtos SET estoque = :estoque WHERE id = :id');

    foreach ($items as $item) {
        $currentStock = (int)$item['stock'];
        $quantity = (int)$item['quantity'];
        $nextStock = $direction === -1
            ? $currentStock - $quantity
            : $currentStock + $quantity;

        if ($direction === -1 && $nextStock < 0) {
            throw new RuntimeException(
                sprintf('Estoque insuficiente para finalizar a venda. Produto: %s.', $item['product_name'])
            );
        }

        $updateStmt->execute([
            ':estoque' => $nextStock,
            ':id' => (int)$item['product_id'],
        ]);
    }
}
