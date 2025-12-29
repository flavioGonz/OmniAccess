<?php
// admin.php

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

$message = '';

// --- LÓGICA PARA AÑADIR/EDITAR VEHÍCULO ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $plate = isset($_POST['plate']) ? strtoupper(trim(preg_replace('/[^A-Z0-9]/i', '', $_POST['plate']))) : '';
    $description = isset($_POST['description']) ? trim($_POST['description']) : '';
    $is_whitelisted = isset($_POST['is_whitelisted']) ? 1 : 0;
    $vehicle_id = isset($_POST['vehicle_id']) ? (int)$_POST['vehicle_id'] : 0;

    if (empty($plate)) {
        $message = '<p style="color: red;">La matrícula no puede estar vacía.</p>';
    } else {
        $now = date('Y-m-d H:i:s');
        if ($vehicle_id > 0) {
            // Editar vehículo existente
            $stmt = $pdo->prepare("
                UPDATE vehicles
                SET plate = :plate, description = :description, is_whitelisted = :is_whitelisted, updated_at = :updated_at
                WHERE id = :id
            ");
            $stmt->execute([
                ':plate' => $plate,
                ':description' => $description,
                ':is_whitelisted' => $is_whitelisted,
                ':updated_at' => $now,
                ':id' => $vehicle_id
            ]);
            $message = '<p style="color: green;">Vehículo actualizado con éxito.</p>';
        } else {
            // Añadir nuevo vehículo
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO vehicles (plate, description, is_whitelisted, created_at, updated_at)
                    VALUES (:plate, :description, :is_whitelisted, :created_at, :updated_at)
                ");
                $stmt->execute([
                    ':plate' => $plate,
                    ':description' => $description,
                    ':is_whitelisted' => $is_whitelisted,
                    ':created_at' => $now,
                    ':updated_at' => $now
                ]);
                $message = '<p style="color: green;">Vehículo añadido con éxito.</p>';
            } catch (PDOException $e) {
                if ($e->getCode() == '23000') { // Código de error para UNIQUE constraint failed
                    $message = '<p style="color: red;">Error: La matrícula ' . htmlspecialchars($plate) . ' ya existe.</p>';
                } else {
                    $message = '<p style="color: red;">Error al añadir vehículo: ' . $e->getMessage() . '</p>';
                }
            }
        }
    }
}

// --- LÓGICA PARA ELIMINAR VEHÍCULO ---
if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['id'])) {
    $vehicle_id = (int)$_GET['id'];
    try {
        $stmt = $pdo->prepare("DELETE FROM vehicles WHERE id = :id");
        $stmt->execute([':id' => $vehicle_id]);
        $message = '<p style="color: green;">Vehículo eliminado con éxito.</p>';
    } catch (PDOException $e) {
        $message = '<p style="color: red;">Error al eliminar vehículo: ' . $e->getMessage() . '</p>';
    }
}

// --- OBTENER TODOS LOS VEHÍCULOS PARA MOSTRAR ---
$vehicles = $pdo->query("SELECT * FROM vehicles ORDER BY plate ASC")->fetchAll(PDO::FETCH_ASSOC);

?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administración de Vehículos LPR</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f4f4f4;
            color: #333;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2 { color: #333; text-align: center; }
        .message { margin-bottom: 20px; text-align: center; }
        form {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid #eee;
        }
        form label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
        }
        form input[type="text"],
        form input[type="submit"] {
            width: calc(100% - 22px);
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        form input[type="checkbox"] {
            margin-right: 10px;
        }
        form input[type="submit"] {
            background-color: #007bff;
            color: white;
            border: none;
            cursor: pointer;
            width: auto;
            padding: 10px 20px;
        }
        form input[type="submit"]:hover {
            background-color: #0056b3;
        }
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
        }
        th { background-color: #f2f2f2; }
        .actions a {
            margin-right: 10px;
            text-decoration: none;
            color: #007bff;
        }
        .actions a:hover { text-decoration: underline; }
        .actions .delete { color: red; }
    </style>
</head>
<body>

    <div class="container">
        <h1>Administración de Vehículos</h1>

        <div class="message">
            <?php echo $message; // Mostrar mensajes de éxito/error ?>
        </div>

        <h2>Añadir/Editar Vehículo</h2>
        <form action="admin.php" method="POST">
            <input type="hidden" name="vehicle_id" id="vehicle_id" value="0">

            <label for="plate">Matrícula:</label>
            <input type="text" name="plate" id="plate" required>

            <label for="description">Descripción (ej. "Auto de Juan Pérez"):</label>
            <input type="text" name="description" id="description">

            <label>
                <input type="checkbox" name="is_whitelisted" id="is_whitelisted">
                En Lista Blanca
            </label>
            <br><br>

            <input type="submit" value="Guardar Vehículo">
        </form>

        <h2>Lista de Vehículos</h2>
        <table>
            <thead>
                <tr>
                    <th>Matrícula</th>
                    <th>Descripción</th>
                    <th>Lista Blanca</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($vehicles)): ?>
                    <tr><td colspan="4">No hay vehículos registrados.</td></tr>
                <?php else: ?>
                    <?php foreach ($vehicles as $vehicle): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($vehicle['plate']); ?></td>
                            <td><?php echo htmlspecialchars($vehicle['description']); ?></td>
                            <td><?php echo $vehicle['is_whitelisted'] ? 'Sí' : 'No'; ?></td>
                            <td class="actions">
                                <a href="#" onclick="editVehicle(<?php echo $vehicle['id']; ?>, '<?php echo htmlspecialchars($vehicle['plate'], ENT_QUOTES); ?>', '<?php echo htmlspecialchars($vehicle['description'], ENT_QUOTES); ?>', <?php echo $vehicle['is_whitelisted']; ?>);">Editar</a>
                                <a href="admin.php?action=delete&id=<?php echo $vehicle['id']; ?>" class="delete" onclick="return confirm('¿Estás seguro de que quieres eliminar este vehículo?');">Eliminar</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <script>
        function editVehicle(id, plate, description, is_whitelisted) {
            document.getElementById('vehicle_id').value = id;
            document.getElementById('plate').value = plate;
            document.getElementById('description').value = description;
            document.getElementById('is_whitelisted').checked = (is_whitelisted == 1);
            window.scrollTo(0, 0); // Scroll to top to show the form
        }
    </script>

</body>
</html>