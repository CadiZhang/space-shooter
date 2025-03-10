/**
 * WebRTCConnection handles the peer-to-peer connection between players
 * using WebRTC technology.
 */
import { SignalingClient } from './signaling';

// Configuration for the RTCPeerConnection
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN server configuration here if needed for production
  ]
};

// Data channel options
const DATA_CHANNEL_OPTIONS: RTCDataChannelInit = {
  ordered: true,
  maxRetransmits: 3
};

// Message types for game state
export enum MessageType {
  POSITION_UPDATE = 'POSITION_UPDATE',
  GAME_STATE = 'GAME_STATE',
  PLAYER_ACTION = 'PLAYER_ACTION',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_ACK = 'HEARTBEAT_ACK'
}

// Interface for game state messages
export interface GameMessage {
  type: MessageType;
  playerId: string;
  timestamp: number;
  sequence: number;
  position?: { x: number; y: number };
  action?: string;
  gameState?: any;
  data?: any;
}

export type DataChannelCallback = (message: GameMessage) => void;

export class WebRTCConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private remoteDataChannel: RTCDataChannel | null = null;
  private signalingClient: SignalingClient;
  private isHost: boolean = false;
  private isConnected: boolean = false;
  private messageListeners: DataChannelCallback[] = [];
  private sequence: number = 0;
  private heartbeatInterval: number | null = null;
  private heartbeatTimeout: number | null = null;
  private lastHeartbeatAck: number = 0;
  private reconnecting: boolean = false;
  
  constructor(signalingClient: SignalingClient) {
    this.signalingClient = signalingClient;
    this.setupSignalingListeners();
  }
  
  /**
   * Set up listeners for signaling events
   */
  private setupSignalingListeners(): void {
    // When a player joins our room, we're the host and should create an offer
    this.signalingClient.on('player-joined', () => {
      console.log('Player joined, creating offer...');
      this.isHost = true;
      this.createPeerConnection();
      this.createOffer();
    });
    
    // When we receive an offer, we need to create an answer
    this.signalingClient.on('offer', (message) => {
      console.log('Received offer, creating answer...');
      this.isHost = false;
      this.createPeerConnection();
      this.handleOffer(message.offer as RTCSessionDescriptionInit);
    });
    
    // When we receive an answer to our offer
    this.signalingClient.on('answer', (message) => {
      console.log('Received answer');
      this.handleAnswer(message.answer as RTCSessionDescriptionInit);
    });
    
    // When we receive an ICE candidate
    this.signalingClient.on('ice-candidate', (message) => {
      console.log('Received ICE candidate');
      this.handleIceCandidate(message.candidate as RTCIceCandidateInit);
    });
    
    // When the other player disconnects
    this.signalingClient.on('player-disconnected', () => {
      console.log('Other player disconnected');
      this.handleDisconnection();
    });
    
    // When we're reconnecting to the signaling server
    this.signalingClient.on('reconnecting', () => {
      this.reconnecting = true;
    });
    
    // When we've reconnected to the signaling server
    this.signalingClient.on('reconnected', () => {
      this.reconnecting = false;
      // If we were connected before, try to re-establish the peer connection
      if (this.isConnected) {
        this.restartConnection();
      }
    });
  }
  
  /**
   * Create a new RTCPeerConnection
   */
  private createPeerConnection(): void {
    // Close any existing connection
    this.closePeerConnection();
    
    // Create a new connection
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    
    // Set up event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.sendIceCandidate(event.candidate.toJSON());
      }
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      
      if (this.peerConnection?.iceConnectionState === 'disconnected' ||
          this.peerConnection?.iceConnectionState === 'failed') {
        this.handleDisconnection();
      } else if (this.peerConnection?.iceConnectionState === 'connected') {
        this.isConnected = true;
      }
    };
    
    this.peerConnection.ondatachannel = (event) => {
      console.log('Remote data channel received');
      this.remoteDataChannel = event.channel;
      this.setupDataChannel(this.remoteDataChannel);
    };
    
    // If we're the host, create the data channel
    if (this.isHost) {
      console.log('Creating data channel as host');
      this.dataChannel = this.peerConnection.createDataChannel('gameData', DATA_CHANNEL_OPTIONS);
      this.setupDataChannel(this.dataChannel);
    }
  }
  
  /**
   * Set up a data channel with event handlers
   * @param channel The data channel to set up
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened');
      this.isConnected = true;
      this.startHeartbeat();
      
      // If we were reconnecting, handle successful reconnection
      if (this.reconnecting) {
        this.reconnecting = false;
        this.handleSuccessfulReconnection();
      }
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
      this.isConnected = false;
      this.stopHeartbeat();
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    channel.onmessage = (event) => {
      try {
        const message: GameMessage = JSON.parse(event.data);
        
        // Handle heartbeat messages internally
        if (message.type === MessageType.HEARTBEAT) {
          this.sendMessage({
            type: MessageType.HEARTBEAT_ACK,
            playerId: this.signalingClient.getPlayerId() || 'unknown',
            timestamp: Date.now(),
            sequence: this.sequence++
          });
          return;
        } else if (message.type === MessageType.HEARTBEAT_ACK) {
          this.lastHeartbeatAck = Date.now();
          return;
        }
        
        // Forward other messages to listeners
        this.notifyMessageListeners(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }
  
  /**
   * Create and send an offer to the other peer
   */
  private async createOffer(): Promise<void> {
    if (!this.peerConnection) {
      console.error('Cannot create offer: No peer connection');
      return;
    }
    
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.signalingClient.sendOffer(offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }
  
  /**
   * Handle an incoming offer
   * @param offer The received offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      console.error('Cannot handle offer: No peer connection');
      return;
    }
    
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.signalingClient.sendAnswer(answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
  
  /**
   * Handle an incoming answer
   * @param answer The received answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      console.error('Cannot handle answer: No peer connection');
      return;
    }
    
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }
  
  /**
   * Handle an incoming ICE candidate
   * @param candidate The received ICE candidate
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      console.error('Cannot handle ICE candidate: No peer connection');
      return;
    }
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }
  
  /**
   * Handle disconnection of the peer
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    // Notify listeners
    this.notifyMessageListeners({
      type: MessageType.GAME_STATE,
      playerId: 'system',
      timestamp: Date.now(),
      sequence: this.sequence++,
      data: { event: 'disconnected' }
    });
    
    // Try to restart the connection if we're not already reconnecting
    if (!this.reconnecting) {
      this.restartConnection();
    }
  }
  
  /**
   * Restart the peer connection
   */
  private restartConnection(): void {
    console.log('Attempting to restart connection...');
    
    // Only the host should initiate the reconnection
    if (this.isHost) {
      this.createPeerConnection();
      this.createOffer();
    }
  }
  
  /**
   * Handle successful reconnection
   * This is called when the connection is re-established after a disconnection
   */
  private handleSuccessfulReconnection(): void {
    // Notify listeners that reconnection was successful
    this.notifyMessageListeners({
      type: MessageType.GAME_STATE,
      playerId: 'system',
      timestamp: Date.now(),
      sequence: this.sequence++,
      data: { event: 'reconnected' }
    });
    
    // Dispatch a custom event for the game to handle
    const event = new CustomEvent('game:reconnected');
    window.dispatchEvent(event);
  }
  
  /**
   * Close the peer connection and clean up
   */
  private closePeerConnection(): void {
    this.stopHeartbeat();
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.remoteDataChannel) {
      this.remoteDataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.isConnected = false;
  }
  
  /**
   * Start sending heartbeat messages
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.lastHeartbeatAck = Date.now();
    
    // Send heartbeat every 2 seconds
    this.heartbeatInterval = window.setInterval(() => {
      this.sendMessage({
        type: MessageType.HEARTBEAT,
        playerId: this.signalingClient.getPlayerId() || 'unknown',
        timestamp: Date.now(),
        sequence: this.sequence++
      });
      
      // Check if we've received a heartbeat ack recently
      const now = Date.now();
      if (now - this.lastHeartbeatAck > 10000) { // 10 seconds
        console.warn('No heartbeat response for 10 seconds');
        this.handleDisconnection();
      }
    }, 2000);
  }
  
  /**
   * Stop sending heartbeat messages
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
  
  /**
   * Send a message to the other peer
   * @param message The message to send
   */
  sendMessage(message: GameMessage): boolean {
    if (!this.isConnected) {
      console.warn('Cannot send message: Not connected');
      return false;
    }
    
    const channel = this.isHost ? this.dataChannel : this.remoteDataChannel;
    
    if (!channel || channel.readyState !== 'open') {
      console.warn('Cannot send message: Data channel not open');
      return false;
    }
    
    try {
      channel.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  /**
   * Send a position update to the other peer
   * @param x The x coordinate
   * @param y The y coordinate
   */
  sendPositionUpdate(x: number, y: number): boolean {
    return this.sendMessage({
      type: MessageType.POSITION_UPDATE,
      playerId: this.signalingClient.getPlayerId() || 'unknown',
      timestamp: Date.now(),
      sequence: this.sequence++,
      position: { x, y }
    });
  }
  
  /**
   * Send a player action to the other peer
   * @param action The action name
   * @param data Additional action data
   */
  sendPlayerAction(action: string, data: any = {}): boolean {
    return this.sendMessage({
      type: MessageType.PLAYER_ACTION,
      playerId: this.signalingClient.getPlayerId() || 'unknown',
      timestamp: Date.now(),
      sequence: this.sequence++,
      action,
      data
    });
  }
  
  /**
   * Register a message listener
   * @param callback The callback function
   */
  onMessage(callback: DataChannelCallback): void {
    this.messageListeners.push(callback);
  }
  
  /**
   * Remove a message listener
   * @param callback The callback function to remove
   */
  offMessage(callback: DataChannelCallback): void {
    const index = this.messageListeners.indexOf(callback);
    if (index !== -1) {
      this.messageListeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all message listeners
   * @param message The message to notify about
   */
  private notifyMessageListeners(message: GameMessage): void {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }
  
  /**
   * Check if connected to the other peer
   */
  isConnectedToPeer(): boolean {
    return this.isConnected;
  }
  
  /**
   * Check if this peer is the host
   */
  getIsHost(): boolean {
    return this.isHost;
  }
  
  /**
   * Clean up and disconnect
   */
  disconnect(): void {
    this.closePeerConnection();
  }
} 