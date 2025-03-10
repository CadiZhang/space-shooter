import './style.css';
import { GameUI } from './components/GameUI';

// Configuration
// Try different WebSocket URL formats, including the proxied URL
const SIGNALING_SERVER_URLS = [
  'ws://localhost:8000',  // Direct connection
  'ws://127.0.0.1:8000',  // Using IP address
  'ws://localhost:5173/ws'  // Proxied through Vite
];

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Create the game container if it doesn't exist
  let gameContainer = document.getElementById('game-container');
  
  if (!gameContainer) {
    gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    gameContainer.className = 'w-full h-screen';
    document.body.appendChild(gameContainer);
  }
  
  // Initialize the game UI
  const gameUI = new GameUI('game-container');
  
  // Try connecting to different URLs if the first one fails
  let connected = false;
  let lastError = null;
  
  for (const serverUrl of SIGNALING_SERVER_URLS) {
    if (connected) break;
    
    try {
      console.log(`Attempting to connect to signaling server at ${serverUrl}`);
      await gameUI.initialize(serverUrl);
      console.log(`Successfully connected to ${serverUrl}`);
      connected = true;
    } catch (error) {
      console.error(`Failed to connect to ${serverUrl}:`, error);
      lastError = error;
    }
  }
  
  if (!connected) {
    console.error('Failed to connect to any signaling server. Please check your server configuration.');
    
    // Get error message safely from the unknown error
    const errorMessage = lastError instanceof Error 
      ? lastError.message 
      : typeof lastError === 'string'
        ? lastError
        : 'Unknown error';
    
    // Display an error message to the user
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message p-4 bg-red-100 text-red-700 rounded-md max-w-md mx-auto mt-8';
    errorElement.innerHTML = `
      <h2 class="text-xl font-bold mb-2">Connection Error</h2>
      <p>Failed to connect to the game server. Please try again later.</p>
      <p class="text-sm mt-2">Error details: ${errorMessage}</p>
      <p class="text-sm mt-2">Try opening the <a href="http://localhost:8000/test-client" target="_blank" class="text-blue-500 underline">test client</a> to check if the server is running.</p>
      <button class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" id="retry-button">
        Retry Connection
      </button>
    `;
    gameContainer.appendChild(errorElement);
    
    // Add retry button functionality
    document.getElementById('retry-button')?.addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  // Add a global reference for debugging
  (window as any).gameUI = gameUI;
}); 