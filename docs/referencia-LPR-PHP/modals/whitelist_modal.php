<?php
// modals/whitelist_modal.php 
?>
<div id="addPlateModal" class="modal">
    <div class="modal-content-wrapper">
        <form id="addPlateForm" action="whitelist_manager.php" method="POST">
            <input type="hidden" name="action" value="add_plate">
            <!-- CSRF Token se añadirá aquí si es necesario más adelante -->
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">

            <div class="modal-header">
                <h2>Añadir Matrícula a la Lista Blanca</h2>
                <span class="close-button">×</span>
            </div>

            <div class="modal-body">
                <div class="form-group">
                    <label for="new_plate_input">Matrícula:</label>
                    <input type="text" id="new_plate_input" name="plate" class="form-control" placeholder="Introduce la matrícula (ej. ABC123)" required>
                </div>

                <div class="form-group">
                    <label>Actualizar cámaras:</label>
                    <div class="camera-checkbox-group">
                        <?php if (!empty($cameras)): ?>
                            <?php foreach ($cameras as $cam): ?>
                                <label class="checkbox-container">
                                    <?php echo htmlspecialchars($cam['name']); ?> (<?php echo htmlspecialchars($cam['ip']); ?>)
                                    <input type="checkbox" name="cameras[]" value="<?php echo htmlspecialchars($cam['name']); ?>" checked>
                                    <span class="checkmark"></span>
                                </label>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <p class="message info">No se encontraron cámaras configuradas.</p>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                 <button type="button" class="btn btn-secondary close-button">Cancelar</button>
                 <button type="submit" class="btn btn-primary">Añadir Matrícula</button>
            </div>
        </form>
    </div>
</div>