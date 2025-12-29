<?php
// get_log_data.php

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// --- CONFIGURACIÓN ---
$log_file_path = APP_ROOT . '/hikvision_lpr.log';
$max_lines_initial = 100; // Número máximo de líneas a cargar la primera vez

if (!file_exists($log_file_path)) {
    echo json_encode(['success' => false, 'message' => 'El archivo de log no existe.']);
    exit;
}

// Obtener el tamaño del archivo de la última vez (enviado por el cliente)
$last_size = isset($_GET['last_size']) ? (int)$_GET['last_size'] : 0;
$current_size = filesize($log_file_path);

// Si el archivo se ha rotado o es más pequeño, léelo desde el principio
if ($current_size < $last_size) {
    $last_size = 0;
}

$new_content = '';

if ($current_size > $last_size) {
    // Si hay contenido nuevo, leer solo la diferencia
    $handle = fopen($log_file_path, 'r');
    if ($handle) {
        fseek($handle, $last_size);
        $new_content = fread($handle, $current_size - $last_size);
        fclose($handle);
    }
} elseif ($last_size === 0) {
    // Si es la primera carga (last_size=0) y no hay contenido nuevo (current_size=0),
    // o si el archivo existe pero está vacío.
    // O si se solicita una carga completa (sin last_size)
    $lines = file($log_file_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines) {
        $lines_to_show = array_slice($lines, -$max_lines_initial);
        $new_content = implode("\n", $lines_to_show);
    }
}

// Responde con el contenido nuevo y el tamaño actual del archivo
echo json_encode([
    'success' => true,
    'content' => $new_content,
    'new_size' => $current_size
]);