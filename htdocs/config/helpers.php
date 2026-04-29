<?php
declare(strict_types=1);

function formatCode(string $prefix, int $id): string
{
    return sprintf('%s-%03d', $prefix, $id);
}

function parseCodeToInt(string $code, string $prefix): int
{
    if (!preg_match('/^' . preg_quote($prefix, '/') . '-(\d+)$/', trim($code), $matches)) {
        throw new InvalidArgumentException(sprintf('Codigo %s invalido.', $prefix));
    }
    return (int)$matches[1];
}

function normalizeStatusToFront(string $dbStatus): string
{
    return strtolower($dbStatus) === 'ativo' ? 'active' : 'inactive';
}

function normalizeStatusToDb(string $frontStatus): string
{
    return strtolower($frontStatus) === 'active' ? 'ativo' : 'inativo';
}

function paymentMethodToDb(string $value): string
{
    $normalized = strtolower(trim($value));
    $map = [
        'pix' => 'Pix',
        'caju' => 'Caju',
        'cash' => 'Dinheiro',
        'dinheiro' => 'Dinheiro',
        'credit' => 'Fiado',
        'credito rotativo' => 'Fiado',
        'fiado' => 'Fiado',
    ];

    if (isset($map[$normalized])) {
        return $map[$normalized];
    }

    return trim($value);
}

function paymentMethodToView(string $value): string
{
    return paymentMethodToDb($value);
}

function paymentMethodIsFiado(string $value): bool
{
    return paymentMethodToDb($value) === 'Fiado';
}

function todayYmd(): string
{
    return (new DateTimeImmutable('today'))->format('Y-m-d');
}
