document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sync-form');
    const selectAllCheckbox = document.getElementById('select-all-cameras');
    const cameraCheckboxes = document.querySelectorAll('input[name="cameras[]"]');
    const platesTextarea = document.getElementById('plates-textarea');
    const addBtn = document.getElementById('add-plates-btn');
    const deleteBtn = document.getElementById('delete-plates-btn');
    const logBox = document.getElementById('log-box');
    const clearLogBtn = document.getElementById('clear-log-btn');

    // Lógica para "Seleccionar Todas"
    selectAllCheckbox.addEventListener('change', function() {
        cameraCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    // Lógica del formulario
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const action = e.submitter.id === 'add-plates-btn' ? 'add' : 'delete';
        const selectedCameras = Array.from(cameraCheckboxes)
                                   .filter(cb => cb.checked)
                                   .map(cb => cb.value);
        
        const plates = platesTextarea.value.trim().split('\n').filter(p => p.trim() !== '');

        if (selectedCameras.length === 0) {
            alert('Por favor, seleccione al menos una cámara.');
            return;
        }
        if (plates.length === 0) {
            alert('Por favor, ingrese al menos una matrícula.');
            return;
        }

        // Deshabilitar botones para evitar envíos múltiples
        addBtn.disabled = true;
        deleteBtn.disabled = true;
        
        logBox.innerHTML = ''; // Limpiar log anterior
        log(`Iniciando proceso de ${action === 'add' ? 'adición' : 'eliminación'} para ${plates.length} matrículas en ${selectedCameras.length} cámaras...`, 'info');
        
        processSync(plates, selectedCameras, action);
    });

    function log(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-times-circle';

        entry.innerHTML = `<i class="fas ${icon}"></i> [${new Date().toLocaleTimeString()}] ${message}`;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }
    
    clearLogBtn.addEventListener('click', () => {
        logBox.innerHTML = '<p class="log-initial">Registro limpiado. Listo para una nueva operación.</p>';
    });

    async function processSync(plates, cameras, action) {
        for (const plate of plates) {
            log(`Procesando matrícula: ${plate}`, 'info');
            
            const response = await fetch('process_camera_sync.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    plate: plate,
                    camera_ids: cameras
                })
            });

            const result = await response.json();
            
            if (result.success) {
                result.details.forEach(detail => {
                    if (detail.success) {
                        log(`[${detail.camera_name}] Éxito: ${detail.message}`, 'success');
                    } else {
                        log(`[${detail.camera_name}] ERROR: ${detail.message}`, 'error');
                    }
                });
            } else {
                log(`Error general al procesar la matrícula ${plate}: ${result.message}`, 'error');
            }
        }
        
        log('Proceso completado.', 'info');
        // Rehabilitar botones
        addBtn.disabled = false;
        deleteBtn.disabled = false;
    }
});