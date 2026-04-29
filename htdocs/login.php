<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/http.php';
require_once __DIR__ . '/auth_check.php';

const AUTH_DEFAULT_ADMIN_NAME = 'admin';
const AUTH_DEFAULT_ADMIN_EMAIL = 'admin@empresa.com';
const AUTH_DEFAULT_ADMIN_PASSWORD = 'admin321';

function safeTruncate(string $value, int $maxLength): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength);
    }
    return substr($value, 0, $maxLength);
}

function stringContains(string $value, string $needle): bool
{
    if (function_exists('str_contains')) {
        return str_contains($value, $needle);
    }

    if ($needle === '') {
        return true;
    }

    return strpos($value, $needle) !== false;
}

function isUnknownColumnError(PDOException $exception): bool
{
    return stringContains(strtolower($exception->getMessage()), 'unknown column');
}

function safeHashEquals(string $knownString, string $userString): bool
{
    if (function_exists('hash_equals')) {
        return hash_equals($knownString, $userString);
    }

    $knownLength = strlen($knownString);
    if ($knownLength !== strlen($userString)) {
        return false;
    }

    $result = 0;
    for ($i = 0; $i < $knownLength; $i++) {
        $result |= ord($knownString[$i]) ^ ord($userString[$i]);
    }

    return $result === 0;
}

function authLog(string $stage, array $context = [], ?Throwable $exception = null): void
{
    $payload = [
        'stage' => $stage,
        'time' => date('c'),
        'ip' => (string)($_SERVER['REMOTE_ADDR'] ?? ''),
    ];

    foreach ($context as $key => $value) {
        $payload[(string)$key] = $value;
    }

    if ($exception !== null) {
        $payload['error'] = $exception->getMessage();
        $payload['error_code'] = $exception->getCode();
    }

    error_log('[auth] ' . json_encode($payload, JSON_UNESCAPED_UNICODE));
}

function ensureUsersTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS usuarios (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL,
            senha VARCHAR(255) NOT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_usuarios_email (email),
            KEY idx_usuarios_nome (nome),
            KEY idx_usuarios_ativo (ativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ensureDefaultAdminUser(PDO $pdo): void
{
    $params = [
        ':email' => AUTH_DEFAULT_ADMIN_EMAIL,
        ':nome' => AUTH_DEFAULT_ADMIN_NAME,
        ':senha' => password_hash(AUTH_DEFAULT_ADMIN_PASSWORD, PASSWORD_DEFAULT),
    ];

    $schemaVariants = [
        [
            'name' => 'nome',
            'check_sql' => 'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) OR LOWER(nome) = LOWER(:nome) LIMIT 1',
            'insert_sql' => 'INSERT INTO usuarios (nome, email, senha, ativo) VALUES (:nome, :email, :senha, 1)',
        ],
        [
            'name' => 'usuario',
            'check_sql' => 'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) OR LOWER(usuario) = LOWER(:nome) LIMIT 1',
            'insert_sql' => 'INSERT INTO usuarios (usuario, email, senha, ativo) VALUES (:nome, :email, :senha, 1)',
        ],
    ];

    foreach ($schemaVariants as $variant) {
        try {
            $checkStmt = $pdo->prepare($variant['check_sql']);
            $checkStmt->execute([
                ':email' => $params[':email'],
                ':nome' => $params[':nome'],
            ]);

            if ($checkStmt->fetch()) {
                return;
            }

            $insertStmt = $pdo->prepare($variant['insert_sql']);
            $insertStmt->execute($params);
            authLog('default_admin_seeded', ['schema_variant' => $variant['name']]);
            return;
        } catch (PDOException $exception) {
            if (isUnknownColumnError($exception)) {
                continue;
            }
            throw $exception;
        }
    }

    authLog('default_admin_seed_skipped', ['reason' => 'schema_incompatibility']);
}

function findAuthUser(PDO $pdo, string $login): ?array
{
    $schemaVariants = [
        [
            'name' => 'nome_ativo',
            'sql' => 'SELECT id, nome AS nome, email, senha, ativo AS ativo
                      FROM usuarios
                      WHERE LOWER(email) = LOWER(:login_email) OR LOWER(nome) = LOWER(:login_name)
                      LIMIT 1',
        ],
        [
            'name' => 'usuario_ativo',
            'sql' => 'SELECT id, usuario AS nome, email, senha, ativo AS ativo
                      FROM usuarios
                      WHERE LOWER(email) = LOWER(:login_email) OR LOWER(usuario) = LOWER(:login_name)
                      LIMIT 1',
        ],
        [
            'name' => 'nome_sem_ativo',
            'sql' => 'SELECT id, nome AS nome, email, senha, 1 AS ativo
                      FROM usuarios
                      WHERE LOWER(email) = LOWER(:login_email) OR LOWER(nome) = LOWER(:login_name)
                      LIMIT 1',
        ],
        [
            'name' => 'usuario_sem_ativo',
            'sql' => 'SELECT id, usuario AS nome, email, senha, 1 AS ativo
                      FROM usuarios
                      WHERE LOWER(email) = LOWER(:login_email) OR LOWER(usuario) = LOWER(:login_name)
                      LIMIT 1',
        ],
    ];

    foreach ($schemaVariants as $variant) {
        try {
            $stmt = $pdo->prepare($variant['sql']);
            $stmt->execute([
                ':login_email' => $login,
                ':login_name' => $login,
            ]);
            $user = $stmt->fetch();

            if ($user) {
                return $user;
            }
        } catch (PDOException $exception) {
            if (isUnknownColumnError($exception)) {
                continue;
            }
            throw $exception;
        }
    }

    return null;
}

function isPasswordHash(string $storedPassword): bool
{
    if ($storedPassword === '') {
        return false;
    }

    if (!function_exists('password_get_info')) {
        return preg_match('/^\$2[aby]\$|^\$argon2/i', $storedPassword) === 1;
    }

    $info = password_get_info($storedPassword);
    return !empty($info['algo']);
}

function verifyUserPassword(string $plainPassword, string $storedPassword): bool
{
    if ($storedPassword === '') {
        return false;
    }

    if (isPasswordHash($storedPassword) && function_exists('password_verify')) {
        return password_verify($plainPassword, $storedPassword);
    }

    return safeHashEquals($storedPassword, $plainPassword);
}

function upgradeUserPasswordHashIfNeeded(PDO $pdo, array $user, string $plainPassword): void
{
    $storedPassword = (string)($user['senha'] ?? '');
    if (isPasswordHash($storedPassword)) {
        return;
    }

    if (!safeHashEquals($storedPassword, $plainPassword)) {
        return;
    }

    if (!function_exists('password_hash')) {
        return;
    }

    $hashedPassword = password_hash($plainPassword, PASSWORD_DEFAULT);
    if ($hashedPassword === false) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE usuarios SET senha = :senha WHERE id = :id LIMIT 1');
    $stmt->execute([
        ':senha' => $hashedPassword,
        ':id' => (int)($user['id'] ?? 0),
    ]);
}

$loginForLog = '';

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        if (currentAuthUser() !== null) {
            header('Location: ./index.php?view=dashboard');
            exit;
        }

        readfile(__DIR__ . '/login.html');
        exit;
    }

    requireMethod(['POST']);
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    $body = stringContains($contentType, 'application/json') ? readJsonBody() : [];

    $rawLogin = (string)($body['login'] ?? ($_POST['login'] ?? ''));
    $rawPassword = (string)($body['password'] ?? ($_POST['password'] ?? ''));

    $login = safeTruncate(trim(strip_tags($rawLogin)), 150);
    $loginForLog = $login;
    $password = $rawPassword;

    if ($login === '' || trim($password) === '') {
        authLog('login_validation_failed', ['reason' => 'empty_fields']);
        jsonResponse(['success' => false, 'message' => 'Preencha login e senha.'], 422);
    }

    $pdo = db();
    try {
        ensureUsersTable($pdo);
    } catch (Throwable $exception) {
        authLog('ensure_users_table_failed', [], $exception);
    }

    try {
        ensureDefaultAdminUser($pdo);
    } catch (Throwable $exception) {
        authLog('ensure_default_admin_failed', [], $exception);
    }

    $user = findAuthUser($pdo, $login);

    if (!$user || (int)$user['ativo'] !== 1) {
        authLog('login_rejected', [
            'reason' => !$user ? 'user_not_found' : 'inactive_user',
            'login' => $loginForLog,
        ]);
        jsonResponse(['success' => false, 'message' => 'Usuario invalido. Verifique o login informado.'], 401);
    }

    $passwordIsValid = false;
    try {
        $passwordIsValid = verifyUserPassword($password, (string)$user['senha']);
    } catch (Throwable $exception) {
        authLog('password_verification_failed', ['login' => $loginForLog], $exception);
    }

    if (!$passwordIsValid) {
        authLog('login_rejected', ['reason' => 'invalid_password', 'login' => $loginForLog]);
        jsonResponse(['success' => false, 'message' => 'Senha incorreta. Tente novamente.'], 401);
    }

    try {
        upgradeUserPasswordHashIfNeeded($pdo, $user, $password);
    } catch (Throwable $exception) {
        authLog('password_hash_upgrade_failed', ['user_id' => (int)$user['id']], $exception);
    }

    loginAuthUser([
        'id' => (int)$user['id'],
        'name' => (string)$user['nome'],
        'email' => (string)$user['email'],
    ]);
    authLog('login_success', ['user_id' => (int)$user['id']]);

    jsonResponse([
        'success' => true,
        'data' => [
            'user' => [
                'id' => (int)$user['id'],
                'name' => (string)$user['nome'],
                'email' => (string)$user['email'],
            ],
        ],
    ]);
} catch (Throwable $exception) {
    authLog('login_exception', ['login' => $loginForLog], $exception);
    jsonResponse([
        'success' => false,
        'message' => 'Nao foi possivel autenticar no momento.',
        'error' => $exception->getMessage(),
    ], 500);
}
