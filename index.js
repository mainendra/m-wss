import { parse } from 'url';
import { readFileSync, statSync, createReadStream, existsSync } from 'fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8989;
const expiryDurationMs = 60 * 1000;
let SERVER_URL = process.env.SERVER_URL || 'http://localhost:8989';
let SERVER_ERROR_ENABLED = false;
const DEFAULT_EAN_URL = 'https://livesim.dashif.org/livesim/chunkdur_1/ato_7/testpic4_8s/Manifest.mpd';
const DEFAULT_EAS_MESSAGE = 'A broadcast or cable system has issued A REQUIRED WEEKLY TEST for the following counties/areas: Broomfield, CO; at 8:23 PM on NOV 12, 2018 Effective until 8:38 PM. Message from WCOL. testing product - 11-12-2018testing product - 11-12-2018';
let EAN_URL;
const EAS_ID_MESSAGE_MAP = {};

let apiconfig;

const easWSMessageWrongUrl = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS/CAP-NET-IN-88546-wrong-url.json',
        },
    },
});
const easWSMessageCORSUrl = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAS/CAP-NET-IN-88546-cors-url.json',
        },
    },
});
const easWSMessage = (serverUrl = SERVER_URL,durationMs = expiryDurationMs, messageId) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + `/EAS/CAP-NET-IN-${messageId || ''}-88546.json`,
        },
    },
    'message-id': messageId || `${Date.now()}`,
    expirationTime: (new Date(Date.now() + durationMs)).getTime(),
    type: 'Alert',
    subType: 'eas'
});
const eanWSMessage3 = (serverUrl = SERVER_URL, durationMs = expiryDurationMs, messageId, update, ignoreExpiry) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAN/CAP-NET-IN-99000.json',
        },
    },
    expirationTime: ignoreExpiry ? undefined : (new Date(Date.now() + durationMs)).getTime(),
    type: update ? 'Update' : 'Alert',
    subType: 'EAN',
    'message-id': messageId || `${Date.now()}`
});
const eanWSMessageWrongUrl = (serverUrl = SERVER_URL) => ({
    GenericMessage: {
        SecureContent: {
            Location: serverUrl + '/EAN/CAP-NET-IN-88444_WrongUrl.json',
        },
    },
    expirationTime: (new Date(Date.now() + expiryDurationMs)).getTime(),
    type: 'Alert',
    subType: 'EAN',
    'message-id': `${Date.now()}`
});
const eanMessage3 = () => ({
    info: {
        resource: [{
            resourceDesc: 'EAN DASH Content',
            uri: EAN_URL,
            mimeType: 'video/DASH',
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).getTime()
    },
});
const eanMessageWrongUrl = () => ({
    info: {
        resource: [{
            resourceDesc: 'EAN DASH Content',
            uri: 'https://livesim.dashif.org/livesim/chunkdur_1/ato_7/testpic4_8s8989/Manifest.mpd',
            mimeType: 'video/DASH',
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).getTime()
    },
});


const easMessage = (serverUrl = SERVER_URL, messageId) => ({
    info: {
        resource: [{
            resourceDesc: 'EAS Broadcast Content',
            uri: EAS_ID_MESSAGE_MAP[messageId]?.audio ? serverUrl + '/EAS3/cap_eas_alert_audio_70815.mp3' : '',
            mimeType: 'audio/x-ipaws-audio-mp3',
        }],
        parameter: [{
            valueName: 'EASText',
            value: (EAS_ID_MESSAGE_MAP[messageId]?.message || DEFAULT_EAS_MESSAGE) + ' - ' + (new Date(Date.now() + expiryDurationMs)).toUTCString(),
        }],
        expires: (new Date(Date.now() + expiryDurationMs)).getTime(),
    },
});

let wss;
let allWSConnection = true;

function sendEASMessageCORSUrl() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessageCORSUrl()));
    });
}
function sendEASMessageWrongUrl() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessageWrongUrl()));
    });
}
function sendEASMessage(durationMs, messageId) {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(easWSMessage(SERVER_URL, durationMs, messageId)));
    });
}
function sendAltCustExpMessage(msgStr) {
    wss.clients.forEach(socket => {
        socket.send(msgStr);
    });
}
function sendEANMessage3(durationMs, messageId, update, ignoreExpiry) {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(eanWSMessage3(SERVER_URL, durationMs, messageId, update, ignoreExpiry)));
    });
}
function sendEANMessageWrongUrl() {
    wss.clients.forEach(socket => {
        socket.send(JSON.stringify(eanWSMessageWrongUrl()));
    });
}

function closeAllWS(error='3000') {
    allWSConnection = false;
    wss.clients.forEach(socket => {
        socket.close(+error);
    });
}

function errorAllWS() {
    allWSConnection = false;
    wss.clients.forEach(socket => {
        socket.send(new Error('Simulated WebSocket error'));
    });
}

