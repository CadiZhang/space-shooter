/**
 * Player class represents a player in the game
 */
export class Player {
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private speed: number;
  private color: string;
  private id: string;
  private isLocal: boolean;
  
  constructor(id: string, x: number, y: number, color: string, isLocal: boolean = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = 50;
    this.height = 50;
    this.speed = 5;
    this.color = color;
    this.isLocal = isLocal;
  }
  
  /**
   * Update the player's position based on input
   * @param keys Object containing the state of keyboard keys
   * @param canvasWidth The width of the game canvas
   * @param canvasHeight The height of the game canvas
   * @returns Whether the position was changed
   */
  update(keys: { [key: string]: boolean }, canvasWidth: number, canvasHeight: number): boolean {
    if (!this.isLocal) {
      return false; // Only update local player based on input
    }
    
    let moved = false;
    
    // Move based on keyboard input
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
      this.y = Math.max(0, this.y - this.speed);
      moved = true;
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
      this.y = Math.min(canvasHeight - this.height, this.y + this.speed);
      moved = true;
    }
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.x = Math.max(0, this.x - this.speed);
      moved = true;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.x = Math.min(canvasWidth - this.width, this.x + this.speed);
      moved = true;
    }
    
    return moved;
  }
  
  /**
   * Set the player's position directly (used for remote player updates)
   * @param x The new x coordinate
   * @param y The new y coordinate
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  
  /**
   * Draw the player on the canvas
   * @param ctx The canvas rendering context
   */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    // Draw a border around the player
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Draw player ID above the square
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.isLocal ? 'You' : 'Opponent', this.x + this.width / 2, this.y - 10);
  }
  
  /**
   * Get the player's position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
  
  /**
   * Get the player's ID
   */
  getId(): string {
    return this.id;
  }
  
  /**
   * Check if this is the local player
   */
  getIsLocal(): boolean {
    return this.isLocal;
  }
} 