<?php
// modals/delete_whitelist_modal.php
?>
<div id="deletePlateModal" class="modal">
    <div class="modal-content-wrapper">
        <form action="whitelist_manager.php" method="POST">
            <input type="hidden" name="action" value="delete_plate">
            <!-- El token CSRF se incluye para seguridad -->
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
            <!-- La matrícula a eliminar se llenará con JavaScript -->
            <input type="hidden" name="plate_to_delete" id="plateToDeleteInput" value="">

            <div class="modal-header">
                <h2>Confirmar Eliminación</h2>
                <span class="close-button" data-modal-id="deletePlateModal">×</span>
            </div>

            <div class="modal-body">
                <p>¿Estás seguro de que quieres eliminar la matrícula de la lista blanca? Esta acción no se puede deshacer.</p>
                <p>Matrícula a eliminar: <strong id="plateToDeleteSpan" class="styled-plate"></strong></p>
            </div>

            <div class="modal-footer">
                 <button type="button" class="btn btn-secondary close-button" data-modal-id="deletePlateModal">Cancelar</button>
                 <button type="submit" class="btn btn-danger">Confirmar Eliminación</button>
            </div>
        </form>
    </div>
</div>