<?php
// update_event_notes.php

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$response = [
    'success' => false,
    'message' => ''
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $event_id = $_POST['id'] ?? null;
    $notes = $_POST['notes'] ?? null;

    if ($event_id === null || $notes === null) {
        $response['message'] = 'Datos incompletos.';
    } else {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $stmt = $pdo->prepare("UPDATE events SET notes = :notes WHERE id = :id");
            $stmt->execute([
                ':notes' => $notes,
                ':id' => $event_id
            ]);

            if ($stmt->rowCount() > 0) {
                $response['success'] = true;
                $response['message'] = 'Observación guardada con éxito.';
            } else {
                $response['message'] = 'No se encontró el evento o no hubo cambios.';
            }

        } catch (PDOException $e) {
            $response['message'] = 'Error de base de datos: ' . $e->getMessage();
        } catch (Exception $e) {
            $response['message'] = 'Error inesperado: ' . $e->getMessage();
        }
    }
} else {
    $response['message'] = 'Método de solicitud no permitido.';
}

echo json_encode($response);
?>