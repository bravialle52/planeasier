<?php

declare(strict_types=1);

final class Projects
{
    public static function list(): never
    {
        $user = Auth::requireUser();
        $stmt = Database::connection()->prepare(
            'SELECT id, name, data, updated_at FROM projects WHERE user_id = :user ORDER BY updated_at DESC'
        );
        $stmt->execute(['user' => $user['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['data'] = json_decode($row['data'], true);
        }
        Http::json(['projects' => $rows]);
    }

    public static function create(): never
    {
        $user = Auth::requireUser();
        $input = Http::body();
        $name = trim((string) ($input['name'] ?? 'Новый проект'));
        $data = self::normalize(is_array($input['data'] ?? null) ? $input['data'] : ['objects' => []]);
        $id = bin2hex(random_bytes(16));
        Database::connection()->prepare(
            'INSERT INTO projects (id, user_id, name, data) VALUES (:id, :user, :name, CAST(:data AS jsonb))'
        )->execute([
            'id' => $id,
            'user' => $user['id'],
            'name' => $name,
            'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
        ]);
        Http::json(['id' => $id, 'name' => $name, 'data' => $data]);
    }

    public static function show(string $id): never
    {
        $project = self::owned($id);
        $project['data'] = json_decode($project['data'], true);
        Http::json($project);
    }

    public static function update(string $id): never
    {
        $project = self::owned($id);
        $input = Http::body();
        $name = trim((string) ($input['name'] ?? $project['name']));
        $current = json_decode($project['data'], true);
        $data = self::normalize(is_array($input['data'] ?? null) ? $input['data'] : (is_array($current) ? $current : ['objects' => []]));
        Database::connection()->prepare(
            'UPDATE projects SET name = :name, data = CAST(:data AS jsonb), updated_at = NOW() WHERE id = :id'
        )->execute([
            'name' => $name,
            'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'id' => $id,
        ]);
        Http::json(['id' => $id, 'name' => $name, 'data' => $data]);
    }

    public static function delete(string $id): never
    {
        $user = Auth::requireUser();
        Database::connection()->prepare(
            'DELETE FROM projects WHERE id = :id AND user_id = :user'
        )->execute(['id' => $id, 'user' => $user['id']]);
        Http::json(['status' => 'ok']);
    }

    private static function owned(string $id): array
    {
        $user = Auth::requireUser();
        $stmt = Database::connection()->prepare(
            'SELECT id, name, data, updated_at FROM projects WHERE id = :id AND user_id = :user'
        );
        $stmt->execute(['id' => $id, 'user' => $user['id']]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$project) {
            Http::json(['error' => 'Проект не найден'], 404);
        }
        return $project;
    }

    private static function normalize(array $data): array
    {
        $objects = is_array($data['objects'] ?? null) ? $data['objects'] : [];
        $normalized = [];
        foreach ($objects as $obj) {
            if (!is_array($obj)) {
                continue;
            }
            $position = $obj['position'] ?? [0, 0, 0];
            $scale = $obj['scale'] ?? [1, 1, 1];
            $rotation = $obj['rotation'] ?? [0, 0, 0];
            $obj['center'] = [
                'x' => (float) ($position[0] ?? 0),
                'y' => (float) ($position[1] ?? 0),
                'z' => (float) ($position[2] ?? 0),
            ];
            $obj['size'] = [
                'x' => (float) ($scale[0] ?? 1),
                'y' => (float) ($scale[1] ?? 1),
                'z' => (float) ($scale[2] ?? 1),
            ];
            $obj['rotationEuler'] = [
                'x' => (float) ($rotation[0] ?? 0),
                'y' => (float) ($rotation[1] ?? 0),
                'z' => (float) ($rotation[2] ?? 0),
            ];
            $normalized[] = $obj;
        }
        $data['objects'] = $normalized;
        return $data;
    }
}
