const http = require('http');
const process = require('process');

// Disable SSL verification for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('🚀 Simulando webhooks de prueba...\n');

// Simulate Hikvision LPR Event
function simulateHikvision() {
    const xmlData = `
<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <ipAddress>192.168.1.64</ipAddress>
    <dateTime>${new Date().toISOString()}</dateTime>
    <ANPR>
        <licensePlate>ABC123</licensePlate>
        <country>ARG</country>
        <confidence>95</confidence>
    </ANPR>
</EventNotificationAlert>
`;

    const options = {
        hostname: 'localhost',
        port: 10000,
        path: '/api/webhooks/hikvision',
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml',
            'Content-Length': Buffer.byteLength(xmlData)
        },
        rejectUnauthorized: false
    };

    console.log('📹 Enviando evento Hikvision LPR...');
    const req = http.request(options, (res) => {
        console.log(`   ✅ STATUS: ${res.statusCode}`);
        res.on('data', (chunk) => {
            console.log(`   📦 RESPONSE: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`   ❌ ERROR: ${e.message}`);
    });

    req.write(xmlData);
    req.end();
}

// Simulate Akuvox Card Event
function simulateAkuvox() {
    const options = {
        hostname: 'localhost',
        port: 10000,
        path: '/api/webhooks/akuvox?event=card_valid&mac=00:11:22:33:44:55&card=1234567890',
        method: 'GET',
        rejectUnauthorized: false
    };

    console.log('\n🔑 Enviando evento Akuvox (Tarjeta Válida)...');
    const req = http.request(options, (res) => {
        console.log(`   ✅ STATUS: ${res.statusCode}`);
        res.on('data', (chunk) => {
            console.log(`   📦 RESPONSE: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`   ❌ ERROR: ${e.message}`);
    });

    req.end();
}

// Simulate Akuvox Door Open
function simulateAkuvoxDoor() {
    const options = {
        hostname: 'localhost',
        port: 10000,
        path: '/api/webhooks/akuvox?event=door_open&mac=00:11:22:33:44:55',
        method: 'GET',
        rejectUnauthorized: false
    };

    console.log('\n🚪 Enviando evento Akuvox (Puerta Abierta)...');
    const req = http.request(options, (res) => {
        console.log(`   ✅ STATUS: ${res.statusCode}`);
        res.on('data', (chunk) => {
            console.log(`   📦 RESPONSE: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`   ❌ ERROR: ${e.message}`);
    });

    req.end();
}

// Execute simulations
simulateHikvision();

setTimeout(() => {
    simulateAkuvox();
}, 1000);

setTimeout(() => {
    simulateAkuvoxDoor();
}, 2000);

setTimeout(() => {
    console.log('\n✨ Simulación completada. Verifica el dashboard y la página de debug.');
}, 3000);
