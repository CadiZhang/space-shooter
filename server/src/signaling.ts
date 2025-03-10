import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { RoomManager, Player } from './room';

// Define message types for signaling
export interface SignalingMessage {
  type: string;
  roomCode?: string;
  roomId?: string;
  playerId?: string;
  offer?: any;
  answer?: any;
  candidate?: any;
  error?: string;
}

export class SignalingServer {
  private roomManager: RoomManager;
  
  constructor(private wss: WebSocket.Server) {
    this.roomManager = new RoomManager();
    this.setupWebSocketServer();
    
    // Set up periodic cleanup of old rooms
    setInterval(() => {
      this.roomManager.cleanupOldRooms();
    }, 3600000); // Clean up every hour
  }
  
  private setupWebSocketServer(): void {
    this.wss.on('connection', (socket: WebSocket) => {
      const playerId = uuidv4();
      console.log(`New connection: Player ${playerId}`);
      
      // Set up message handling for this connection
      socket.on('message', (message: WebSocket.Data) => {
        try {
          const data: SignalingMessage = JSON.parse(message.toString());
          this.handleMessage(socket, playerId, data);
        } catch (error) {
          console.error('Error parsing message:', error);
          this.sendToSocket(socket, {
            type: 'error',
            error: 'Invalid message format'
          });
        }
      });
      
      // Handle disconnection
      socket.on('close', () => {
        console.log(`Connection closed: Player ${playerId}`);
        const room = this.roomManager.removePlayer(playerId);
        
        // Notify other player in the room if any
        if (room) {
          const otherPlayer = this.roomManager.getOtherPlayerInRoom(room.id, playerId);
          if (otherPlayer) {
            this.sendToSocket(otherPlayer.socket, {
              type: 'player-disconnected',
              playerId
            });
          }
        }
      });
      
      // Send initial connection acknowledgment with player ID
      this.sendToSocket(socket, {
        type: 'connection-established',
        playerId
      });
    });
  }
  
  private handleMessage(socket: WebSocket, playerId: string, message: SignalingMessage): void {
    switch (message.type) {
      case 'create-room':
        this.handleCreateRoom(socket, playerId);
        break;
        
      case 'join-room':
        if (message.roomCode) {
          this.handleJoinRoom(socket, playerId, message.roomCode);
        } else {
          this.sendError(socket, 'Room code is required');
        }
        break;
        
      case 'offer':
        if (message.roomId && message.offer) {
          this.handleOffer(playerId, message.roomId, message.offer);
        } else {
          this.sendError(socket, 'Room ID and offer are required');
        }
        break;
        
      case 'answer':
        if (message.roomId && message.answer) {
          this.handleAnswer(playerId, message.roomId, message.answer);
        } else {
          this.sendError(socket, 'Room ID and answer are required');
        }
        break;
        
      case 'ice-candidate':
        if (message.roomId && message.candidate) {
          this.handleIceCandidate(playerId, message.roomId, message.candidate);
        } else {
          this.sendError(socket, 'Room ID and candidate are required');
        }
        break;
        
      default:
        this.sendError(socket, `Unknown message type: ${message.type}`);
    }
  }
  
  private handleCreateRoom(socket: WebSocket, playerId: string): void {
    const room = this.roomManager.createRoom();
    
    // Create player object and add to room
    const player: Player = {
      id: playerId,
      socket,
      isHost: true
    };
    
    this.roomManager.addPlayerToRoom(room.id, player);
    
    // Send room details back to the client
    this.sendToSocket(socket, {
      type: 'room-created',
      roomId: room.id,
      roomCode: room.code
    });
  }
  
  private handleJoinRoom(socket: WebSocket, playerId: string, roomCode: string): void {
    const room = this.roomManager.getRoomByCode(roomCode);
    
    if (!room) {
      return this.sendError(socket, `Room with code ${roomCode} not found`);
    }
    
    if (room.status === 'full') {
      return this.sendError(socket, `Room ${roomCode} is full`);
    }
    
    // Create player object and add to room
    const player: Player = {
      id: playerId,
      socket,
      isHost: false
    };
    
    const success = this.roomManager.addPlayerToRoom(room.id, player);
    
    if (!success) {
      return this.sendError(socket, `Failed to join room ${roomCode}`);
    }
    
    // Send room details back to the client
    this.sendToSocket(socket, {
      type: 'room-joined',
      roomId: room.id,
      roomCode: room.code
    });
    
    // Notify the host that a player has joined
    const host = Array.from(room.players.values()).find(p => p.isHost);
    if (host) {
      this.sendToSocket(host.socket, {
        type: 'player-joined',
        playerId
      });
    }
  }
  
  private handleOffer(playerId: string, roomId: string, offer: any): void {
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      return;
    }
    
    const otherPlayer = this.roomManager.getOtherPlayerInRoom(roomId, playerId);
    
    if (!otherPlayer) {
      return;
    }
    
    // Forward the offer to the other player
    this.sendToSocket(otherPlayer.socket, {
      type: 'offer',
      offer,
      playerId
    });
  }
  
  private handleAnswer(playerId: string, roomId: string, answer: any): void {
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      return;
    }
    
    const otherPlayer = this.roomManager.getOtherPlayerInRoom(roomId, playerId);
    
    if (!otherPlayer) {
      return;
    }
    
    // Forward the answer to the other player
    this.sendToSocket(otherPlayer.socket, {
      type: 'answer',
      answer,
      playerId
    });
  }
  
  private handleIceCandidate(playerId: string, roomId: string, candidate: any): void {
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      return;
    }
    
    const otherPlayer = this.roomManager.getOtherPlayerInRoom(roomId, playerId);
    
    if (!otherPlayer) {
      return;
    }
    
    // Forward the ICE candidate to the other player
    this.sendToSocket(otherPlayer.socket, {
      type: 'ice-candidate',
      candidate,
      playerId
    });
  }
  
  private sendError(socket: WebSocket, error: string): void {
    this.sendToSocket(socket, {
      type: 'error',
      error
    });
  }
  
  private sendToSocket(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
} 