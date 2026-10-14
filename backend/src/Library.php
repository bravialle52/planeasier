<?php

declare(strict_types=1);

/** Account library: which shop model and texture packs a user has added. */
final class Library
{
    /** Return pack ids stored for the signed-in user. */
    public static function list(): never
    {
        $user = Auth::requireUser();
        $stmt = Database::connection()->prepare(
            'SELECT item_id FROM library_items WHERE user_id = :user ORDER BY item_id'
        );
        $stmt->execute(['user' => $user['id']]);
        $owned = array_map(static fn (array $row): string => (string) $row['item_id'], $stmt->fetchAll(PDO::FETCH_ASSOC));
        Http::json(['owned' => $owned]);
    }

    /** Attach one shop pack to the account. The id is the same string the gallery shows. */
    public static function claim(): never
    {
        $user = Auth::requireUser();
        $input = Http::body();
        $id = trim((string) ($input['id'] ?? ''));
        if ($id === '' || !preg_match('/^[a-z0-9_]{2,40}$/', $id)) {
            Http::json(['error' => 'Неизвестный пакет'], 422);
        }
        Database::connection()->prepare(
            'INSERT INTO library_items (user_id, item_id) VALUES (:user, :item) ON CONFLICT DO NOTHING'
        )->execute(['user' => $user['id'], 'item' => $id]);
        self::list();
    }
}
