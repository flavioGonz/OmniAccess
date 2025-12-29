<?php
// process_csv.php

require_once __DIR__ . '/config.php';
// Iniciar la sesión para almacenar el progreso
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_GET['action'] ?? '';

header('Content-Type: application/json');

if ($action === 'preview' && isset($_FILES['csv_file'])) {
    if ($_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'message' => 'Error al subir el archivo.']);
        exit;
    }
    
    // Mover el archivo subido a una ubicación temporal segura
    $tmp_name = $_FILES['csv_file']['tmp_name'];
    $filename = 'import_' . session_id() . '.csv';
    $filepath = sys_get_temp_dir() . '/' . $filename;
    
    if (!move_uploaded_file($tmp_name, $filepath)) {
        echo json_encode(['success' => false, 'message' => 'No se pudo mover el archivo temporal.']);
        exit;
    }

    // Leer solo la primera línea para obtener las cabeceras (o la primera fila de datos)
    ini_set('auto_detect_line_endings', TRUE);
    $headers = [];
    if (($handle = fopen($filepath, "r")) !== FALSE) {
        $headers = fgetcsv($handle, 1000, ",");
        fclose($handle);
    }
    
    echo json_encode(['success' => true, 'filepath' => $filepath, 'headers' => $headers]);
    exit;
}

if ($action === 'import') {
    // Para que el script siga corriendo aunque el usuario cierre la ventana
    ignore_user_abort(true);
    set_time_limit(0); // Sin límite de tiempo de ejecución
    
    $filepath = $_POST['filepath'] ?? '';
    $plate_col = (int)$_POST['plate_column'];
    $owner_col = (int)$_POST['owner_column'];

    if (!file_exists($filepath) || !isset($plate_col) || !isset($owner_col)) {
        // No podemos devolver un error JSON porque el cliente ya no escucha
        // Lo ideal sería loguearlo.
        exit;
    }

    // Inicializar el estado del progreso en la sesión
    $_SESSION['import_progress'] = [
        'current' => 0,
        'total' => count(file($filepath)),
        'done' => false,
        'summary' => [
            'lines_processed' => 0, 'owners_created' => 0,
            'vehicles_created' => 0, 'vehicles_assigned' => 0,
        ]
    ];
    session_write_close(); // Liberar la sesión para que progress.php pueda leerla

    try {
        $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $pdo->beginTransaction();

        ini_set('auto_detect_line_endings', TRUE);
        $current_line = 0;
        if (($handle = fopen($filepath, "r")) !== FALSE) {
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $current_line++;
                
                // Actualizar progreso
                session_start();
                $_SESSION['import_progress']['current'] = $current_line;
                session_write_close();
                
                $line_data = array_map(fn($str) => mb_convert_encoding($str, 'UTF-8', 'auto'), $data);
                
                $plate = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $line_data[$plate_col] ?? ''));
                $owner_name = trim($line_data[$owner_col] ?? '');

                if (empty($plate) || empty($owner_name)) continue;
                
                session_start();
                $_SESSION['import_progress']['summary']['lines_processed']++;
                session_write_close();

                // --- Lógica de importación (la misma que antes) ---
                $stmt = $pdo->prepare("SELECT id FROM owners WHERE name = ?");
                $stmt->execute([$owner_name]);
                $owner = $stmt->fetch();
                $owner_id = $owner ? $owner['id'] : null;
                if (!$owner) {
                    $owner_uid = 'OWNER-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
                    $stmt_insert = $pdo->prepare("INSERT INTO owners (owner_uid, name, created_at) VALUES (?, ?, NOW())");
                    $stmt_insert->execute([$owner_uid, $owner_name]);
                    $owner_id = $pdo->lastInsertId();
                    session_start();
                    $_SESSION['import_progress']['summary']['owners_created']++;
                    session_write_close();
                }

                $stmt = $pdo->prepare("SELECT id FROM vehicles WHERE plate = ?");
                $stmt->execute([$plate]);
                $vehicle = $stmt->fetch();
                if ($vehicle) {
                    $stmt_update = $pdo->prepare("UPDATE vehicles SET owner_id = ?, is_whitelisted = 1, updated_at = NOW() WHERE id = ?");
                    $stmt_update->execute([$owner_id, $vehicle['id']]);
                } else {
                    $stmt_insert = $pdo->prepare("INSERT INTO vehicles (plate, owner_id, is_whitelisted, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())");
                    $stmt_insert->execute([$plate, $owner_id]);
                    session_start();
                    $_SESSION['import_progress']['summary']['vehicles_created']++;
                    session_write_close();
                }
                session_start();
                $_SESSION['import_progress']['summary']['vehicles_assigned']++;
                session_write_close();
            }
            fclose($handle);
        }

        $pdo->commit();

    } catch (Exception $e) {
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Loguear el error, ya que no podemos mostrarlo al usuario
        error_log("Error en importación masiva: " . $e->getMessage());
    }

    // Marcar como finalizado
    session_start();
    $_SESSION['import_progress']['done'] = true;
    session_write_close();

    // Limpiar el archivo temporal
    unlink($filepath);
}