const server = createServer((req, resp) => {
    // Set CORS headers
    resp.setHeader('Access-Control-Allow-Origin', '*');
    resp.setHeader('Access-Control-Request-Method', 'OPTIONS, POST, GET');
    // resp.setHeader('Access-Control-Allow-Methods', '*');
    resp.setHeader('Access-Control-Allow-Credentials', true);
    resp.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, device_id, x-trace-id, x-client-quantum-visit-id, x-client-version, x-client-os-version, x-client-id, x-client-device-id');
    resp.setHeader('Access-Control-Expose-Headers', 'x-trace-id')
    resp.setHeader('x-trace-id', '7e9a43c0a065-1d9c-000000000007981f');
    if ( resp.method === 'OPTIONS' ) {
        resp.writeHead(204);
        resp.end();
        return;
    }

    // get query params
    const queryObject = parse(req.url,true).query;
    SERVER_URL = queryObject.url || SERVER_URL;

    const reqUrl = req.url.split('?')[0]; // ignore query param

    if (reqUrl.endsWith('cors-url.json')) {
        resp.removeHeader('Access-Control-Allow-Headers');
        resp.removeHeader('Access-Control-Allow-Origin');
        const contentType = 'text/html';
        resp.writeHead(404, { 'Content-Type': contentType });
        resp.end();
        return;
    } else if (reqUrl.endsWith('wrong-url.json')) {
        const contentType = 'text/html';
        resp.writeHead(404, { 'Content-Type': contentType });
        resp.end();
        return;
    } else if(reqUrl.endsWith('99000.json')) {
        if (SERVER_ERROR_ENABLED || !EAN_URL) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(eanMessage3()), 'utf-8');
    } else if(reqUrl.endsWith('88444_WrongUrl.json')) {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }
        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(eanMessageWrongUrl()), 'utf-8');
    } else if(reqUrl.endsWith('46.json')) {
        if (SERVER_ERROR_ENABLED) {
            const contentType = 'text/html';
            resp.writeHead(503, { 'Content-Type': contentType });
            resp.end();
            return;
        }

        // get messageID
        const match = reqUrl.match(/IN-(.*?)-88546/);
        const messageId = match?.[1];

        const contentType = 'application/json';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end(JSON.stringify(easMessage(SERVER_URL, messageId)), 'utf-8');
        // cleanup
        delete EAS_ID_MESSAGE_MAP[messageId];
    } else if(reqUrl.includes('sendaltcustexpmsg')) {
        sendAltCustExpMessage(queryObject.message);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('sendeascorsurl')) {
        sendEASMessageCORSUrl();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('sendeaswrongurl')) {
        sendEASMessageWrongUrl();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('sendeas')) {
        const messageId = queryObject.messageid || `${Date.now()}`;
        const durationMs = parseInt(queryObject.duration) || undefined;
        if (messageId) {
            EAS_ID_MESSAGE_MAP[messageId] = {
                message: queryObject.message || DEFAULT_EAS_MESSAGE,
                audio: queryObject.audio === 'true',
            };
        }
        sendEASMessage(durationMs, messageId);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('sendean3')) {
        EAN_URL = queryObject.eanurl || DEFAULT_EAN_URL;
        const durationMs = parseInt(queryObject.duration) || undefined;
        const messageId = queryObject.messageid;
        const ignoreExpiry = queryObject.ignoreExpiry === 'true';
        sendEANMessage3(durationMs, messageId, false, ignoreExpiry);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('updateean')) {
        EAN_URL = queryObject.eanurl || DEFAULT_EAN_URL;
        const durationMs = parseInt(queryObject.duration) || undefined;
        const messageId = queryObject.messageid;
        const ignoreExpiry = queryObject.ignoreExpiry === 'true';
        sendEANMessage3(durationMs, messageId, true, ignoreExpiry);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('sendeanwrongurl')) {
        sendEANMessageWrongUrl();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Message sent');
    } else if(reqUrl.endsWith('errorwss')) {
        errorAllWS();
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Error sent');
    } else if(reqUrl.endsWith('closewss')) {
        closeAllWS(queryObject.error);
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server closed');
    } else if(reqUrl.endsWith('closewss?error=1007')) {
        closeAllWS('1007');
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server closed');
    } else if(reqUrl.endsWith('openwss')) {
        allWSConnection = true;
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('Websocket server opened');
    } else if(reqUrl.endsWith('client')) {
        // server html file
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        // read file
        const file = readFileSync('./client.html', 'utf8');
        resp.end(file, 'utf-8');
    } else if(reqUrl.endsWith('resetapiconfig')) {
        apiconfig = null;
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        resp.end('ApiConfig cache cleared');
    } else if(reqUrl.endsWith('updateapiconfig')) {
        let body = '';

        // Listen for data events and append to body
        req.on('data', chunk => {
            body += chunk.toString(); // Convert Buffer to string
        });

        // End event signals all data has been received
        req.on('end', () => {
            apiconfig = body;
            resp.writeHead(200, { 'Content-Type': 'application/text' });
            resp.end('Data received');
        });
    } else if(reqUrl.endsWith('apiconfig') && (apiconfig || existsSync('./apiconfig.json'))) {
        // server html file
        const contentType = 'text/html';
        resp.writeHead(200, { 'Content-Type': contentType });
        // read file
        const file = apiconfig || readFileSync('./apiconfig.json', 'utf8');

        // update wss server
        const apiconfigJson = JSON.parse(file);
        apiconfigJson.services.vpns.endpoints.socketSubscribe.host = (new URL(SERVER_URL)).host;

        resp.end(JSON.stringify(apiconfigJson), 'utf-8');
    } else if(reqUrl.endsWith('.mp3')) {
        // server mp3 file
        const contentType = 'audio/mpeg';
        const fileStats = statSync('eas.mp3');
        resp.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileStats.size });
        // read file
        const fileStream = createReadStream('eas.mp3');
        fileStream.pipe(resp);
    } else if(reqUrl.endsWith('toggleerror')) {
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
