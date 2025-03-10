/**
 * SignalingClient handles WebSocket communication with the signaling server
 * for establishing WebRTC connections.
 */
// Use the native WebSocket implementation
// import WebSocket from 'isomorphic-ws';

// Define message types for signaling
export interface SignalingMessage {
  type: string;
  roomCode?: string;
  roomId?: string;
  playerId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
  // Add properties for reconnection events
  attempt?: number;
  maxAttempts?: number;
  delay?: number;
}

export type SignalingEventCallback = (message: SignalingMessage) => void;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private eventListeners: Map<string, SignalingEventCallback[]> = new Map();
  private playerId: string | null = null;
  private roomId: string | null = null;
  private roomCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  
  /**
   * Connect to the signaling server
   * @param serverUrl The WebSocket URL of the signaling server
   */
  connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Attempting to connect to WebSocket server at ${serverUrl}`);
        
        // Close any existing connection
        if (this.socket) {
          console.log('Closing existing WebSocket connection');
          this.socket.close();
          this.socket = null;
        }
        
        // Create a new WebSocket connection
        console.log('Creating new WebSocket connection');
        this.socket = new WebSocket(serverUrl);
        
        // Log the WebSocket readyState
        console.log('Initial WebSocket readyState:', this.getReadyStateString(this.socket.readyState));
        
        // Set up a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket connection timeout');
            if (this.socket) {
              this.socket.close();
            }
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 second timeout
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established successfully');
          console.log('WebSocket readyState:', this.getReadyStateString(this.socket!.readyState));
          
          // Clear the connection timeout
          clearTimeout(connectionTimeout);
          
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          try {
            console.log('Received message:', event.data);
            const message: SignalingMessage = JSON.parse(event.data as string);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}, Clean: ${event.wasClean}`);
          console.log('WebSocket readyState:', this.getReadyStateString(this.socket!.readyState));
          
          // Clear the connection timeout
          clearTimeout(connectionTimeout);
          
          // Only attempt to reconnect if we were previously connected successfully
          if (this.playerId) {
            this.attemptReconnect(serverUrl);
          } else if (!event.wasClean) {
            // If we never connected and the close wasn't clean, reject the promise
            reject(new Error(`Connection closed: ${event.reason || 'Unknown reason'} (Code: ${event.code})`));
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error occurred:', error);
          console.log('WebSocket readyState:', this.getReadyStateString(this.socket!.readyState));
          
          // Log more details about the error if available
          if (error instanceof ErrorEvent) {
            console.error('Error details:', error.message);
          }
          
          // Don't reject here, let onclose handle the reconnection or rejection
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a string representation of the WebSocket readyState
   * @param readyState The WebSocket readyState value
   * @returns A string representation of the readyState
   */
  private getReadyStateString(readyState: number): string {
    switch (readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING (0)';
      case WebSocket.OPEN:
        return 'OPEN (1)';
      case WebSocket.CLOSING:
        return 'CLOSING (2)';
      case WebSocket.CLOSED:
        return 'CLOSED (3)';
      default:
        return `UNKNOWN (${readyState})`;
    }
  }
  
  /**
   * Attempt to reconnect to the signaling server with exponential backoff
   */
  private attemptReconnect(serverUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('max-reconnect-attempts', { type: 'max-reconnect-attempts' });
      return;
    }
    
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    console.log(`Attempting to reconnect in ${delay}ms...`);
    
    this.emit('reconnecting', { 
      type: 'reconnecting',
      attempt: this.reconnectAttempts + 1, 
      maxAttempts: this.maxReconnectAttempts,
      delay 
    });
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(serverUrl)
        .then(() => {
          console.log('Reconnected to signaling server');
          this.emit('reconnected', { type: 'reconnected' });
          
          // If we were in a room, try to rejoin
          if (this.roomCode) {
            this.joinRoom(this.roomCode);
          }
        })
        .catch((error) => {
          console.error('Reconnection failed:', error);
          // Reconnect failed, will try again via onclose handler
        });
    }, delay);
  }
  
  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  /**
   * Create a new game room
   */
  createRoom(): void {
    this.send({
      type: 'create-room'
    });
  }
  
  /**
   * Join an existing game room
   * @param roomCode The room code to join
   */
  joinRoom(roomCode: string): void {
    this.send({
      type: 'join-room',
      roomCode
    });
  }
  
  /**
   * Send a WebRTC offer to the other player
   * @param offer The RTCSessionDescription offer
   */
  sendOffer(offer: RTCSessionDescriptionInit): void {
    if (!this.roomId) {
      console.error('Cannot send offer: Not in a room');
      return;
    }
    
    this.send({
      type: 'offer',
      roomId: this.roomId,
      offer
    });
  }
  
  /**
   * Send a WebRTC answer to the other player
   * @param answer The RTCSessionDescription answer
   */
  sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.roomId) {
      console.error('Cannot send answer: Not in a room');
      return;
    }
    
    this.send({
      type: 'answer',
      roomId: this.roomId,
      answer
    });
  }
  
  /**
   * Send an ICE candidate to the other player
   * @param candidate The RTCIceCandidate
   */
  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.roomId) {
      console.error('Cannot send ICE candidate: Not in a room');
      return;
    }
    
    this.send({
      type: 'ice-candidate',
      roomId: this.roomId,
      candidate
    });
  }
  
  /**
   * Send a message to the signaling server
   * @param message The message to send
   */
  private send(message: SignalingMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket is not open');
      return;
    }
    
    try {
      const messageString = JSON.stringify(message);
      console.log('Sending message:', messageString);
      this.socket.send(messageString);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
  
  /**
   * Handle incoming messages from the signaling server
   * @param message The received message
   */
  private handleMessage(message: SignalingMessage): void {
    console.log('Handling message:', message);
    
    // Store player ID if provided
    if (message.playerId) {
      this.playerId = message.playerId;
    }
    
    // Store room ID and code if provided
    if (message.roomId) {
      this.roomId = message.roomId;
    }
    
    if (message.roomCode) {
      this.roomCode = message.roomCode;
    }
    
    // Handle connection established message
    if (message.type === 'connection-established') {
      this.emit('connected', message);
    }
    
    // Handle room created message
    if (message.type === 'room-created') {
      this.emit('room-created', message);
    }
    
    // Handle room joined message
    if (message.type === 'room-joined') {
      this.emit('room-joined', message);
    }
    
    // Handle player joined message
    if (message.type === 'player-joined') {
      this.emit('player-joined', message);
    }
    
    // Handle player disconnected message
    if (message.type === 'player-disconnected') {
      this.emit('player-disconnected', message);
    }
    
    // Handle error message
    if (message.type === 'error') {
      this.emit('error', message);
    }
    
    // Emit the message to all listeners for this message type
    this.emit(message.type, message);
  }
  
  /**
   * Register an event listener
   * @param event The event to listen for
   * @param callback The callback to call when the event occurs
   */
  on(event: string, callback: SignalingEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)?.push(callback);
  }
  
  /**
   * Remove an event listener
   * @param event The event name
   * @param callback The callback function to remove
   */
  off(event: string, callback: SignalingEventCallback): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  /**
   * Emit an event to all listeners
   * @param event The event to emit
   * @param message The message to pass to the listeners
   */
  private emit(event: string, message: SignalingMessage): void {
    const callbacks = this.eventListeners.get(event);
    
    if (callbacks) {
      for (const callback of callbacks) {
        callback(message);
      }
    }
  }
  
  /**
   * Get the player ID
   */
  getPlayerId(): string | null {
    return this.playerId;
  }
  
  /**
   * Get the room ID
   */
  getRoomId(): string | null {
    return this.roomId;
  }
  
  /**
   * Get the room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }
} 