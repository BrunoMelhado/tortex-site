<?php
declare(strict_types=1);

require_once __DIR__ . '/config/http.php';

const AUTH_SESSION_TIMEOUT_SECONDS = 1800; // 30 minutos

function startAuthSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_strict_mode', '1');

    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        ini_set('session.cookie_secure', '1');
    }

    session_start();
}

function currentAuthUser(): ?array
{
    startAuthSession();

    $lastActivity = (int)($_SESSION['last_activity'] ?? 0);
    if ($lastActivity > 0 && (time() - $lastActivity) > AUTH_SESSION_TIMEOUT_SECONDS) {
        logoutAuthUser();
        return null;
    }

    $sessionUser = $_SESSION['auth_user'] ?? null;
    $sessionUserId = (int)($_SESSION['usuario_id'] ?? 0);
    if (!is_array($sessionUser)) {
        return null;
    }

    if (!isset($sessionUser['id'], $sessionUser['name'], $sessionUser['email']) || $sessionUserId <= 0) {
        return null;
    }

    if ((int)$sessionUser['id'] !== $sessionUserId) {
        return null;
    }

    $_SESSION['last_activity'] = time();

    return [
        'id' => (int)$sessionUser['id'],
        'name' => (string)$sessionUser['name'],
        'email' => (string)$sessionUser['email'],
    ];
}

function loginAuthUser(array $user): void
{
    startAuthSession();
    session_regenerate_id(true);

    $userId = (int)($user['id'] ?? 0);
    $_SESSION['auth_user'] = [
        'id' => $userId,
        'name' => (string)($user['name'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
    ];
    $_SESSION['usuario_id'] = $userId;
    $_SESSION['last_activity'] = time();
}

function logoutAuthUser(): void
{
    startAuthSession();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'] ?? '/',
            $params['domain'] ?? '',
            (bool)($params['secure'] ?? false),
            (bool)($params['httponly'] ?? true)
        );
    }

    session_destroy();
}

function stringEndsWith(string $value, string $needle): bool
{
    if (function_exists('str_ends_with')) {
        return str_ends_with($value, $needle);
    }

    if ($needle === '') {
        return true;
    }

    return substr($value, -strlen($needle)) === $needle;
}

function requireAuthSession(bool $asJson = false): array
{
    $user = currentAuthUser();
    if ($user !== null) {
        return $user;
    }

    if ($asJson) {
        jsonResponse([
            'success' => false,
            'message' => 'Sessao expirada. Faca login novamente.',
        ], 401);
    }

    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    $normalizedPath = strtolower(str_replace('\\', '/', (string)$path));
    $isLoginPath = stringEndsWith($normalizedPath, '/login.php') || stringEndsWith($normalizedPath, '/login.html');
    if (!$isLoginPath) {
        header('Location: ./login.php');
        exit;
    }

    // Fallback defensivo para evitar loop caso requireAuthSession seja chamado no login.
    return [];
}

if (basename((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === basename(__FILE__)) {
    requireMethod(['GET']);
    $user = currentAuthUser();
    jsonResponse([
        'success' => true,
        'data' => [
            'authenticated' => $user !== null,
            'user' => $user,
        ],
    ]);
}
