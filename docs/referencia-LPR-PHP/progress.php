<?php
// progress.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');

// Devolver el estado actual, o un estado inicial si aún no existe
$progress_data = $_SESSION['import_progress'] ?? [
    'current' => 0,
    'total' => 0,
    'done' => false,
    'summary' => []
];

echo json_encode($progress_data);