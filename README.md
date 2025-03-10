# Space Shooter - Multiplayer Architecture

## Overview

This document explains the multiplayer architecture for our Space Shooter game, detailing the technical decisions, trade-offs, and implementation approach.

## Multiplayer Architecture Explained

### WebRTC: Peer-to-Peer Communication

Our game uses **WebRTC** (Web Real-Time Communication) for direct peer-to-peer connections between players. Here's why and how it works:

#### What is WebRTC?

WebRTC is a free, open-source project that provides web browsers and mobile applications with real-time communication capabilities via simple APIs. It allows direct data exchange between browsers without requiring an intermediary server for the actual game data.

##### For Non-Programmers:

Think of WebRTC like a direct phone call between two people, rather than both people having to relay messages through a third person. Once the call is connected, you can talk directly without anyone in the middle listening or relaying your conversation. This makes communication faster and more private.

#### How WebRTC Works in Our Game

1. **Connection Establishment**:

   - Players initially connect through a signaling server
   - They exchange network information (ICE candidates) and session descriptions
   - Once connected, they communicate directly with each other without server mediation

   ##### In Simple Terms:

   Imagine you want to call a friend, but neither of you knows the other's phone number. You both tell a mutual friend (the signaling server) that you want to talk. This friend gives each of you the other's phone number (connection information). Now you can call each other directly without the mutual friend being involved in your actual conversation.

2. **Data Channels**:

   - We use WebRTC's DataChannel API for game state synchronization
   - DataChannels provide low-latency, bidirectional communication
   - Our implementation uses ordered, reliable channels for critical game state

   ##### In Simple Terms:

   Once the "call" is established, we create a special communication channel that's optimized for sending game data quickly in both directions. It's like having a dedicated express lane on a highway just for our game's information to travel back and forth.

3. **NAT Traversal**:

   - WebRTC handles complex networking scenarios through ICE (Interactive Connectivity Establishment)
   - STUN servers help discover the public IP address of players
   - TURN servers provide fallback relay if direct connection fails

   ##### In Simple Terms:

   Most people's internet connections are behind firewalls or routers that make direct connections difficult. Think of it like trying to send mail to someone who lives in an apartment building but you only know the building address, not their specific apartment number.

   - **STUN servers** help find your "complete address" on the internet (like discovering your apartment number)
   - **ICE** is a process that tries multiple ways to connect, like trying the front door, back door, and windows until one works
   - **TURN servers** are a last resort that act like a mail forwarding service when direct delivery isn't possible

#### The Technical Details (For Programmers)

**Session Description Protocol (SDP):**
SDP is a format for describing multimedia communication sessions. In WebRTC, it contains information about:

- Media capabilities (codecs, formats)
- Transport protocols
- IP addresses and ports
- Other session metadata

When establishing a WebRTC connection, peers exchange SDP "offers" and "answers" that define how they'll communicate.

**ICE Candidates Explained:**
ICE (Interactive Connectivity Establishment) candidates represent potential communication methods between peers. Each candidate contains:

- IP address and port
- Transport protocol (UDP/TCP)
- Candidate type (host, reflexive, relay)
- Priority and other properties

Peers collect and exchange these candidates to find the optimal connection path. Types include:

- **Host candidates**: Direct local network addresses
- **Server reflexive candidates**: Public addresses discovered via STUN
- **Relay candidates**: TURN server addresses for fallback

**Connection Establishment Process (Detailed):**

1. Peer A creates an RTCPeerConnection object
2. Peer A creates an offer (SDP)
3. Peer A sets the offer as local description
4. Peer A sends the offer to Peer B via signaling server
5. Peer B receives the offer
6. Peer B sets the offer as remote description
7. Peer B creates an answer (SDP)
8. Peer B sets the answer as local description
9. Peer B sends the answer to Peer A via signaling server
10. Peer A receives the answer
11. Peer A sets the answer as remote description
12. Both peers gather and exchange ICE candidates
13. Connection is established when a viable candidate pair is found

### Signaling Server: WebSocket Implementation

While WebRTC enables direct peer-to-peer communication, we still need a "signaling server" to help players discover each other initially.

#### What is a Signaling Server?

##### For Non-Programmers:

A signaling server is like a matchmaker or an introduction service. It helps two players find each other and exchange contact information, but doesn't participate in their actual conversation once they're connected. Think of it as the host at a party who introduces two people, then walks away to let them talk directly.

