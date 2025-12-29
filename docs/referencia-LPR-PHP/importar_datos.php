<?php require_once __DIR__ . '/config.php'; ?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Importar Datos Masivos</title>
    <link rel="stylesheet" href="style.css">
    <style>
        .hidden { display: none; }
        .progress-bar-container {
            width: 100%;
            background-color: #e0e0e0;
            border-radius: 4px;
            margin-top: 20px;
        }
        .progress-bar {
            width: 0%;
            height: 30px;
            background-color: #4caf50;
            text-align: center;
            line-height: 30px;
            color: white;
            border-radius: 4px;
            transition: width 0.4s ease-in-out;
        }
    </style>
</head>
<body>


    <main class="container">
        <!-- Paso 1: Subir el archivo -->
        <section id="upload-step" class="form-section">
            <h2>Paso 1: Subir Archivo CSV</h2>
            <form id="upload-form" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="csv_file">Selecciona el archivo CSV:</label>
                    <input type="file" id="csv_file" name="csv_file" accept=".csv" required>
                </div>
                <button type="submit" class="btn btn-primary">Previsualizar y Mapear Columnas</button>
            </form>
        </section>

        <!-- Paso 2: Mapear columnas -->
        <section id="mapping-step" class="form-section hidden">
            <h2>Paso 2: Mapear Columnas</h2>
            <p>Por favor, indica qué columna de tu archivo corresponde a cada campo.</p>
            <form id="mapping-form">
                <input type="hidden" name="filepath" id="filepath">
                <div class="form-group">
                    <label>Cabeceras del Archivo:</label>
                    <div id="csv-headers"></div>
                </div>
                <div class="form-group">
                    <label for="plate-column">Columna de la <strong>Matrícula</strong>:</label>
                    <select id="plate-column" name="plate_column" required class="column-mapper"></select>
                </div>
                <div class="form-group">
                    <label for="owner-column">Columna del <strong>Nombre del Propietario</strong>:</label>
                    <select id="owner-column" name="owner_column" required class="column-mapper"></select>
                </div>
                <button type="submit" class="btn btn-primary">Iniciar Importación</button>
            </form>
        </section>

        <!-- Paso 3: Progreso y resultado -->
        <section id="progress-step" class="data-section hidden">
            <h2>Paso 3: Importando...</h2>
            <div class="progress-bar-container">
                <div id="progress-bar" class="progress-bar">0%</div>
            </div>
            <div id="progress-status">Preparando la importación...</div>
            <div id="import-summary" class="hidden" style="margin-top: 20px;"></div>
        </section>
    </main>

    <script>
        const uploadForm = document.getElementById('upload-form');
        const mappingStep = document.getElementById('mapping-step');
        const mappingForm = document.getElementById('mapping-form');
        const progressStep = document.getElementById('progress-step');
        
        // Paso 1: Manejar la subida del archivo
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(uploadForm);
            
            try {
                const response = await fetch('process_csv.php?action=preview', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.message);
                }

                // Mostrar el paso de mapeo
                document.getElementById('upload-step').classList.add('hidden');
                mappingStep.classList.remove('hidden');
                
                // Poblar los selectores de mapeo
                const headers = result.headers;
                const mappers = document.querySelectorAll('.column-mapper');
                document.getElementById('filepath').value = result.filepath;

                mappers.forEach(select => {
                    select.innerHTML = '<option value="">-- Seleccionar --</option>';
                    headers.forEach((header, index) => {
                        select.innerHTML += `<option value="${index}">${header} (Columna ${index + 1})</option>`;
                    });
                });

            } catch (error) {
                alert('Error: ' + error.message);
            }
        });

        // Paso 2: Manejar el inicio de la importación
        mappingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            mappingStep.classList.add('hidden');
            progressStep.classList.remove('hidden');
            
            const formData = new FormData(mappingForm);
            
            // Iniciar la importación en el backend
            fetch('process_csv.php?action=import', {
                method: 'POST',
                body: formData
            });

            // Iniciar la monitorización del progreso
            monitorProgress();
        });

        // Paso 3: Monitorizar el progreso
        function monitorProgress() {
            const progressBar = document.getElementById('progress-bar');
            const progressStatus = document.getElementById('progress-status');
            const importSummary = document.getElementById('import-summary');

            const interval = setInterval(async () => {
                try {
                    const response = await fetch('progress.php');
                    const progress = await response.json();

                    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
                    
                    progressBar.style.width = percent + '%';
                    progressBar.textContent = percent + '%';
                    progressStatus.textContent = `Procesando línea ${progress.current} de ${progress.total}...`;

                    if (progress.done) {
                        clearInterval(interval);
                        progressStatus.textContent = "¡Importación completada!";
                        importSummary.innerHTML = `
                            <h4>Resumen Final:</h4>
                            <ul>
                                <li><strong>Líneas procesadas:</strong> ${progress.summary.lines_processed}</li>
                                <li><strong>Propietarios nuevos creados:</strong> ${progress.summary.owners_created}</li>
                                <li><strong>Vehículos nuevos creados:</strong> ${progress.summary.vehicles_created}</li>
                                <li><strong>Vehículos asociados/actualizados:</strong> ${progress.summary.vehicles_assigned}</li>
                            </ul>
                        `;
                        importSummary.classList.remove('hidden');
                    }
                } catch (error) {
                    clearInterval(interval);
                    progressStatus.textContent = "Error al obtener el progreso de la importación.";
                }
            }, 1000); // Consultar cada segundo
        }
    </script>
</body>
</html>