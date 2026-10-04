<?php

declare(strict_types=1);

final class Uploads
{
    public static function store(): never
    {
        Auth::requireUser();
        if (!isset($_FILES['file'])) {
            Http::json(['error' => 'Файл не передан'], 400);
        }
        $file = $_FILES['file'];
        $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
        if (!in_array($ext, ['glb', 'gltf', 'obj'], true)) {
            Http::json(['error' => 'Нужен GLB, GLTF или OBJ'], 400);
        }
        if (($file['size'] ?? 0) > 50 * 1024 * 1024) {
            Http::json(['error' => 'Файл больше 50 МБ'], 400);
        }

        $dir = getenv('UPLOAD_DIR') ?: '/var/www/html/uploads';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $name = bin2hex(random_bytes(12)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
            Http::json(['error' => 'Не удалось сохранить файл'], 500);
        }
        Http::json(['url' => '/api/models/' . $name, 'name' => $name]);
    }

    public static function download(string $name): never
    {
        $dir = getenv('UPLOAD_DIR') ?: '/var/www/html/uploads';
        $file = $dir . '/' . $name;
        if (!is_file($file)) {
            Http::json(['error' => 'Файл не найден'], 404);
        }
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $types = ['glb' => 'model/gltf-binary', 'gltf' => 'model/gltf+json', 'obj' => 'text/plain'];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        readfile($file);
        exit;
    }
}