#### WebSocket vs. HTTP for Signaling

We chose **WebSockets** over HTTP polling for our signaling server for these reasons:

| WebSocket                                   | HTTP Polling                                |
| ------------------------------------------- | ------------------------------------------- |
| Real-time, bidirectional                    | Request-response model with delays          |
| Lower overhead for continuous communication | Higher overhead due to repeated connections |
| Better for time-sensitive operations        | Acceptable for infrequent updates           |
| Simpler implementation for real-time events | More complex to simulate real-time behavior |

##### In Simple Terms:

- **WebSocket** is like having a phone call where both people can speak whenever they want
- **HTTP Polling** is like leaving voicemails and checking your voicemail box every few minutes

#### How WebSockets Work

##### For Non-Programmers:

Traditional web communication is like sending letters back and forth - you send a request, wait for a response, then send another request. WebSockets instead establish an open channel where messages can flow freely in both directions at any time, more like a phone call.

##### Technical Details:

WebSockets maintain a persistent connection between client and server after an initial handshake. This connection:

- Starts as an HTTP request that "upgrades" to the WebSocket protocol
- Uses a single TCP connection for the lifetime of the WebSocket
- Enables full-duplex communication (both directions simultaneously)
- Has minimal overhead per message (just a few bytes of header)
- Includes built-in ping/pong frames for connection monitoring

#### Implementation Details

Our signaling server uses Node.js with the `ws` library, providing:

- Room creation and management
- Player pairing
- WebRTC offer/answer exchange
- ICE candidate relaying

##### How Rooms Work:

When a player wants to start a game, they request a new "room" from the server. This room:

- Has a unique identifier (like "game-123456")
- Can be shared via a link or code
- Waits for a second player to join
- Manages the WebRTC connection process between the two players
- Handles disconnection and reconnection scenarios

### Network Communication Flow

To better understand how all these components work together, here's the complete flow from game start to gameplay:

1. **Game Initialization**:

   - Player 1 opens the game and clicks "Create Game"
   - The game connects to the signaling server via WebSocket
   - The server creates a new room and assigns Player 1 as the host
   - Player 1 receives a room code to share (e.g., "GAME123")

2. **Player Connection**:

   - Player 2 opens the game and enters the room code
   - Player 2 connects to the signaling server
   - The server verifies the room exists and pairs Player 2 with Player 1
   - Both players are notified that a match is ready

3. **WebRTC Handshake** (behind the scenes):

   - Player 1's browser creates an "offer" (connection proposal)
   - This offer is sent through the signaling server to Player 2
   - Player 2's browser creates an "answer" to the offer
   - The answer is sent back through the signaling server to Player 1
   - Both browsers gather "ICE candidates" (possible connection methods)
   - These candidates are exchanged through the signaling server
   - The browsers test each candidate pair until they find one that works
   - A direct peer-to-peer connection is established

4. **Game Communication**:
   - The signaling server's job is now complete (though it stays connected for fallback)
   - All game data now flows directly between the two players' browsers
   - Each player's moves and actions are sent directly to the other player
   - The game state is synchronized without server involvement

##### Visual Analogy:

Imagine the signaling server as an air traffic controller and the two players as pilots. The controller helps the pilots find each other and establish a flight path, but once they're in the air together, they can communicate directly without the controller's involvement.

### Server-Side vs. Client-Side Authority

We've implemented a hybrid approach with limited server-side validation:

#### Client-Side Authority

In our implementation, clients have primary authority over their own state, with these characteristics:

- **Pros**:

  - Lower latency (immediate local updates)
  - Simpler implementation
  - Reduced server load
  - Works well for casual gameplay

- **Cons**:
  - Vulnerable to cheating
  - Potential for state inconsistencies
  - Limited ability to resolve conflicts

##### In Simple Terms:

Client-side authority means each player's computer is trusted to report its own position and actions honestly. It's like playing a board game where each player moves their own piece and everyone trusts that they're following the rules.

#### Server-Side Validation

To mitigate the downsides of client authority, we implement basic server-side validation:

