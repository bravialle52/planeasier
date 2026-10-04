<?php

declare(strict_types=1);

use Aws\S3\S3Client;
use Aws\Exception\AwsException;

final class Uploads
{
    private static function getS3Client(): S3Client
    {
        return new S3Client([
            'version' => 'latest',
            'region'  => 'us-east-1',
            'endpoint' => getenv('S3_ENDPOINT') ?: 'http://minio:9000',
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key'    => getenv('S3_ACCESS_KEY') ?: 'planeasier',
                'secret' => getenv('S3_SECRET_KEY') ?: 'planeasier123',
            ],
        ]);
    }

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

        $name = bin2hex(random_bytes(12)) . '.' . $ext;
        $s3 = self::getS3Client();
        $bucket = getenv('S3_BUCKET') ?: 'planeasier-models';

        try {
            $s3->putObject([
                'Bucket' => $bucket,
                'Key'    => 'models/' . $name,
                'SourceFile' => $file['tmp_name'],
                'ContentType' => mime_content_type($file['tmp_name']) ?: 'application/octet-stream',
            ]);
        } catch (AwsException $e) {
            Http::json(['error' => 'Не удалось сохранить файл в S3: ' . $e->getMessage()], 500);
        }
        
        Http::json(['url' => '/api/models/' . $name, 'name' => $name]);
    }

    public static function download(string $name): never
    {
        $s3 = self::getS3Client();
        $bucket = getenv('S3_BUCKET') ?: 'planeasier-models';

        try {
            $result = $s3->getObject([
                'Bucket' => $bucket,
                'Key'    => 'models/' . $name,
            ]);
            
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $types = ['glb' => 'model/gltf-binary', 'gltf' => 'model/gltf+json', 'obj' => 'text/plain'];
            header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
            echo $result['Body'];
            exit;
        } catch (AwsException $e) {
            Http::json(['error' => 'Файл не найден в S3'], 404);
        }
    }
}
