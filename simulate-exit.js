const http = require('http');

const xmlData = `
<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <ipAddress>192.168.1.65</ipAddress>
    <dateTime>${new Date().toISOString()}</dateTime>
    <ANPR>
        <licensePlate>EXIT999</licensePlate>
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
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(xmlData);
req.end();
