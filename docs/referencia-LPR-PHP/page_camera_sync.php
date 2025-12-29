<?php
/**
 * page_camera_sync.php - Módulo para Sincronización Masiva de Matrículas a Cámaras
 */
global $pdo, $csrf_token;
$cameras = $pdo->query("SELECT id, name, purpose FROM devices ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<link rel="stylesheet" href="includes/css/camera_sync.css">

<h1><i class="fas fa-sync-alt"></i> Sincronización de Matrículas con Cámaras</h1>
<p class="subtitle">Añada o elimine matrículas en la lista blanca de múltiples cámaras simultáneamente.</p>

<div class="sync-container">
    <!-- Columna de Configuración -->
    <div class="sync-form-container widget">
        <form id="sync-form">
            <div class="form-group">
                <label for="cameras-select">1. Seleccionar Cámaras de Destino</label>
                <div class="camera-checkbox-group">
                    <?php if (empty($cameras)): ?>
                        <p class="message info">No hay cámaras configuradas.</p>
                    <?php else: ?>
                        <label class="checkbox-container select-all-label">
                            <strong>Seleccionar Todas</strong>
                            <input type="checkbox" id="select-all-cameras">
                            <span class="checkmark"></span>
                        </label>
                        <hr>
                        <?php foreach ($cameras as $camera): ?>
                            <label class="checkbox-container">
                                <?= htmlspecialchars($camera['name']) ?> (<?= htmlspecialchars($camera['purpose']) ?>)
                                <input type="checkbox" name="cameras[]" value="<?= $camera['id'] ?>">
                                <span class="checkmark"></span>
                            </label>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <div class="form-group">
                <label for="plates-textarea">2. Pegar Lista de Matrículas (una por línea)</label>
                <textarea id="plates-textarea" class="form-control" rows="10" placeholder="AAA111\nBBB222\nCCC333"></textarea>
            </div>

            <div class="form-group">
                <label>3. Elegir Acción y Ejecutar</label>
                <div class="action-buttons">
                    <button type="submit" id="add-plates-btn" class="btn btn-primary"><i class="fas fa-plus-circle"></i> Añadir a Lista Blanca</button>
                    <button type="submit" id="delete-plates-btn" class="btn btn-danger"><i class="fas fa-trash-alt"></i> Eliminar de Lista Blanca</button>
                </div>
            </div>
        </form>
    </div>

    <!-- Columna de Resultados / Log -->
    <div class="sync-log-container widget">
        <div class="widget-header">
            <h3 class="widget-title"><i class="fas fa-tasks"></i> Registro de Operaciones</h3>
            <button id="clear-log-btn" class="btn btn-secondary btn-sm"><i class="fas fa-eraser"></i> Limpiar</button>
        </div>
        <div class="log-box" id="log-box">
            <p class="log-initial">Seleccione cámaras, ingrese matrículas y elija una acción para comenzar.</p>
        </div>
    </div>
</div>

<script src="includes/js/camera_sync.js"></script>