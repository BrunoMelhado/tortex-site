<?php
declare(strict_types=1);

require_once __DIR__ . '/config/http.php';
require_once __DIR__ . '/auth_check.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    logoutAuthUser();
    jsonResponse(['success' => true]);
}

if ($method === 'GET') {
    logoutAuthUser();
    header('Location: ./login.php');
    exit;
}

jsonResponse(['success' => false, 'message' => 'Metodo nao permitido.'], 405);
