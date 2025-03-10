/**
 * GameUI handles the user interface elements for the game
 */
import { SignalingClient } from '../networking/signaling';
import { WebRTCConnection } from '../networking/webrtc';
import { Game } from '../game/game';
import { Button, ButtonVariant, ButtonSize } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export class GameUI {
  private container: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private lobbyElement!: HTMLElement;
  private gameElement!: HTMLElement;
  private createRoomButton!: HTMLButtonElement;
  private joinRoomButton!: HTMLButtonElement;
  private roomCodeInput!: HTMLInputElement;
  private roomCodeDisplay!: HTMLElement;
  private statusElement!: HTMLElement;
  private reconnectOverlay!: HTMLElement;
  private signalingClient: SignalingClient;
  private webrtcConnection: WebRTCConnection;
  private game: Game | null = null;
  private roomCode: string | null = null;
  private playerId: string | null = null;
  
  constructor(containerId: string) {
    // Get the container element
    this.container = document.getElementById(containerId) as HTMLElement;
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    // Create UI elements
    this.createUIElements();
    
    // Initialize networking
    this.signalingClient = new SignalingClient();
    this.webrtcConnection = new WebRTCConnection(this.signalingClient);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Create the UI elements
   */
  private createUIElements(): void {
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the lobby element
    this.lobbyElement = document.createElement('div');
    this.lobbyElement.className = 'lobby p-6 max-w-md mx-auto';
    
    // Create the game element
    this.gameElement = document.createElement('div');
    this.gameElement.className = 'game relative w-full h-full hidden';
    
    // Create the canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full';
    this.gameElement.appendChild(this.canvas);
    
    // Create the reconnect overlay
    this.reconnectOverlay = document.createElement('div');
    this.reconnectOverlay.className = 'reconnect-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden';
    
    const reconnectContent = document.createElement('div');
    reconnectContent.className = 'text-white text-center';
    
    const reconnectIcon = document.createElement('div');
    reconnectIcon.className = 'animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4';
    
    const reconnectText = document.createElement('div');
    reconnectText.className = 'text-xl';
    reconnectText.textContent = 'Reconnecting...';
    
    reconnectContent.appendChild(reconnectIcon);
    reconnectContent.appendChild(reconnectText);
    this.reconnectOverlay.appendChild(reconnectContent);
    
    this.gameElement.appendChild(this.reconnectOverlay);
    
    // Create main menu card
    const mainMenuCard = new Card('bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Space Shooter - Multiplayer');
    cardHeader.appendChild(cardTitle.getElement());
    mainMenuCard.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent();
    
    // Create Room section
    const createRoomSection = document.createElement('div');
    createRoomSection.className = 'mb-6';
    
    const createRoomTitle = document.createElement('h2');
    createRoomTitle.className = 'text-xl font-semibold mb-2';
    createRoomTitle.textContent = 'Create a New Game';
    
    const createRoomBtn = new Button('Create Room', {
      size: ButtonSize.LG,
      className: 'w-full'
    });
    this.createRoomButton = createRoomBtn.getElement();
    
    createRoomSection.appendChild(createRoomTitle);
    createRoomSection.appendChild(this.createRoomButton);
    
    // Join Room section
    const joinRoomSection = document.createElement('div');
    joinRoomSection.className = 'mb-6';
    
    const joinRoomTitle = document.createElement('h2');
    joinRoomTitle.className = 'text-xl font-semibold mb-2';
    joinRoomTitle.textContent = 'Join a Game';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'flex mb-2';
    
    const roomCodeInputComponent = new Input({
      placeholder: 'Enter Room Code',
      className: 'rounded-r-none'
    });
    this.roomCodeInput = roomCodeInputComponent.getElement();
    
    const joinRoomBtn = new Button('Join', {
      variant: ButtonVariant.SECONDARY,
      className: 'rounded-l-none'
    });
    this.joinRoomButton = joinRoomBtn.getElement();
    
    inputGroup.appendChild(this.roomCodeInput);
    inputGroup.appendChild(this.joinRoomButton);
    
    joinRoomSection.appendChild(joinRoomTitle);
    joinRoomSection.appendChild(inputGroup);
    
    // Room code display (initially hidden)
    this.roomCodeDisplay = document.createElement('div');
    this.roomCodeDisplay.className = 'bg-gray-100 p-4 rounded mb-4 text-center hidden';
    
    // Status element
    this.statusElement = document.createElement('div');
    this.statusElement.className = 'text-center text-gray-600 mt-4';
    this.statusElement.textContent = 'Not connected to server';
    
    // Assemble the card content
    cardContent.appendChild(this.roomCodeDisplay);
    cardContent.appendChild(createRoomSection);
    cardContent.appendChild(joinRoomSection);
    cardContent.appendChild(this.statusElement);
    
    mainMenuCard.appendChild(cardContent.getElement());
    
    // Add the card to the lobby
    this.lobbyElement.appendChild(mainMenuCard.getElement());
    
    // Add elements to the container
    this.container.appendChild(this.lobbyElement);
    this.container.appendChild(this.gameElement);
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Create room button
    this.createRoomButton.addEventListener('click', () => {
      this.createRoom();
    });
    
    // Join room button
    this.joinRoomButton.addEventListener('click', () => {
      this.showJoinRoomUI();
    });
    
    // Room code input (enter key)
    this.roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        if (roomCode.length === 6) {
          this.joinRoom(roomCode);
        } else {
          alert('Please enter a valid room code (6 characters)');
        }
      }
    });
    
    // Signaling client events
    this.signalingClient.on('connected', (message) => {
      console.log('Connected to signaling server with player ID:', message.playerId);
      this.playerId = message.playerId as string;
      this.updateStatus('Connected to server');
      this.enableButtons(true);
    });
    
    this.signalingClient.on('room-created', (message) => {
      console.log('Room created:', message.roomCode);
      this.roomCode = message.roomCode as string;
      this.showWaitingRoom();
    });
    
    this.signalingClient.on('room-joined', (message) => {
      console.log('Room joined:', message.roomCode);
      this.roomCode = message.roomCode as string;
      
      // Start the game immediately for joining players
      this.startGame();
    });
    
    this.signalingClient.on('player-joined', (message) => {
      console.log('Player joined:', message.playerId);
      // Start the game when another player joins (for the host)
      this.startGame();
    });
    
    this.signalingClient.on('player-disconnected', (message) => {
      console.log('Player disconnected:', message.playerId);
      // Handle player disconnection
      this.handlePlayerDisconnected();
    });
    
    this.signalingClient.on('error', (message) => {
      console.error('Signaling error:', message.error);
      // Show error message to the user
      this.showError(message.error as string);
    });
    
    this.signalingClient.on('reconnecting', (message: any) => {
      this.updateStatus(`Reconnecting to server (${message.attempt}/${message.maxAttempts})...`);
    });
    
    // Game events
    window.addEventListener('game:started', () => {
      this.showGame();
    });
    
    window.addEventListener('game:disconnected', () => {
      this.showReconnectOverlay(true);
    });
    
    window.addEventListener('game:reconnected', () => {
      this.showReconnectOverlay(false);
    });
  }
  
  /**
   * Initialize the game
   */
  async initialize(serverUrl: string): Promise<void> {
    try {
      this.updateStatus('Connecting to server...');
      this.enableButtons(false);
      
      await this.signalingClient.connect(serverUrl);
      
      // Create the game instance
      this.game = new Game(this.canvas, this.signalingClient, this.webrtcConnection);
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      this.updateStatus('Failed to connect to server. Please try again.', true);
      this.enableButtons(true);
    }
  }
  
  /**
   * Create a new game room
   */
  private createRoom(): void {
    this.enableButtons(false);
    this.updateStatus('Creating room...');
    this.signalingClient.createRoom();
  }
  
  /**
   * Show the join room UI
   */
  private showJoinRoomUI(): void {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the join room UI
    const joinRoomContainer = document.createElement('div');
    joinRoomContainer.className = 'flex flex-col items-center justify-center h-full p-4';
    
    // Create card
    const card = new Card('max-w-md w-full bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Join Room');
    cardHeader.appendChild(cardTitle.getElement());
    card.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent('flex flex-col gap-4');
    
    // Room code input
    const inputContainer = document.createElement('div');
    inputContainer.className = 'grid w-full items-center gap-1.5';
    
    const inputLabel = new Label('Room Code:', { htmlFor: 'room-code-input' });
    
    const roomCodeInputComponent = new Input({
      placeholder: 'Enter room code',
      id: 'room-code-input',
      maxLength: 6
    });
    const roomCodeInput = roomCodeInputComponent.getElement();
    roomCodeInput.style.textTransform = 'uppercase';
    
    inputContainer.appendChild(inputLabel.getElement());
    inputContainer.appendChild(roomCodeInput);
    
    // Join button
    const joinButton = new Button('Join', {
      size: ButtonSize.LG,
      className: 'w-full mt-2'
    });
    joinButton.addEventListener('click', () => {
      const roomCode = roomCodeInput.value.trim().toUpperCase();
      
      if (roomCode.length === 6) {
        this.joinRoom(roomCode);
      } else {
        alert('Please enter a valid room code (6 characters)');
      }
    });
    
    // Back button
    const backButton = new Button('Back to Menu', {
      variant: ButtonVariant.OUTLINE,
      className: 'w-full mt-2'
    });
    backButton.addEventListener('click', () => this.showMainMenu());
    
    cardContent.appendChild(inputContainer);
    cardContent.appendChild(joinButton.getElement());
    cardContent.appendChild(backButton.getElement());
    
    card.appendChild(cardContent.getElement());
    joinRoomContainer.appendChild(card.getElement());
    
    // Add the join room UI to the container
    this.container.appendChild(joinRoomContainer);
    
    // Focus the input
    setTimeout(() => {
      roomCodeInput.focus();
    }, 0);
    
    // Add enter key event listener
    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        if (roomCode.length === 6) {
          this.joinRoom(roomCode);
        } else {
          alert('Please enter a valid room code (6 characters)');
        }
      }
    });
  }
  
  /**
   * Join an existing room
   * @param roomCode The room code to join
   */
  private joinRoom(roomCode: string): void {
    if (!this.signalingClient) return;
    
    console.log('Joining room:', roomCode);
    this.signalingClient.joinRoom(roomCode);
    
    // Show loading indicator
    if (this.container) {
      this.container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full">
          <h2 class="text-2xl font-bold mb-4">Joining Room ${roomCode}...</h2>
          <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      `;
    }
  }
  
  /**
   * Show the waiting room
   */
  private showWaitingRoom(): void {
    if (!this.container || !this.roomCode) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the waiting room UI
    const waitingRoomContainer = document.createElement('div');
    waitingRoomContainer.className = 'flex flex-col items-center justify-center h-full p-4';
    
    // Create card
    const card = new Card('max-w-md w-full bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Waiting for Players');
    const cardDescription = new CardDescription('Share the room code with another player to join');
    cardHeader.appendChild(cardTitle.getElement());
    cardHeader.appendChild(cardDescription.getElement());
    card.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent('flex flex-col gap-4');
    
    // Room code display
    const roomCodeContainer = document.createElement('div');
    roomCodeContainer.className = 'bg-gray-100 p-4 rounded-md text-center';
    
    const roomCodeLabel = document.createElement('p');
    roomCodeLabel.className = 'text-gray-700 text-sm mb-1';
    roomCodeLabel.textContent = 'Room Code:';
    
    const roomCodeDisplay = document.createElement('p');
    roomCodeDisplay.className = 'text-3xl font-bold tracking-wider';
    roomCodeDisplay.textContent = this.roomCode;
    
    roomCodeContainer.appendChild(roomCodeLabel);
    roomCodeContainer.appendChild(roomCodeDisplay);
    
    // Copy button
    const copyButton = new Button('Copy Room Code', {
      variant: ButtonVariant.SECONDARY,
      className: 'w-full mt-2'
    });
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(this.roomCode || '')
        .then(() => {
          const btn = copyButton.getElement();
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = 'Copy Room Code';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy room code:', err);
        });
    });
    
    // Loading indicator
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'flex flex-col items-center justify-center mt-4';
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4';
    
    const loadingText = document.createElement('p');
    loadingText.className = 'text-gray-700 text-center';
    loadingText.textContent = 'Waiting for another player to join...';
    
    const loadingSubtext = document.createElement('p');
    loadingSubtext.className = 'text-gray-500 text-sm mt-2 text-center';
    loadingSubtext.textContent = 'The game will start automatically when someone joins';
    
    loadingContainer.appendChild(loadingSpinner);
    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(loadingSubtext);
    
    // Leave button
    const leaveButton = new Button('Leave Room', {
      variant: ButtonVariant.DESTRUCTIVE,
      className: 'w-full mt-4'
    });
    leaveButton.addEventListener('click', () => {
      if (this.signalingClient) {
        this.signalingClient.disconnect();
        this.roomCode = null;
        this.showMainMenu();
      }
    });
    
    cardContent.appendChild(roomCodeContainer);
    cardContent.appendChild(copyButton.getElement());
    cardContent.appendChild(loadingContainer);
    cardContent.appendChild(leaveButton.getElement());
    
    card.appendChild(cardContent.getElement());
    waitingRoomContainer.appendChild(card.getElement());
    
    // Add the waiting room UI to the container
    this.container.appendChild(waitingRoomContainer);
  }
  
  /**
   * Start the game with a countdown
   */
  private startGame(): void {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the countdown UI
    const countdownContainer = document.createElement('div');
    countdownContainer.className = 'flex flex-col items-center justify-center h-full';
    
    // Create card
    const card = new Card('max-w-md w-full bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Game Starting...');
    cardHeader.appendChild(cardTitle.getElement());
    card.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent('flex flex-col items-center gap-4');
    
    // Room info
    const roomInfo = document.createElement('p');
    roomInfo.className = 'text-gray-700';
    roomInfo.textContent = `Room: ${this.roomCode}`;
    
    // Countdown number
    const countdownNumber = document.createElement('div');
    countdownNumber.className = 'text-7xl font-bold my-8';
    countdownNumber.textContent = '3';
    
    cardContent.appendChild(roomInfo);
    cardContent.appendChild(countdownNumber);
    
    card.appendChild(cardContent.getElement());
    countdownContainer.appendChild(card.getElement());
    
    // Add the countdown UI to the container
    this.container.appendChild(countdownContainer);
    
    // Start the countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      countdownNumber.textContent = count.toString();
      
      if (count <= 0) {
        clearInterval(countdownInterval);
        this.initializeGame();
      }
    }, 1000);
  }
  
  /**
   * Initialize the game after countdown
   */
  private initializeGame(): void {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the game UI
    const gameContainer = document.createElement('div');
    gameContainer.className = 'w-full h-full relative';
    
    // Game canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-full block';
    canvas.id = 'game-canvas';
    gameContainer.appendChild(canvas);
    
    // Game info overlay
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded';
    infoOverlay.innerHTML = `
      <p>Room: <span class="font-bold">${this.roomCode}</span></p>
      <p>Player ID: <span class="font-mono text-xs">${this.playerId?.substring(0, 8)}</span></p>
    `;
    gameContainer.appendChild(infoOverlay);
    
    // Add the game UI to the container
    this.container.appendChild(gameContainer);
    
    // Initialize the game canvas
    this.initializeGameCanvas();
    
    console.log('Game started!');
  }
  
  /**
   * Initialize the game canvas
   */
  private initializeGameCanvas(): void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    // Set canvas size to match container
    const resizeCanvas = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    
    // Resize canvas initially and on window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw a simple placeholder
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars
    ctx.fillStyle = '#FFF';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = Math.random() * 2 + 1;
      ctx.fillRect(x, y, size, size);
    }
    
    // Draw placeholder text
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Connected!', canvas.width / 2, canvas.height / 2);
    ctx.font = '18px Arial';
    ctx.fillText('Implement your game logic here', canvas.width / 2, canvas.height / 2 + 30);
  }
  
  /**
   * Handle player disconnection
   */
  private handlePlayerDisconnected(): void {
    // Show a message that the other player disconnected
    if (this.container) {
      const disconnectOverlay = document.createElement('div');
      disconnectOverlay.className = 'absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center';
      
      // Create card
      const card = new Card('max-w-md w-full bg-white');
      
      // Card header
      const cardHeader = new CardHeader();
      const cardTitle = new CardTitle('Player Disconnected');
      cardHeader.appendChild(cardTitle.getElement());
      card.appendChild(cardHeader.getElement());
      
      // Card content
      const cardContent = new CardContent('flex flex-col gap-4');
      
      const message = document.createElement('p');
      message.className = 'text-center mb-4';
      message.textContent = 'The other player has disconnected from the game.';
      
      const returnButton = new Button('Return to Menu', {
        size: ButtonSize.LG,
        className: 'w-full'
      });
      
      cardContent.appendChild(message);
      cardContent.appendChild(returnButton.getElement());
      
      card.appendChild(cardContent.getElement());
      disconnectOverlay.appendChild(card.getElement());
      
      this.container.appendChild(disconnectOverlay);
      
      // Add event listener to the button
      returnButton.addEventListener('click', () => {
        if (this.signalingClient) {
          this.signalingClient.disconnect();
          this.roomCode = null;
          this.showMainMenu();
        }
      });
    }
  }
  
  /**
   * Show an error message
   * @param message The error message to show
   */
  private showError(message: string): void {
    if (!this.container) return;
    
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center';
    
    // Create card
    const card = new Card('max-w-md w-full bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Error');
    cardHeader.appendChild(cardTitle.getElement());
    card.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent('flex flex-col gap-4');
    
    const errorMessage = document.createElement('p');
    errorMessage.className = 'text-center mb-4';
    errorMessage.textContent = message;
    
    const okButton = new Button('OK', {
      size: ButtonSize.LG,
      className: 'w-full'
    });
    
    cardContent.appendChild(errorMessage);
    cardContent.appendChild(okButton.getElement());
    
    card.appendChild(cardContent.getElement());
    errorOverlay.appendChild(card.getElement());
    
    this.container.appendChild(errorOverlay);
    
    // Add event listener to the button
    okButton.addEventListener('click', () => {
      errorOverlay.remove();
    });
  }
  
  /**
   * Show the main menu
   */
  private showMainMenu(): void {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the main menu
    const menuContainer = document.createElement('div');
    menuContainer.className = 'flex flex-col items-center justify-center h-full p-4';
    
    // Create card
    const card = new Card('max-w-md w-full bg-white');
    
    // Card header
    const cardHeader = new CardHeader();
    const cardTitle = new CardTitle('Space Shooter');
    cardHeader.appendChild(cardTitle.getElement());
    card.appendChild(cardHeader.getElement());
    
    // Card content
    const cardContent = new CardContent('flex flex-col gap-4');
    
    // Create Room button
    const createRoomBtn = new Button('Create Room', {
      size: ButtonSize.LG,
      className: 'w-full'
    });
    createRoomBtn.addEventListener('click', () => this.createRoom());
    
    // Join Room button
    const joinRoomBtn = new Button('Join Room', {
      variant: ButtonVariant.SECONDARY,
      size: ButtonSize.LG,
      className: 'w-full'
    });
    joinRoomBtn.addEventListener('click', () => this.showJoinRoomUI());
    
    cardContent.appendChild(createRoomBtn.getElement());
    cardContent.appendChild(joinRoomBtn.getElement());
    
    card.appendChild(cardContent.getElement());
    menuContainer.appendChild(card.getElement());
    
    // Add the menu to the container
    this.container.appendChild(menuContainer);
  }
  
  /**
   * Show the game and hide the lobby
   */
  private showGame(): void {
    this.lobbyElement.classList.add('hidden');
    this.gameElement.classList.remove('hidden');
    
    // Start the game
    if (this.game) {
      this.game.start();
    }
  }
  
  /**
   * Show or hide the reconnect overlay
   * @param show Whether to show the overlay
   */
  private showReconnectOverlay(show: boolean): void {
    if (show) {
      this.reconnectOverlay.classList.remove('hidden');
    } else {
      this.reconnectOverlay.classList.add('hidden');
    }
  }
  
  /**
   * Return to the lobby
   */
  returnToLobby(): void {
    // Stop the game
    if (this.game) {
      this.game.stop();
    }
    
    // Hide the game and show the lobby
    this.gameElement.classList.add('hidden');
    this.lobbyElement.classList.remove('hidden');
    
    // Reset the room code display
    this.roomCodeDisplay.classList.add('hidden');
    
    // Reset the status
    this.updateStatus('Connected to server');
    this.enableButtons(true);
  }
  
  /**
   * Update the status message
   * @param message The status message
   * @param isError Whether this is an error message
   */
  private updateStatus(message: string, isError: boolean = false): void {
    this.statusElement.textContent = message;
    
    if (isError) {
      this.statusElement.className = 'text-center text-red-600 mt-4';
    } else {
      this.statusElement.className = 'text-center text-gray-600 mt-4';
    }
  }
  
  /**
   * Enable or disable the buttons
   * @param enabled Whether the buttons should be enabled
   */
  private enableButtons(enabled: boolean): void {
    this.createRoomButton.disabled = !enabled;
    this.joinRoomButton.disabled = !enabled;
    this.roomCodeInput.disabled = !enabled;
    
    if (enabled) {
      this.createRoomButton.classList.remove('opacity-50', 'cursor-not-allowed');
      this.joinRoomButton.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      this.createRoomButton.classList.add('opacity-50', 'cursor-not-allowed');
      this.joinRoomButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
} 