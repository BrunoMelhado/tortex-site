<?php
declare(strict_types=1);

/**
 * Exemplo de conexao PDO reutilizavel.
 *
 * Copie este arquivo para `database.php` e ajuste as variaveis de ambiente
 * ou substitua os valores padrao conforme o seu ambiente local.
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('DB_HOST') ?: 'localhost';
    $port = (int)(getenv('DB_PORT') ?: 3306);
    $database = getenv('DB_NAME') ?: 'nome_do_banco';
    $username = getenv('DB_USER') ?: 'usuario_do_banco';
    $password = getenv('DB_PASSWORD') ?: '';

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $database);

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $pdo = new PDO($dsn, $username, $password, $options);
    return $pdo;
}

