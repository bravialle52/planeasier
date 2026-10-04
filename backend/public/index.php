<?php

declare(strict_types=1);

require __DIR__ . '/../src/Database.php';
require __DIR__ . '/../src/Http.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/Projects.php';
require __DIR__ . '/../src/Uploads.php';

Http::cors();

$path = Http::path();
$method = Http::method();

if ($path === '/api/health' && $method === 'GET') {
    try {
        Database::connection()->query('SELECT 1');
        Http::json(['status' => 'ok', 'db' => 'ok', 'backend' => 'php']);
    } catch (Throwable $error) {
        Http::json(['status' => 'error', 'db' => $error->getMessage(), 'backend' => 'php'], 500);
    }
}

if ($path === '/api/auth/register' && $method === 'POST') {
    Auth::register();
}
if ($path === '/api/auth/login' && $method === 'POST') {
    Auth::login();
}
if ($path === '/api/auth/me' && $method === 'GET') {
    Auth::me();
}
if ($path === '/api/auth/logout' && $method === 'POST') {
    Auth::logout();
}

if ($path === '/api/projects' && $method === 'GET') {
    Projects::list();
}
if ($path === '/api/projects' && $method === 'POST') {
    Projects::create();
}
if (preg_match('#^/api/projects/([a-f0-9]+)$#', $path, $match)) {
    if ($method === 'GET') {
        Projects::show($match[1]);
    }
    if ($method === 'PUT') {
        Projects::update($match[1]);
    }
    if ($method === 'DELETE') {
        Projects::delete($match[1]);
    }
}

if ($path === '/api/models' && $method === 'POST') {
    Uploads::store();
}
if (preg_match('#^/api/models/([a-zA-Z0-9._-]+)$#', $path, $match) && $method === 'GET') {
    Uploads::download($match[1]);
}

Http::json(['error' => 'Не найдено'], 404);
