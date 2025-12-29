<?php
// events.php

require_once __DIR__ . '/config.php';

// --- CONEXIÓN A LA BASE DE DATOS ---
$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Error de conexión a la base de datos: " . $e->getMessage());
}

// --- OBTENER TODOS LOS EVENTOS ---
// Se ordenan por timestamp de forma descendente para mostrar los más recientes primero.
$events = $pdo->query("SELECT * FROM events ORDER BY timestamp DESC")->fetchAll(PDO::FETCH_ASSOC);

?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Historial de Eventos LPR</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f4f4f4;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        table, th, td {
            border: 1px solid #ddd;
        }
        th, td {
            padding: 10px;
            text-align: left;
            vertical-align: top;
        }
        th { background-color: #f2f2f2; }
        .plate-image {
            max-width: 100px;
            height: auto;
            display: block;
            margin: 0 auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .decision-allowed { color: green; font-weight: bold; }
        .decision-denied { color: red; font-weight: bold; }
        .decision-unknown { color: orange; }
    </style>
</head>
<body>

    <div class="container">
        <h1>Historial de Eventos LPR</h1>

        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Matrícula</th>
                    <th>Fecha/Hora</th>
                    <th>Tipo Evento</th>
                    <th>Decisión</th>
                    <th>Imagen</th>
                    <th>Notas</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($events)): ?>
                    <tr><td colspan="7">No hay eventos registrados.</td></tr>
                <?php else: ?>
                    <?php foreach ($events as $event): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($event['id']); ?></td>
                            <td><?php echo htmlspecialchars($event['plate']); ?></td>
                            <td><?php echo date('Y-m-d H:i:s', $event['timestamp']); ?></td>
                            <td><?php echo htmlspecialchars($event['event_type']); ?></td>
                            <td class="decision-<?php echo str_replace('_', '-', $event['decision']); ?>">
                                <?php echo htmlspecialchars(ucwords(str_replace('_', ' ', $event['decision']))); ?>
                            </td>
                            <td>
                                <?php if (!empty($event['image_path'])): ?>
                                    <a href="<?php echo htmlspecialchars($event['image_path']); ?>" target="_blank">
                                        <img src="<?php echo htmlspecialchars($event['image_path']); ?>" alt="Matrícula" class="plate-image">
                                    </a>
                                <?php else: ?>
                                    N/A
                                <?php endif; ?>
                            </td>
                            <td><?php echo htmlspecialchars($event['notes']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

</body>
</html>