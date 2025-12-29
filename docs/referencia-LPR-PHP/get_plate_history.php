<?php
// get_plate_history.php (Versión Final y Funcional)

// Mostramos errores para facilitar la depuración
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// La conexión $pdo ya debería haber sido creada por 'config.php' o un guardián
// pero si no, la creamos aquí para asegurar que el endpoint funcione de forma independiente.
if (!isset($pdo)) {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error crítico: No se pudo establecer la conexión a la base de datos.']);
        exit;
    }
}

$plate = $_GET['plate'] ?? null;

if (empty($plate)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'No se proporcionó matrícula.']);
    exit;
}

try {
    // Consulta para obtener los últimos 50 eventos de una matrícula específica
    $stmt = $pdo->prepare("
        SELECT 
            e.timestamp,
            e.decision,
            d.name as device_name
        FROM events e
        LEFT JOIN devices d ON e.device_id = d.id
        WHERE e.plate = :plate
        ORDER BY e.timestamp DESC
        LIMIT 50
    ");
    $stmt->execute([':plate' => $plate]);
    $events = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $events]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al consultar el historial: ' . $e->getMessage()]);
}
?>