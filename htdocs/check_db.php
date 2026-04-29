<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

try {
    $pdo = db();

    echo "=== VERIFICAÇÃO DA ESTRUTURA DO BANCO DE DADOS ===\n\n";

    // Verificar tabela clientes
    echo "1. TABELA CLIENTES:\n";
    $stmt = $pdo->query("DESCRIBE clientes");
    $columns = $stmt->fetchAll();

    $hasSaldoDevendo = false;
    foreach ($columns as $col) {
        echo "   - " . $col['Field'] . " (" . $col['Type'] . ")\n";
        if ($col['Field'] === 'saldo_devendo') {
            $hasSaldoDevendo = true;
        }
    }

    if ($hasSaldoDevendo) {
        echo "   ✅ Coluna 'saldo_devendo' existe!\n";
    } else {
        echo "   ❌ Coluna 'saldo_devendo' NÃO existe!\n";
    }

    echo "\n";

    // Verificar tabela transacoes_financeiras
    echo "2. TABELA TRANSACOES_FINANCEIRAS:\n";
    try {
        $stmt = $pdo->query("DESCRIBE transacoes_financeiras");
        $columns = $stmt->fetchAll();

        echo "   ✅ Tabela existe!\n";
        foreach ($columns as $col) {
            echo "   - " . $col['Field'] . " (" . $col['Type'] . ")\n";
        }
    } catch (Exception $e) {
        echo "   ❌ Tabela NÃO existe! Erro: " . $e->getMessage() . "\n";
    }

    echo "\n";

    // Verificar dados de exemplo
    echo "3. DADOS DE TESTE:\n";

    // Contar clientes
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM clientes");
    $result = $stmt->fetch();
    echo "   - Total de clientes: " . $result['total'] . "\n";

    // Verificar se algum cliente tem saldo_devendo > 0
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM clientes WHERE saldo_devendo > 0");
    $result = $stmt->fetch();
    echo "   - Clientes com saldo devendo: " . $result['total'] . "\n";

    // Contar transações
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM transacoes_financeiras");
        $result = $stmt->fetch();
        echo "   - Total de transações financeiras: " . $result['total'] . "\n";
    } catch (Exception $e) {
        echo "   - Tabela transacoes_financeiras não existe ainda\n";
    }

    echo "\n=== VERIFICAÇÃO CONCLUÍDA ===";

} catch (Exception $e) {
    echo "ERRO ao conectar/verificar banco: " . $e->getMessage();
}
?>