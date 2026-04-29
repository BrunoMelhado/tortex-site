<?php
declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        jsonResponse(['success' => false, 'message' => 'JSON invalido.'], 400);
    }

    return $decoded;
}

function requireMethod(array $allowedMethods): string
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $allowedMethods, true)) {
        jsonResponse(
            ['success' => false, 'message' => 'Metodo nao permitido.'],
            405
        );
    }
    return $method;
}

function handleApiException(Throwable $exception): void
{
    jsonResponse(
        [
            'success' => false,
            'message' => 'Erro interno no servidor.',
            'error' => $exception->getMessage(),
        ],
        500
    );
}
