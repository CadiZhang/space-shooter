/**
 * Game class manages the game state, rendering, and multiplayer synchronization
 */
import { Player } from './player';
import { WebRTCConnection, MessageType, GameMessage } from '../networking/webrtc';
import { SignalingClient } from '../networking/signaling';
import { MobileControls } from '../components/MobileControls';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private localPlayer: Player | null = null;
  private remotePlayer: Player | null = null;
  private keys: { [key: string]: boolean } = {};
  private animationFrameId: number | null = null;
  private webrtcConnection: WebRTCConnection;
  private signalingClient: SignalingClient;
  private gameStarted: boolean = false;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 50; // Send position updates every 50ms
  private reconnecting: boolean = false;
  private mobileControls: MobileControls;
  
  constructor(canvas: HTMLCanvasElement, signalingClient: SignalingClient, webrtcConnection: WebRTCConnection) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.signalingClient = signalingClient;
    this.webrtcConnection = webrtcConnection;
    
    // Create mobile controls
    this.mobileControls = new MobileControls(canvas.parentElement || document.body);
    
    // Set up event listeners
    this.setupEventListeners();
    this.setupNetworkListeners();
  }
  
  /**
   * Set up keyboard event listeners
   */
  private setupEventListeners(): void {
    // Keyboard input
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    // Listen for reconnection events
    window.addEventListener('game:reconnected', () => {
      this.handleReconnection();
    });
    
    // Initial canvas sizing
    this.resizeCanvas();
  }
  
  /**
   * Set up network event listeners
   */
  private setupNetworkListeners(): void {
    // Listen for WebRTC messages
    this.webrtcConnection.onMessage((message: GameMessage) => {
      this.handleNetworkMessage(message);
    });
  }
  
  /**
   * Handle incoming network messages
   * @param message The received message
   */
  private handleNetworkMessage(message: GameMessage): void {
    switch (message.type) {
      case MessageType.POSITION_UPDATE:
        if (message.position && this.remotePlayer) {
          this.remotePlayer.setPosition(message.position.x, message.position.y);
        }
        break;
        
      case MessageType.GAME_STATE:
        if (message.data && message.data.event === 'disconnected') {
          this.handleDisconnection();
        }
        break;
        
      default:
        console.log('Received message:', message);
    }
  }
  
  /**
   * Handle disconnection of the remote player
   */
  private handleDisconnection(): void {
    this.reconnecting = true;
    this.stop();
    
    // Notify the UI about disconnection
    const event = new CustomEvent('game:disconnected');
    window.dispatchEvent(event);
  }
  
  /**
   * Handle reconnection completion
   * Note: This method is intended to be called when a reconnection is successful.
   * Currently connected to the 'reconnected' event from WebRTCConnection.
   */
  private handleReconnection(): void {
    this.reconnecting = false;
    
    // Notify the UI about reconnection
    const event = new CustomEvent('game:reconnected');
    window.dispatchEvent(event);
    
    // Restart the game
    this.start();
  }
  
  /**
   * Resize the canvas to fill the window
   */
  private resizeCanvas(): void {
    // Get the parent element's dimensions
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    } else {
      // Fallback to window dimensions
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }
  
  /**
   * Start the game
   */
  start(): void {
    if (this.gameStarted) {
      return;
    }
    
    this.gameStarted = true;
    
    // Create players
    const playerId = this.signalingClient.getPlayerId() || 'unknown';
    const isHost = this.webrtcConnection.getIsHost();
    
    // Host is red, guest is blue
    const localColor = isHost ? '#FF0000' : '#0000FF';
    const remoteColor = isHost ? '#0000FF' : '#FF0000';
    
    // Position players on opposite sides
    const startX = isHost ? 100 : this.canvas.width - 150;
    const startY = this.canvas.height / 2 - 25;
    
    this.localPlayer = new Player(playerId, startX, startY, localColor, true);
    this.remotePlayer = new Player('remote', this.canvas.width - startX, startY, remoteColor, false);
    
    // Show mobile controls if on a touch device
    this.mobileControls.show(true);
    
    // Start the game loop
    this.gameLoop();
    
    // Notify the UI that the game has started
    const event = new CustomEvent('game:started', { 
      detail: { isHost } 
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Stop the game
   */
  stop(): void {
    this.gameStarted = false;
    
    // Hide mobile controls
    this.mobileControls.show(false);
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.gameStarted) {
      return;
    }
    
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Merge keyboard and mobile control inputs
    const mobileKeys = this.mobileControls.getKeys();
    const mergedKeys = { ...this.keys, ...mobileKeys };
    
    // Update local player
    if (this.localPlayer) {
      const moved = this.localPlayer.update(mergedKeys, this.canvas.width, this.canvas.height);
      
      // Send position update if moved and enough time has passed
      const now = Date.now();
      if (moved && now - this.lastUpdateTime > this.updateInterval) {
        const position = this.localPlayer.getPosition();
        this.webrtcConnection.sendPositionUpdate(position.x, position.y);
        this.lastUpdateTime = now;
      }
    }
    
    // Draw players
    if (this.localPlayer) {
      this.localPlayer.draw(this.ctx);
    }
    
    if (this.remotePlayer) {
      this.remotePlayer.draw(this.ctx);
    }
    
    // Draw connection status
    this.drawConnectionStatus();
    
    // Continue the game loop
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }
  
  /**
   * Draw connection status on the canvas
   */
  private drawConnectionStatus(): void {
    const isConnected = this.webrtcConnection.isConnectedToPeer();
    const statusText = isConnected ? 'Connected' : 'Disconnected';
    const statusColor = isConnected ? '#00FF00' : '#FF0000';
    
    this.ctx.fillStyle = statusColor;
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Status: ${statusText}`, 10, 20);
    
    // Draw room code if available
    const roomCode = this.signalingClient.getRoomCode();
    if (roomCode) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillText(`Room: ${roomCode}`, 10, 40);
    }
    
    // Draw host/guest status
    const isHost = this.webrtcConnection.getIsHost();
    this.ctx.fillStyle = '#000';
    this.ctx.fillText(`Role: ${isHost ? 'Host' : 'Guest'}`, 10, 60);
    
    // Draw controls help text
    this.ctx.fillStyle = '#000';
    this.ctx.textAlign = 'center';
    
    if (this.mobileControls.isMobileDevice()) {
      this.ctx.fillText('Use the on-screen controls to move', this.canvas.width / 2, this.canvas.height - 20);
    } else {
      this.ctx.fillText('Use WASD or Arrow Keys to move', this.canvas.width / 2, this.canvas.height - 20);
    }
  }
  
  /**
   * Check if the game is currently running
   */
  isRunning(): boolean {
    return this.gameStarted;
  }
  
  /**
   * Check if the game is reconnecting
   */
  isReconnecting(): boolean {
    return this.reconnecting;
  }
} 