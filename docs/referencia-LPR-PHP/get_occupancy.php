<?php
// get_occupancy.php

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Error de conexión a la base de datos.']);
    exit();
}

try {
    // Contar vehículos con is_inside = 1
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM vehicles WHERE is_inside = 1");
    $stmt->execute();
    $occupancy = $stmt->fetchColumn();

    echo json_encode(['occupancy' => $occupancy]);

} catch (PDOException $e) {
    echo json_encode(['error' => 'Error al obtener la ocupación: ' . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['error' => 'Error general: ' . $e->getMessage()]);
}

?>