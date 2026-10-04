<?php

declare(strict_types=1);

final class Auth
{
    public static function user(): ?array
    {
        $token = Http::bearer();
        if ($token === '') {
            return null;
        }
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.email, u.display_name
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token = :token AND s.expires_at > NOW()'
        );
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    public static function requireUser(): array
    {
        $user = self::user();
        if (!$user) {
            Http::json(['error' => 'Нужна авторизация'], 401);
        }
        return $user;
    }

    public static function register(): never
    {
        $input = Http::body();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $name = trim((string) ($input['displayName'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 4) {
            Http::json(['error' => 'Нужны почта и пароль от 4 символов'], 400);
        }
        if ($name === '') {
            $name = strstr($email, '@', true) ?: 'Пользователь';
        }

        $id = bin2hex(random_bytes(16));
        try {
            $stmt = Database::connection()->prepare(
                'INSERT INTO users (id, email, password_hash, display_name) VALUES (:id, :email, :hash, :name)'
            );
            $stmt->execute([
                'id' => $id,
                'email' => $email,
                'hash' => password_hash($password, PASSWORD_DEFAULT),
                'name' => $name,
            ]);
        } catch (Throwable) {
            Http::json(['error' => 'Такая почта уже зарегистрирована'], 409);
        }

        Http::json([
            'token' => self::issueToken($id),
            'user' => ['id' => $id, 'email' => $email, 'displayName' => $name],
        ]);
    }

    public static function login(): never
    {
        $input = Http::body();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $stmt = Database::connection()->prepare(
            'SELECT id, email, display_name, password_hash FROM users WHERE email = :email'
        );
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            Http::json(['error' => 'Неверная почта или пароль'], 401);
        }

        Http::json([
            'token' => self::issueToken($user['id']),
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'displayName' => $user['display_name'],
            ],
        ]);
    }

    public static function me(): never
    {
        $user = self::requireUser();
        Http::json(['user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'displayName' => $user['display_name'],
        ]]);
    }

    public static function logout(): never
    {
        $token = Http::bearer();
        if ($token !== '') {
            Database::connection()->prepare('DELETE FROM sessions WHERE token = :token')->execute(['token' => $token]);
        }
        Http::json(['status' => 'ok']);
    }

    private static function issueToken(string $userId): string
    {
        $token = bin2hex(random_bytes(24));
        Database::connection()->prepare(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (:token, :user, NOW() + INTERVAL '30 days')"
        )->execute(['token' => $token, 'user' => $userId]);
        return $token;
    }
}
