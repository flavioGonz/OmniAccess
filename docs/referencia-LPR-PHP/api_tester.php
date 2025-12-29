<?php
/**
 * api_tester.php - Laboratorio de Pruebas para la API ISAPI de Hikvision
 *
 * Versión 3.1: Añadida la opción para cerrar la barrera.
 */

require_once __DIR__ . '/config.php';

$pdo = null;
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $cameras = $pdo->query("SELECT id, name, ip, username, password FROM devices ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Error de conexión a la base de datos: " . $e->getMessage());
}

$response_http_code = null; $response_headers = ''; $response_body = ''; $request_url = ''; $curl_error = '';
$connection_type = 'db'; $camera_id = ''; $manual_ip = ''; $manual_user = ''; $manual_pass = '';
$endpoint = ''; $method = 'GET'; $request_body = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $connection_type = $_POST['connection_type'] ?? 'db';
    $endpoint = $_POST['endpoint'] ?? '';
    $method = $_POST['method'] ?? 'GET';
    $request_body = $_POST['request_body'] ?? '';

    $target_ip = ''; $target_user = ''; $target_pass = '';

    if ($connection_type === 'db') {
        $camera_id = $_POST['camera_id'] ?? null;
        foreach ($cameras as $cam) {
            if ($cam['id'] == $camera_id) {
                $target_ip = $cam['ip'];
                $target_user = $cam['username'];
                $target_pass = $cam['password'];
                break;
            }
        }
    } else { // Manual connection
        $manual_ip = $_POST['manual_ip'] ?? '';
        $manual_user = $_POST['manual_user'] ?? '';
        $manual_pass = $_POST['manual_pass'] ?? '';
        $target_ip = $manual_ip;
        $target_user = $manual_user;
        $target_pass = $manual_pass;
    }

    if (!empty($target_ip) && !empty($target_user) && !empty($endpoint)) {
        $request_url = "http://{$target_ip}{$endpoint}";
        $ch = curl_init();
        $curl_options = [
            CURLOPT_URL => $request_url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
            CURLOPT_USERPWD => "{$target_user}:{$target_pass}",
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HEADER => true,
        ];
        switch (strtoupper($method)) {
            case 'POST': $curl_options[CURLOPT_POST] = true; $curl_options[CURLOPT_POSTFIELDS] = $request_body; break;
            case 'PUT': $curl_options[CURLOPT_CUSTOMREQUEST] = "PUT"; $curl_options[CURLOPT_POSTFIELDS] = $request_body; break;
            case 'DELETE': $curl_options[CURLOPT_CUSTOMREQUEST] = "DELETE"; break;
        }
        if (!empty($request_body)) { $curl_options[CURLOPT_HTTPHEADER] = ['Content-Type: application/xml']; }
        curl_setopt_array($ch, $curl_options);
        $full_response = curl_exec($ch);
        $curl_error = curl_error($ch);
        if (!$curl_error) {
            $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $response_http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $response_headers = substr($full_response, 0, $header_size);
            $response_body = substr($full_response, $header_size);
        }
        curl_close($ch);
    } else {
        $curl_error = "Error: Faltan datos de conexión (IP, Usuario) o el endpoint.";
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ISAPI API Tester</title>
    <link rel="stylesheet" href="style.css">
    <style>
        body { background-color: #1a1a1a; }
        .tester-container { max-width: 900px; margin: 2rem auto; }
        .form-section, .response-section { background-color: var(--surface-color); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
        h1, h2 { border-bottom: 2px solid var(--primary-yellow); padding-bottom: 0.5rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        #endpoint { font-family: 'Roboto Mono', monospace; }
        textarea { width: 100%; box-sizing: border-box; min-height: 150px; font-family: 'Roboto Mono', monospace; background-color: #1d1d1d; color: #f0f0f0; border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; }
        pre { background-color: #1d1d1d; color: #a9b7c6; padding: 1rem; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color); }
        .url-display { background-color: var(--input-background); padding: 0.5rem; border-radius: 4px; font-family: 'Roboto Mono', monospace; word-break: break-all; }
        .http-code { font-weight: bold; padding: 0.2rem 0.5rem; border-radius: 4px; }
        .http-code.ok { background-color: var(--decision-green); color: white; }
        .http-code.error { background-color: var(--decision-red); color: white; }
        .radio-group { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
        @media(max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body class="dark-theme">

    <div class="tester-container">
        <h1><i class="fas fa-vial"></i> Laboratorio de API ISAPI</h1>

        <div class="form-section">
            <h2>Construir Petición</h2>
            <form action="api_tester.php" method="POST" id="api-form">
                
                <div class="form-group">
                    <label>1. Tipo de Conexión</label>
                    <div class="radio-group">
                        <label><input type="radio" name="connection_type" value="db" <?php echo ($connection_type === 'db') ? 'checked' : ''; ?>> Cámara Guardada</label>
                        <label><input type="radio" name="connection_type" value="manual" <?php echo ($connection_type === 'manual') ? 'checked' : ''; ?>> Conexión Manual</label>
                    </div>
                </div>

                <div id="db-connection-fields" class="form-group">
                    <label for="camera_id">Seleccionar Cámara</label>
                    <select name="camera_id" id="camera_id" class="form-control">
                        <option value="">-- Elija una cámara --</option>
                        <?php foreach ($cameras as $camera): ?>
                            <option value="<?php echo $camera['id']; ?>" <?php echo ($camera_id == $camera['id']) ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($camera['name']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div id="manual-connection-fields">
                    <div class="form-group">
                        <label for="manual_ip">IP y Puerto</label>
                        <input type="text" name="manual_ip" id="manual_ip" class="form-control" placeholder="ej: 190.180.170.160:8081" value="<?php echo htmlspecialchars($manual_ip); ?>">
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="manual_user">Usuario</label>
                            <input type="text" name="manual_user" id="manual_user" class="form-control" value="<?php echo htmlspecialchars($manual_user); ?>">
                        </div>
                        <div class="form-group">
                            <label for="manual_pass">Contraseña</label>
                            <input type="password" name="manual_pass" id="manual_pass" class="form-control" value="<?php echo htmlspecialchars($manual_pass); ?>">
                        </div>
                    </div>
                </div>

                <hr style="border-color: var(--border-color); margin: 2rem 0;">

                <div class="form-group">
                    <label for="predefined_endpoint">2. Endpoints Predefinidos (Opcional)</label>
                    <select id="predefined_endpoint" class="form-control">
                        <option value="">-- Seleccionar una prueba rápida --</option>
                        <option value="get_time">Leer Hora del Sistema</option>
                        <option value="trigger_barrier_open">Abrir Barrera (Relé 1)</option>
                        <option value="trigger_barrier_close">Cerrar Barrera (Relé 1)</option> <!-- ¡NUEVO! -->
                        <option value="add_plate">Añadir Matrícula a Lista Blanca</option>
                        <option value="delete_plate">Borrar Matrícula de Lista Blanca</option>
                        <option value="session_heartbeat">Mantener Sesión (Heartbeat)</option>
                        <option value="get_event_triggers">Ver Triggers de Eventos</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="endpoint">3. Endpoint de la API</label>
                    <input type="text" name="endpoint" id="endpoint" class="form-control" value="<?php echo htmlspecialchars($endpoint); ?>" required>
                </div>
                 <div class="form-group">
                    <label for="method">4. Método HTTP</label>
                    <select name="method" id="method" class="form-control" required>
                        <option value="GET" <?php echo ($method == 'GET') ? 'selected' : ''; ?>>GET</option>
                        <option value="POST" <?php echo ($method == 'POST') ? 'selected' : ''; ?>>POST</option>
                        <option value="PUT" <?php echo ($method == 'PUT') ? 'selected' : ''; ?>>PUT</option>
                        <option value="DELETE" <?php echo ($method == 'DELETE') ? 'selected' : ''; ?>>DELETE</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="request_body">5. Cuerpo de la Petición</label>
                    <textarea name="request_body" id="request_body"><?php echo htmlspecialchars($request_body); ?></textarea>
                </div>
                <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Enviar Petición</button>
            </form>
        </div>

        <?php if ($_SERVER['REQUEST_METHOD'] === 'POST'): ?>
        <div class="response-section">
            <h2>Resultado</h2>
            <div class="form-group"><label>URL Completa:</label><div class="url-display"><?php echo htmlspecialchars($request_url); ?></div></div>
            <?php if (!empty($curl_error)): ?>
                <h3>Error de cURL o Configuración</h3><pre style="color: var(--decision-red);"><?php echo htmlspecialchars($curl_error); ?></pre>
            <?php else: ?>
                <div class="form-group"><label>Código HTTP:</label><div><span class="http-code <?php echo ($response_http_code >= 200 && $response_http_code < 300) ? 'ok' : 'error'; ?>"><?php echo $response_http_code; ?></span></div></div>
                <h3>Encabezados (Headers)</h3><pre><?php echo htmlspecialchars($response_headers); ?></pre>
                <h3>Cuerpo (Body)</h3><pre><?php
                    if (!empty($response_body)) {
                        $dom = new DOMDocument; $dom->preserveWhiteSpace = false; $dom->formatOutput = true;
                        if (@$dom->loadXML($response_body)) { echo htmlspecialchars($dom->saveXML()); } 
                        else { echo htmlspecialchars($response_body); }
                    } else { echo "(Respuesta vacía)"; }
                ?></pre>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const connectionTypeRadios = document.querySelectorAll('input[name="connection_type"]');
    const dbFields = document.getElementById('db-connection-fields');
    const manualFields = document.getElementById('manual-connection-fields');

    function toggleConnectionFields() {
        if (document.querySelector('input[name="connection_type"]:checked').value === 'db') {
            dbFields.style.display = 'block';
            manualFields.style.display = 'none';
        } else {
            dbFields.style.display = 'none';
            manualFields.style.display = 'block';
        }
    }

    connectionTypeRadios.forEach(radio => radio.addEventListener('change', toggleConnectionFields));
    toggleConnectionFields();

    const predefinedEndpoints = {
        'get_time': { endpoint: '/ISAPI/System/time', method: 'GET', body: '' },
        'trigger_barrier_open': { endpoint: '/ISAPI/System/IO/outputs/1/trigger', method: 'PUT', body: '<IOCtrl>\\n \\t<id>1</id>\\n \\t<outputState>high</outputState>\\n</IOCtrl>' },
        'trigger_barrier_close': { endpoint: '/ISAPI/System/IO/outputs/1/trigger', method: 'PUT', body: '<IOCtrl>\\n \\t<id>1</id>\\n \\t<outputState>low</outputState>\\n</IOCtrl>' }, // ¡NUEVO!
        'add_plate': {
    endpoint: '/ISAPI/Traffic/channels/1/licensePlateAuditData/record?format=json',
    method: 'PUT',
    // Usamos el formato exacto que capturaste. Las barras invertidas (\) son para escapar las comillas dentro de la cadena de JavaScript.
    body: '{"LicensePlateInfoList":[{"LicensePlate":"APIADD1","listType":"whiteList","createTime":"2025-08-09T12:00:00","effectiveStartDate":"2025-08-09","effectiveTime":"2025-09-08","id":""}]}'
},
        'delete_plate': { endpoint: '/ISAPI/AccessControl/vehicleRecord/plateNo/TEST123?format=json', method: 'DELETE', body: '' },
        'session_heartbeat': { endpoint: '/ISAPI/Security/sessionHeartbeat', method: 'GET', body: '' },
        'get_event_triggers': { endpoint: '/ISAPI/Event/triggers/vehicledetection-1', method: 'GET', body: '' }
    };
    
    const selector = document.getElementById('predefined_endpoint');
    const endpointInput = document.getElementById('endpoint');
    const methodSelect = document.getElementById('method');
    const bodyTextarea = document.getElementById('request_body');

    selector.addEventListener('change', function() {
        const selectedKey = this.value;
        if (predefinedEndpoints[selectedKey]) {
            const data = predefinedEndpoints[selectedKey];
            endpointInput.value = data.endpoint;
            methodSelect.value = data.method;
            bodyTextarea.value = data.body.replace(/\\n/g, '\\n').replace(/\\t/g, '\\t');
        } else {
            endpointInput.value = '';
            methodSelect.value = 'GET';
            bodyTextarea.value = '';
        }
    });
});
</script>

</body>
</html>