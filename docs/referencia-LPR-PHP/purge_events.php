<?php
// purge_events.php (Versión 2 - Corregida)

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// 1. Seguridad: Solo aceptar solicitudes POST y validar CSRF
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['csrf_token']) || !validate_csrf_token($data['csrf_token'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Token CSRF inválido. La sesión puede haber expirado.']);
    exit;
}

// 2. Lógica de borrado
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Iniciar una transacción para asegurar que todo o nada se complete
    $pdo->beginTransaction();

    // 3. Obtener la lista de imágenes ANTES de borrar los eventos
    $stmt = $pdo->query("SELECT image_path FROM events WHERE image_path IS NOT NULL AND image_path != ''");
    $image_paths = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 4. Contar los registros ANTES de borrarlos
    $events_to_delete = $pdo->query("SELECT COUNT(*) FROM events")->fetchColumn();
    $sessions_to_delete = $pdo->query("SELECT COUNT(*) FROM parking_sessions")->fetchColumn();
    
    // 5. Borrar los registros de las tablas usando DELETE en lugar de TRUNCATE
    // DELETE es transaccional, a diferencia de TRUNCATE que causa un commit implícito.
    // Esto asegura que si una de las operaciones falla, se puede hacer rollback de todo.
    $pdo->exec("DELETE FROM events");
    $pdo->exec("DELETE FROM parking_sessions");

    // 6. Borrar los archivos de imagen del servidor
    $files_deleted_count = 0;
    $image_dir = APP_ROOT . '/plate_images/';

    foreach ($image_paths as $relative_path) {
        $filename = basename($relative_path); // Medida de seguridad
        if (!empty($filename)) {
            $full_path = $image_dir . $filename;
            if (file_exists($full_path)) {
                if (unlink($full_path)) {
                    $files_deleted_count++;
                }
            }
        }
    }

    // Si todo fue bien, confirmar la transacción
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Todos los eventos y archivos han sido eliminados con éxito.',
        'db_events_deleted' => (int)$events_to_delete,
        'db_sessions_deleted' => (int)$sessions_to_delete,
        'files_deleted' => $files_deleted_count
    ]);

} catch (PDOException $e) {
    // Si estamos en medio de una transacción y algo falló, revertir.
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    // Devolver el mensaje de error real para depuración
    echo json_encode(['success' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}