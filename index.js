const url = require('url');
const fs = require('fs');
let { createServer } = require('http');
let { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8989;
const expiryDurationMs = 60 * 1000;
let SERVER_URL = process.env.SERVER_URL || 'http://localhost:8989';
let SERVER_ERROR_ENABLED = false;

const easWSMessage = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS/CAP-NET-IN-88546.json',
        },
    },
});
const easWSMessage2 = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS/CAP-NET-IN-88547.json',
        },
    },
});
const easWSMessage3 = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS3/CAP-NET-IN-88547.json',
        },
    },
});
const easWSMessageNoAudio = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS/CAP-NET-IN-88548.json',
        },
    },
});

const easMessage = (serverUrl = SERVER_URL) => ({
    info: {
        resource: [{
            resourceDesc: 'EAS Broadcast Content',
            uri: serverUrl + '/EAS3/cap_eas_alert_audio_70815.mp3',
            mimeType: 'audio/x-ipaws-audio-mp3',
        }],
        parameter: [{
            valueName: 'EASText',
            value: 'A broadcast or cable system has issued A REQUIRED WEEKLY TEST for the following counties/areas: Broomfield, CO; at 8:23 PM on NOV 12, 2018 Effective until 8:38 PM. Message from WCOL. testing product - 11-12-2018testing product - 11-12-2018',
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).toUTCString()
    },
});
const easMessage2 = () => ({
    info: {
        resource: [{
            resourceDesc: 'EAS Broadcast Content',
            uri: 'https://pqi-ppe-cdn.enwd.co.sa.charterlab.com/EAS3/cap_eas_alert_audio_70815.mp3',
            mimeType: 'audio/x-ipaws-audio-mp3',
        }],
        parameter: [{
            valueName: 'EASText',
            value: 'A broadcast or cable system has issued A REQUIRED WEEKLY TEST for the following counties/areas: Broomfield, CO; at 8:23 PM on NOV 12, 2018 Effective until 8:38 PM. Message from WCOL. testing product - 11-12-2018testing product - 11-12-2018',
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).toUTCString()
    },
});

const easMessageNoAudio = () => ({
    info: {
        resource: [{
            resourceDesc: 'EAS Broadcast Content',
            uri: '',
            mimeType: 'audio/x-ipaws-audio-mp3',
        }],
        parameter: [{
            valueName: 'EASText',
            value: 'A broadcast or cable system has issued A REQUIRED WEEKLY TEST for the following counties/areas: Broomfield, CO; at 8:23 PM on NOV 12, 2018 Effective until 8:38 PM. Message from WCOL. testing product - 11-12-2018testing product - 11-12-2018',
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).toUTCString()
    },
});

let wss;
let allWSConnection = true;

function sendEASMessage() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessage()));
    });
}
function sendEASMessage2() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessage2()));
    });
}
function sendEASMessage3() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessage3()));
    });
}
function sendEASMessageNoAudio() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessageNoAudio()));
    });
}

function closeAllWS(error='3000') {
    allWSConnection = false;
    wss.clients.forEach(socket => {
        socket.close(+error);
    });
}

const server = createServer((req, resp) => {
    // Set CORS headers
    resp.setHeader('Access-Control-Allow-Origin', '*');
    resp.setHeader('Access-Control-Request-Method', 'OPTIONS, POST, GET');
    // resp.setHeader('Access-Control-Allow-Methods', '*');
    resp.setHeader('Access-Control-Allow-Credentials', true);
    resp.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, device_id, x-trace-id');
    resp.setHeader('Access-Control-Expose-Headers', 'x-trace-id')
    resp.setHeader('x-trace-id', '7e9a43c0a065-1d9c-000000000007981f');
    if ( resp.method === 'OPTIONS' ) {
        resp.writeHead(204);
        resp.end();
        return;
    }

    // get query params
    const queryObject = url.parse(req.url,true).query;
    SERVER_URL = queryObject.url || SERVER_URL;

    if(req.url.endsWith('46.json')) {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(easMessage()), 'utf-8');
    } else if(req.url.endsWith('47.json')) {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(easMessage2()), 'utf-8');
    } else if(req.url.endsWith('48.json')) {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(easMessageNoAudio()), 'utf-8');
    } else if(req.url.endsWith('sendeasnoaudio')) {
        sendEASMessageNoAudio();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(req.url.endsWith('sendeas2')) {
        sendEASMessage2();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(req.url.endsWith('sendeas3')) {
        sendEASMessage3();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(req.url.endsWith('sendeas')) {
        sendEASMessage();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(req.url.endsWith('closewss')) {
        closeAllWS(queryObject.error);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server closed');
    } else if(req.url.endsWith('closewss?error=1007')) {
        closeAllWS('1007');
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server closed');
    } else if(req.url.endsWith('openwss')) {
        allWSConnection = true;
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server opened');
    } else if(req.url.endsWith('client')) {
        // server html file
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        // read file
        const file = fs.readFileSync('./client.html', 'utf8');
        resp.end(file, 'utf-8');
    } else if(req.url.endsWith('.mp3')) {
        // server mp3 file
        const contentType = 'audio/mpeg';
        const fileStats = fs.statSync('eas.mp3');
        resp.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileStats.size });
        // read file
        const fileStream = fs.createReadStream('eas.mp3');
        fileStream.pipe(resp);
    } else if(req.url.endsWith('toggleerror')) {
        SERVER_ERROR_ENABLED = !SERVER_ERROR_ENABLED;
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify({id: '0123456789', expiryTime: (new Date(Date.now() + (24 * 3600000)).toISOString())}), 'utf-8');
    }
});

wss = new WebSocketServer({ server, clientTracking: true });

// wss.on('connection', function connection(ws) {
//     ws.on('message', function incoming(message) {
//         console.log('received: %s', message);
//     });
// });

wss.shouldHandle = () => allWSConnection;

server.listen(PORT);

console.log(`Server listening on port ${PORT} ...`);
