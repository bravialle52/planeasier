<?php

declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $url = getenv('DATABASE_URL') ?: 'postgresql://postgres:1010@db:5432/planeasier';
        $parts = parse_url($url);
        $host = $parts['host'] ?? 'db';
        $port = $parts['port'] ?? 5432;
        $user = $parts['user'] ?? 'postgres';
        $pass = $parts['pass'] ?? '1010';
        $name = ltrim($parts['path'] ?? '/planeasier', '/');

        self::$pdo = new PDO(
            sprintf('pgsql:host=%s;port=%s;dbname=%s', $host, $port, $name),
            $user,
            $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );

        self::$pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        ");

        self::$pdo->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id TEXT");
        self::$pdo->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()");
        $dataType = self::$pdo->query(
            "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'data'"
        )->fetchColumn();
        if ($dataType === 'json') {
            self::$pdo->exec("ALTER TABLE projects ALTER COLUMN data TYPE JSONB USING data::jsonb");
        }

        return self::$pdo;
    }
}
