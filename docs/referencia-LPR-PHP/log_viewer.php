<?php
// log_viewer.php
?>
<style>
    .log-viewer-container {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 150px); /* Ajusta según la altura de tu header/footer */
        background-color: #1e1e1e; /* Color de fondo tipo terminal */
        border: 1px solid var(--widget-border-color);
        border-radius: var(--border-radius-lg);
        overflow: hidden;
    }
    .log-toolbar {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: var(--widget-header-bg);
        border-bottom: 1px solid var(--widget-border-color);
        flex-shrink: 0;
    }
    .log-toolbar .status-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .log-toolbar .status-light {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #e74c3c; /* Rojo por defecto (desconectado) */
        transition: background-color 0.3s;
    }
    .log-toolbar .status-light.live {
        background-color: #2ecc71; /* Verde (conectado) */
        animation: pulse 2s infinite;
    }
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
        100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
    }
    .log-output {
        flex-grow: 1;
        overflow-y: auto;
        padding: 1rem;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.85rem;
        line-height: 1.6;
        color: #d4d4d4;
        white-space: pre-wrap; /* Mantiene los espacios y saltos de línea */
        word-break: break-all;
    }
    /* Resaltado de sintaxis */
    .log-line .log-error { color: #f48771; font-weight: bold; }
    .log-line .log-warn { color: #f1c40f; }
    .log-line .log-success { color: #2ecc71; }
    .log-line .log-info { color: #3498db; }
    .log-line .log-timestamp { color: #95a5a6; }
</style>

<h1>Visor de Logs en Tiempo Real</h1>
<p style="color: var(--secondary-text-color);">Monitorización en vivo del archivo <code>hikvision_lpr.log</code></p>

<div class="log-viewer-container">
    <div class="log-toolbar">
        <div class="status-indicator">
            <div id="log-status-light" class="status-light"></div>
            <span id="log-status-text">Conectando...</span>
        </div>
        <button id="pause-resume-btn" class="btn btn-secondary"><i class="fas fa-pause"></i> Pausar</button>
        <button id="clear-log-btn" class="btn btn-secondary"><i class="fas fa-ban"></i> Limpiar Pantalla</button>
        <div style="margin-left:auto; display:flex; align-items: center; gap: 0.5rem;">
            <label for="autoscroll-check">Auto-scroll</label>
            <input type="checkbox" id="autoscroll-check" checked>
        </div>
    </div>
    <div id="log-output" class="log-output"></div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const logOutput = document.getElementById('log-output');
    const statusLight = document.getElementById('log-status-light');
    const statusText = document.getElementById('log-status-text');
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const autoscrollCheck = document.getElementById('autoscroll-check');

    let lastSize = 0;
    let isPaused = false;
    let poller = null;

    function syntaxHighlight(line) {
        line = line.replace(/</g, "<").replace(/>/g, ">"); // Evitar que el navegador interprete el HTML
        
        // Resaltar palabras clave
        if (line.includes('FATAL_ERROR') || line.includes('DB_ERROR') || line.includes('WEBHOOK_FAIL')) {
            line = line.replace(/(FATAL_ERROR|DB_ERROR|WEBHOOK_FAIL|ERROR)/gi, '<span class="log-error">$1</span>');
        } else if (line.includes('WARN') || line.includes('NOT_MATCHED')) {
            line = line.replace(/(WARN|NOT_MATCHED|PARSE_ERROR)/gi, '<span class="log-warn">$1</span>');
        } else if (line.includes('SUCCESS') || line.includes('SAVED') || line.includes('MATCHED')) {
            line = line.replace(/(SUCCESS|SAVED|MATCHED)/gi, '<span class="log-success">$1</span>');
        } else if (line.includes('INFO')) {
            line = line.replace(/(INFO)/gi, '<span class="log-info">$1</span>');
        }

        // Resaltar timestamp
        line = line.replace(/^(\[[^\]]+\])/, '<span class="log-timestamp">$1</span>');
        
        return `<div class="log-line">${line}</div>`;
    }

    async function fetchLog() {
        if (isPaused) return;

        try {
            const response = await fetch(`get_log_data.php?last_size=${lastSize}`);
            const data = await response.json();

            if (data.success) {
                if (data.content) {
                    const highlightedContent = data.content
                        .split('\\n')
                        .map(syntaxHighlight)
                        .join('');
                    logOutput.innerHTML += highlightedContent;
                    
                    if (autoscrollCheck.checked) {
                        logOutput.scrollTop = logOutput.scrollHeight;
                    }
                }
                lastSize = data.new_size;
                statusLight.classList.add('live');
                statusText.textContent = 'En vivo';
            } else {
                logOutput.innerHTML += `<div class="log-line"><span class="log-error">ERROR: ${data.message}</span></div>`;
                pausePolling();
            }
        } catch (error) {
            console.error('Error fetching log:', error);
            logOutput.innerHTML += `<div class="log-line"><span class="log-error">ERROR: No se pudo conectar con el servidor.</span></div>`;
            pausePolling();
        }
    }

    function startPolling() {
        isPaused = false;
        pauseResumeBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        fetchLog(); // Llamada inicial
        if (!poller) {
            poller = setInterval(fetchLog, 3000); // Polling cada 3 segundos
        }
    }

    function pausePolling() {
        isPaused = true;
        pauseResumeBtn.innerHTML = '<i class="fas fa-play"></i> Reanudar';
        statusLight.classList.remove('live');
        statusText.textContent = 'Pausado';
    }

    pauseResumeBtn.addEventListener('click', () => {
        if (isPaused) {
            startPolling();
        } else {
            pausePolling();
        }
    });

    clearLogBtn.addEventListener('click', () => {
        logOutput.innerHTML = '';
    });

    // Iniciar al cargar
    startPolling();
});
</script>