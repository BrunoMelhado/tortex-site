<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_check.php';
requireAuthSession(false);

readfile(__DIR__ . '/index.html');
