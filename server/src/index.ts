import WebSocket from 'ws';
import { SignalingServer } from './signaling';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

// Create HTTP server for health checks and serving the test client
const server = http.createServer((req, res) => {
  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      clients: wss.clients.size
    }));
    return;
  }
  
  // Serve the test client
  if (req.url === '/test-client') {
    try {
      // If we couldn't find the file, serve an embedded version
      console.log('Serving embedded test client');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebSocket Test Client</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                #log {
                    border: 1px solid #ccc;
                    padding: 10px;
                    height: 300px;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    background-color: #f9f9f9;
                }
                .success { color: green; }
                .error { color: red; }
                .info { color: blue; }
                button {
                    padding: 8px 16px;
                    margin-right: 10px;
                }
                .status-bar {
                    background-color: #f0f0f0;
                    padding: 10px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <h1>WebSocket Test Client</h1>
            <div class="status-bar">
                Server is running on port: <strong>${PORT}</strong>
            </div>
            <div>
                <label for="url">WebSocket URL:</label>
                <input type="text" id="url" value="ws://${req.headers.host}" style="width: 300px;">
                <button id="connect">Connect</button>
                <button id="disconnect" disabled>Disconnect</button>
            </div>
            <div style="margin-top: 10px;">
                <label for="message">Message:</label>
                <input type="text" id="message" value='{"type":"create-room"}' style="width: 300px;">
                <button id="send" disabled>Send</button>
            </div>
            <h3>Log:</h3>
            <div id="log"></div>

            <script>
                const connectBtn = document.getElementById('connect');
                const disconnectBtn = document.getElementById('disconnect');
                const sendBtn = document.getElementById('send');
                const urlInput = document.getElementById('url');
                const messageInput = document.getElementById('message');
                const logDiv = document.getElementById('log');
                
                let socket = null;

                function log(message, type = 'info') {
                    const entry = document.createElement('div');
                    entry.className = type;
                    entry.textContent = \`\${new Date().toLocaleTimeString()} - \${message}\`;
                    logDiv.appendChild(entry);
                    logDiv.scrollTop = logDiv.scrollHeight;
                }

                // Make sure we're using the correct port
                if (!urlInput.value.includes(':${PORT}')) {
                    urlInput.value = 'ws://' + window.location.hostname + ':${PORT}';
                }

                connectBtn.addEventListener('click', () => {
                    const url = urlInput.value;
                    try {
                        log(\`Connecting to \${url}...\`);
                        socket = new WebSocket(url);
                        
                        socket.onopen = () => {
                            log('Connection established', 'success');
                            connectBtn.disabled = true;
                            disconnectBtn.disabled = false;
                            sendBtn.disabled = false;
                        };
                        
                        socket.onmessage = (event) => {
                            log(\`Received: \${event.data}\`, 'info');
                        };
                        
                        socket.onclose = (event) => {
                            log(\`Connection closed. Code: \${event.code}, Reason: \${event.reason || 'No reason provided'}, Clean: \${event.wasClean}\`, event.wasClean ? 'info' : 'error');
                            connectBtn.disabled = false;
                            disconnectBtn.disabled = true;
                            sendBtn.disabled = true;
                            socket = null;
                        };
                        
                        socket.onerror = (error) => {
                            log(\`Error: \${error}\`, 'error');
                            // Try to provide more details about the error
                            if (error && error.message) {
                                log(\`Error details: \${error.message}\`, 'error');
                            }
                        };
                    } catch (error) {
                        log(\`Failed to create WebSocket: \${error}\`, 'error');
                    }
                });

                disconnectBtn.addEventListener('click', () => {
                    if (socket) {
                        socket.close();
                        log('Disconnecting...', 'info');
                    }
                });

                sendBtn.addEventListener('click', () => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        const message = messageInput.value;
                        try {
                            socket.send(message);
                            log(\`Sent: \${message}\`, 'info');
                        } catch (error) {
                            log(\`Failed to send message: \${error}\`, 'error');
                        }
                    } else {
                        log('Cannot send message: WebSocket is not open', 'error');
                    }
                });
            </script>
        </body>
        </html>
      `);
      return;
    } catch (error) {
      console.error('Error serving test client:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error serving test client');
      return;
    }
  }
  
  // For the root path, explain that this is a WebSocket server
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head>
        <title>Space Shooter Signaling Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Space Shooter Signaling Server</h1>
        <p>This is a WebSocket server for the Space Shooter multiplayer game.</p>
        <p>To connect to this server, use a WebSocket client with the URL: <code>ws://${req.headers.host}</code></p>
        <p>Current connections: <strong>${wss.clients.size}</strong></p>
        <p><a href="/test-client">Open Test Client</a></p>
      </body>
    </html>
  `);
});

// Create a WebSocket server with a simpler configuration
const wss = new WebSocket.Server({
  noServer: true, // Don't create a server automatically
  perMessageDeflate: false // Disable compression completely
});

// Handle WebSocket upgrade manually
server.on('upgrade', (request, socket, head) => {
  // Log the upgrade request
  console.log('WebSocket upgrade request received from:', request.headers.origin || 'unknown origin');
  
  // Handle the upgrade
  wss.handleUpgrade(request, socket, head, (ws) => {
    // Emit the connection event
    wss.emit('connection', ws, request);
  });
});

// Add more robust error handling
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// Handle connection events
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || 'unknown origin';
  console.log('New WebSocket connection established from:', origin);
  
  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
  
  ws.on('message', (message) => {
    console.log('Received message:', message.toString());
  });
});

// Initialize signaling server
const signalingServer = new SignalingServer(wss);

// Start the server
server.listen(PORT, () => {
  console.log(`Signaling server started on port ${PORT}`);
  console.log(`HTTP server available at http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
  console.log(`CORS is enabled - accepting connections from any origin`);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}); 