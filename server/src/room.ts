import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

// Define types for our room and player management
export interface Player {
  id: string;
  socket: WebSocket;
  isHost: boolean;
}

export interface Room {
  id: string;
  code: string;
  players: Map<string, Player>;
  status: 'waiting' | 'full' | 'playing' | 'disconnected';
  createdAt: number;
}

// Room manager class to handle room operations
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map(); // Maps player ID to room ID

  // Create a new room and return the room code
  createRoom(): Room {
    const roomId = uuidv4();
    // Generate a 6-character alphanumeric room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const room: Room = {
      id: roomId,
      code: roomCode,
      players: new Map(),
      status: 'waiting',
      createdAt: Date.now()
    };
    
    this.rooms.set(roomId, room);
    console.log(`Room created: ${roomCode} (${roomId})`);
    
    return room;
  }

  // Get a room by its code
  getRoomByCode(code: string): Room | undefined {
    return Array.from(this.rooms.values()).find(room => room.code === code);
  }

  // Get a room by its ID
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // Add a player to a room
  addPlayerToRoom(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return false;
    }
    
    // Check if room is already full
    if (room.players.size >= 2) {
      console.log(`Room ${room.code} is full`);
      return false;
    }
    
    // Add player to room
    room.players.set(player.id, player);
    this.playerRooms.set(player.id, roomId);
    
    // Update room status if it's now full
    if (room.players.size === 2) {
      room.status = 'full';
    }
    
    console.log(`Player ${player.id} joined room ${room.code} (${roomId})`);
    return true;
  }

  // Remove a player from their room
  removePlayer(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return undefined;
    }
    
    const room = this.rooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return undefined;
    }
    
    // Remove player from room
    room.players.delete(playerId);
    this.playerRooms.delete(playerId);
    
    console.log(`Player ${playerId} left room ${room.code} (${roomId})`);
    
    // Update room status or clean up if empty
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${room.code} (${roomId}) deleted - no players left`);
      return undefined;
    } else {
      room.status = 'waiting';
      return room;
    }
  }

  // Get the room a player is in
  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return undefined;
    }
    return this.rooms.get(roomId);
  }

  // Get all players in a room
  getPlayersInRoom(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.players.values());
  }

  // Get the other player in a room
  getOtherPlayerInRoom(roomId: string, playerId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }
    
    for (const [id, player] of room.players.entries()) {
      if (id !== playerId) {
        return player;
      }
    }
    
    return undefined;
  }

  // Clean up old rooms (can be called periodically)
  cleanupOldRooms(maxAgeMs: number = 3600000): void { // Default: 1 hour
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.createdAt > maxAgeMs) {
        // Notify all players in the room
        for (const player of room.players.values()) {
          this.playerRooms.delete(player.id);
        }
        this.rooms.delete(roomId);
        console.log(`Room ${room.code} (${roomId}) deleted - expired`);
      }
    }
  }
} 