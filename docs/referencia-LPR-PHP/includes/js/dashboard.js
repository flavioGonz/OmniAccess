// includes/js/dashboard.js - v19.5 (Forzando No-Caché y Ordenación en Frontend)

if (!window.isDashboardInitialized) {
    window.isDashboardInitialized = true;

    document.addEventListener('DOMContentLoaded', function() {
        console.log('Inicializando Geo-Spatial Dashboard con Feeds en Vivo (v19.5)...');

        let map = null;
        let displayedEventIds = new Set();
        let cameraMarkers = {};

        const deviceNameToIdMap = new Map();
        if (typeof allDevicesForMapping !== 'undefined' && Array.isArray(allDevicesForMapping)) {
            allDevicesForMapping.forEach(device => {
                deviceNameToIdMap.set(device.name, device.id);
            });
        }

        function initMap() {
            try {
                if (map) map.remove();

                map = L.map('dashboard-map', {
                    zoomControl: false, dragging: false, scrollWheelZoom: false,
                    doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false
                }).setView([-34.907123, -54.838573], 19);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap © CARTO',
                    maxZoom: 20
                }).addTo(map);

                if (typeof devicesOnMap !== 'undefined' && Array.isArray(devicesOnMap)) {
                    devicesOnMap.forEach(device => {
                        const iconHtml = `<div class="pulse-ring"></div><div class="icon-dot"></div><div class="event-tooltip" id="tooltip-${device.id}"></div>`;
                        const cameraIcon = L.divIcon({
                            html: iconHtml,
                            className: 'camera-marker-icon pending',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        });
                        const marker = L.marker([device.latitude, device.longitude], { icon: cameraIcon })
                            .addTo(map)
                            .bindTooltip(device.name, {permanent: false, direction: 'top'});
                        cameraMarkers[device.id] = marker;
                    });
                }
            } catch (e) {
                console.error("Error al inicializar el mapa:", e);
                document.getElementById('dashboard-map').innerHTML = '<p class="message error">No se pudo cargar el mapa.</p>';
            }
        }

        function showEventTooltip(deviceId, plate) {
            const tooltipElement = document.getElementById(`tooltip-${deviceId}`);
            if (!tooltipElement) return;
            tooltipElement.innerHTML = `<div class="styled-plate-mercosur"><div class="plate-inner"><div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div><div class="plate-number">${plate}</div></div></div>`;
            tooltipElement.classList.add('active');
            setTimeout(() => {
                tooltipElement.classList.remove('active');
            }, 5000);
        }

        function createCaptureCard(event) {
            const imageUrl = event.image_path || 'images/placeholder.jpg';
            const owner = event.owner_name || 'Desconocido';
            const time = new Date(event.datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const card = document.createElement('div');
            card.className = 'capture-card';
            card.style.backgroundImage = `url('${imageUrl}')`;
            card.innerHTML = `
                <div class="overlay">
                    <div class="info-block">
                        <div class="styled-plate-mercosur">
                            <div class="plate-inner">
                                <div class="plate-header"><span>MERCOSUR</span><span>ARG</span></div>
                                <div class="plate-number">${event.plate}</div>
                            </div>
                        </div>
                        <div class="owner">${owner}</div>
                    </div>
                    <div class="time-stamp">${time}</div>
                </div>`;
            return card;
        }

        async function mainUpdateLoop() {
            try {
                // --- CORRECCIÓN 1: Forzar la no-caché con un timestamp ---
                const timestamp = new Date().getTime();
                const [liveResponse, devResponse] = await Promise.all([
                    fetch(`get_live_data.php?t=${timestamp}`), // Se añade parámetro aleatorio
                    fetch(`check_devices_status.php?t=${timestamp}`)
                ]);
                const liveData = await liveResponse.json();
                const devStatuses = await devResponse.json();

                // Actualizar marcadores del mapa
                devStatuses.forEach(deviceStatus => {
                    const marker = cameraMarkers[deviceStatus.id];
                    if (marker && marker.getElement()) {
                        const iconElement = marker.getElement();
                        iconElement.classList.remove('online', 'offline', 'pending');
                        const statusClass = deviceStatus.status === 'ok' ? 'online' : 'offline';
                        iconElement.classList.add(statusClass);
                    }
                });

                if (liveData.events) {
                    const entryFeed = document.getElementById('entry-capture-feed');
                    const exitFeed = document.getElementById('exit-capture-feed');
                    
                    if (entryFeed.querySelector('.message')) entryFeed.innerHTML = '';
                    if (exitFeed.querySelector('.message')) exitFeed.innerHTML = '';

                    // --- CORRECCIÓN 2: Asegurar el orden en el frontend ---
                    const sortedEvents = liveData.events.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

                    // Invertir el array para procesar los más viejos primero y usar .prepend()
                    sortedEvents.reverse().forEach(event => {
                        if (!displayedEventIds.has(event.id)) {
                            const card = createCaptureCard(event);
                            const container = event.device_name.toLowerCase().includes('entrada') ? entryFeed : exitFeed;
                            
                            if (container) {
                                container.prepend(card); // Añadir al principio
                            }
                            
                            displayedEventIds.add(event.id);
                            
                            const deviceId = deviceNameToIdMap.get(event.device_name);
                            if (deviceId) {
                                showEventTooltip(deviceId, event.plate);
                            }
                        }
                    });
                    
                    // Limitar el número de tarjetas después de añadir las nuevas
                    while (entryFeed.children.length > 10) {
                        entryFeed.removeChild(entryFeed.lastChild);
                    }
                    while (exitFeed.children.length > 10) {
                        exitFeed.removeChild(exitFeed.lastChild);
                    }
                }
            } catch (error) {
                console.error("Error en el bucle de actualización:", error);
            }
        }
        
        // --- EJECUCIÓN INICIAL ---
        initMap();
        mainUpdateLoop();
        setInterval(mainUpdateLoop, 5000);
    });
}