- **What We Validate**:

  - Position boundaries (preventing out-of-bounds movement)
  - Movement speed (ensuring players don't move faster than allowed)
  - Basic action rate limiting

- **Why This Hybrid Approach**:
  - Balances responsiveness with security
  - Provides acceptable security for casual gameplay
  - Reduces implementation complexity
  - Allows future expansion of validation if needed

##### In Simple Terms:

Our approach is like a board game where players move their own pieces, but there's a referee watching who will step in if someone tries to make an illegal move or move too many spaces at once.

### Connection and State Management

#### Connection Lifecycle

1. **Initialization**:

   - Host creates a room via the signaling server
   - Guest joins using a room code/link
   - Signaling server pairs the players

2. **WebRTC Handshake**:

   - Host creates an offer
   - Guest receives offer and creates answer
   - Both exchange ICE candidates
   - Direct peer connection established

3. **Gameplay**:

   - Game state synchronized via DataChannel
   - Local inputs processed immediately
   - Position updates sent to peer
   - Remote updates applied to opponent representation

4. **Disconnection Handling**:
   - Connection monitoring via heartbeat messages
   - Disconnection detection with timeout
   - Reconnection attempts with exponential backoff
   - "Host disconnected" notification if reconnection fails

#### State Synchronization

Our state synchronization follows these principles:

- **Local Prediction**: Apply local inputs immediately for responsive gameplay
- **Remote Correction**: Update remote player position based on received data
- **Timestamp-Based Ordering**: Use timestamps to handle out-of-order messages
- **Interpolation**: Smooth remote player movement between updates
- **Boundary Enforcement**: Ensure players remain within game boundaries

##### In Simple Terms:

- When you press a key, your ship moves instantly on your screen
- Your new position is sent to the other player
- If messages arrive out of order, timestamps help sort them out
- If the other player's ship seems to jump around, we add smooth transitions
- If either player tries to fly off the edge of the screen, they're stopped

### Mobile Considerations

While primarily designed for desktop, our game supports mobile browsers with:

- Touch-based directional controls
- Responsive canvas scaling
- Simplified UI for smaller screens
- Touch event handling for game interactions

## Technical Implementation

### Core Technologies

- **Frontend**: Vite, TypeScript, TailwindCSS
- **Rendering**: HTML5 Canvas
- **Networking**: WebRTC, WebSockets
- **Backend**: Node.js for signaling server

### Network Message Format

```typescript
// Example game state message
{
  type: "POSITION_UPDATE",
  playerId: "player1",
  position: { x: 150, y: 200 },
  timestamp: 1623456789123,
  sequence: 42
}
```

### Reconnection Strategy

- Gray overlay (50% opacity) during reconnection attempts
- Animated reconnection icon
- Exponential backoff between attempts
- Maximum retry limit before permanent disconnection

## Running the Project

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/space-shooter.git
   cd space-shooter
   ```

2. Install dependencies for the server:

   ```bash
   cd server
   npm install
   ```

3. Install dependencies for the frontend:
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Signaling Server

1. Start the server:
   ```bash
   cd server
   npm run dev
   ```
   This will start the signaling server on port 8080.

### Running the Frontend

1. Start the frontend development server:

   ```bash
   cd frontend
   npm run dev
   ```

   This will start the Vite development server, typically on port 5173.

2. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

### Playing the Game

1. Open the game in two different browser windows or devices.
2. In the first window, click "Create Room" to create a new game room.
3. Note the room code that appears.
4. In the second window, enter the room code and click "Join".
5. Once connected, both players will see the game screen.
6. Use WASD or arrow keys to move your square (red for host, blue for guest).
7. On mobile devices, use the on-screen directional controls.

### Testing on Mobile

To test on a mobile device while running the server locally:

1. Find your computer's local IP address (e.g., 192.168.1.100)
2. Update the `SIGNALING_SERVER_URL` in `frontend/src/main.ts` to use your local IP:
   ```typescript
   const SIGNALING_SERVER_URL = "ws://192.168.1.100:8080";
   ```
3. Make sure your mobile device is on the same network as your computer.
4. On your mobile device, navigate to:
   ```
   http://192.168.1.100:5173
   ```

## Conclusion

This multiplayer architecture provides a balance of:

- **Performance**: Low-latency updates via direct P2P communication
- **Simplicity**: Straightforward implementation without complex server logic
- **Security**: Basic validation to prevent the most obvious cheating
- **Scalability**: Foundation that can be extended for more complex gameplay

The design prioritizes a smooth player experience while maintaining reasonable security measures appropriate for a casual multiplayer game.
