<?php
/**
 * dashboard.php - "Geo-Spatial Command Center" v19.2 (Compatible y Completo)
 */

echo '<link rel="stylesheet" href="includes/css/dashboard.css">';

// --- NUEVA CONSULTA: Obtener cámaras CON COORDENADAS ---
$devices_on_map_query = $pdo->query("
    SELECT id, name, purpose, latitude, longitude 
    FROM devices 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
");
$devices_on_map = $devices_on_map_query->fetchAll(PDO::FETCH_ASSOC);

// --- NUEVA CONSULTA: Obtener TODOS los dispositivos para mapear nombre a ID en JS ---
$all_devices_query = $pdo->query("SELECT id, name FROM devices");
$all_devices = $all_devices_query->fetchAll(PDO::FETCH_ASSOC);

// Consultas de KPIs (no cambian)
$kpi_query = $pdo->query("SELECT (SELECT COUNT(*) FROM events WHERE event_type = 'entry' AND DATE(timestamp) = CURDATE()) as entries_today, (SELECT COUNT(*) FROM events WHERE event_type = 'exit' AND DATE(timestamp) = CURDATE()) as exits_today, (SELECT COUNT(*) FROM events WHERE decision = 'acceso_denegado' AND DATE(timestamp) = CURDATE()) as denied_today");
$kpis = $kpi_query->fetch(PDO::FETCH_ASSOC);

$latest_entries_query = $pdo->query("SELECT plate, o.name as owner_name, timestamp, image_path FROM events e LEFT JOIN owners o ON e.vehicle_id = o.id WHERE e.event_type = 'entry' ORDER BY e.timestamp DESC LIMIT 10");
$latest_entries = $latest_entries_query->fetchAll(PDO::FETCH_ASSOC);

$latest_exits_query = $pdo->query("SELECT plate, o.name as owner_name, timestamp, image_path FROM events e LEFT JOIN owners o ON e.vehicle_id = o.id WHERE e.event_type = 'exit' ORDER BY e.timestamp DESC LIMIT 10");
$latest_exits = $latest_exits_query->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="command-dashboard">

    <!-- Fila 1: KPIs -->
    <div class="kpi-header">
        <div class="widget kpi-widget">
            <div class="kpi-content">
                <div class="icon icon-entries"><i class="fas fa-arrow-right"></i></div>
                <div>
                    <div class="value" id="entries-today-value"><?= $kpis['entries_today'] ?></div>
                    <div class="label">Entradas Hoy</div>
                </div>
            </div>
        </div>
        <div class="widget kpi-widget">
            <div class="kpi-content">
                <div class="icon icon-exits"><i class="fas fa-arrow-left"></i></div>
                <div>
                    <div class="value" id="exits-today-value"><?= $kpis['exits_today'] ?></div>
                    <div class="label">Salidas Hoy</div>
                </div>
            </div>
        </div>
        <div class="widget kpi-widget">
            <div class="kpi-content">
                <div class="icon icon-denied"><i class="fas fa-ban"></i></div>
                <div>
                    <div class="value" id="denied-today-value"><?= $kpis['denied_today'] ?></div>
                    <div class="label">Accesos Denegados Hoy</div>
                </div>
            </div>
        </div>
        <div class="widget kpi-widget">
             <div class="kpi-content">
                <div class="icon icon-gates"><i class="fas fa-traffic-light"></i></div>
                <div>
                    <div class="value" id="gate-opens-value">0</div>
                    <div class="label">Aperturas Manuales</div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Columna Izquierda: Feed de Entradas -->
    <div class="feed-column" id="entry-feed-column">
        <div class="widget feed-widget">
            <div class="widget-header"><h3 class="widget-title"><i class="fas fa-sign-in-alt"></i> Entradas Recientes</h3></div>
            <div class="capture-feed-container" id="entry-capture-feed">
                 <?php foreach ($latest_entries as $event): ?>
                    <?php $image_url = !empty($event['image_path']) && file_exists(APP_ROOT . '/' . $event['image_path']) ? '/LPR/' . $event['image_path'] : 'images/placeholder.jpg'; ?>
                    <div class="capture-card" style="background-image: url('<?= htmlspecialchars($image_url) ?>');">
                        <div class="overlay">
                            <div class="info-block">
                                <div class="styled-plate-mercosur">
                                    <div class="plate-inner">
                                        <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                                        <div class="plate-number"><?= htmlspecialchars($event['plate']) ?></div>
                                    </div>
                                </div>
                                <div class="owner"><?= htmlspecialchars($event['owner_name'] ?? 'No asignado') ?></div>
                            </div>
                            <div class="time-stamp"><?= (new DateTime($event['timestamp']))->format('H:i:s') ?></div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <!-- Área Central: Mapa -->
    <div class="map-main-area">
        <div id="dashboard-map"></div>
    </div>

    <!-- Columna Derecha: Feed de Salidas -->
    <div class="feed-column" id="exit-feed-column">
        <div class="widget feed-widget">
            <div class="widget-header"><h3 class="widget-title"><i class="fas fa-sign-out-alt"></i> Salidas Recientes</h3></div>
            <div class="capture-feed-container" id="exit-capture-feed">
                <?php foreach ($latest_exits as $event): ?>
                    <?php $image_url = !empty($event['image_path']) && file_exists(APP_ROOT . '/' . $event['image_path']) ? '/LPR/' . $event['image_path'] : 'images/placeholder.jpg'; ?>
                    <div class="capture-card" style="background-image: url('<?= htmlspecialchars($image_url) ?>');">
                        <div class="overlay">
                            <div class="info-block">
                                <div class="styled-plate-mercosur">
                                    <div class="plate-inner">
                                        <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                                        <div class="plate-number"><?= htmlspecialchars($event['plate']) ?></div>
                                    </div>
                                </div>
                                <div class="owner"><?= htmlspecialchars($event['owner_name'] ?? 'No asignado') ?></div>
                            </div>
                            <div class="time-stamp"><?= (new DateTime($event['timestamp']))->format('H:i:s') ?></div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

</div>

<!-- Pasar AMBAS listas de dispositivos a JavaScript -->
<script>
    const devicesOnMap = <?= json_encode($devices_on_map) ?>;
    const allDevicesForMapping = <?= json_encode($all_devices) ?>;
</script>
<script src="includes/js/dashboard.js"></script>