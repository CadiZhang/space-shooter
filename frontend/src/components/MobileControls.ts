/**
 * MobileControls provides touch-based directional controls for mobile devices
 */
export class MobileControls {
  private container: HTMLElement;
  private upButton: HTMLElement;
  private downButton: HTMLElement;
  private leftButton: HTMLElement;
  private rightButton: HTMLElement;
  private keys: { [key: string]: boolean } = {};
  private isTouchDevice: boolean;
  
  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'mobile-controls';
    
    // Check if this is a touch device
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Create the control buttons
    this.upButton = this.createButton('↑', 'up');
    this.downButton = this.createButton('↓', 'down');
    this.leftButton = this.createButton('←', 'left');
    this.rightButton = this.createButton('→', 'right');
    
    // Add buttons to the grid
    // Empty cells are represented by null
    const buttonGrid = [
      [null, this.upButton, null],
      [this.leftButton, null, this.rightButton],
      [null, this.downButton, null]
    ];
    
    // Create the grid layout
    buttonGrid.forEach(row => {
      row.forEach(button => {
        if (button) {
          this.container.appendChild(button);
        } else {
          const emptyCell = document.createElement('div');
          this.container.appendChild(emptyCell);
        }
      });
    });
    
    // Add the controls to the parent element
    parentElement.appendChild(this.container);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Create a control button
   * @param label The button label
   * @param direction The direction this button represents
   */
  private createButton(label: string, direction: string): HTMLElement {
    const button = document.createElement('div');
    button.className = 'control-button';
    button.textContent = label;
    button.dataset.direction = direction;
    return button;
  }
  
  /**
   * Set up touch event listeners
   */
  private setupEventListeners(): void {
    if (!this.isTouchDevice) {
      // Hide the controls on non-touch devices
      this.container.style.display = 'none';
      return;
    }
    
    // Map directions to key codes
    const directionToKey: { [key: string]: string } = {
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight'
    };
    
    // Touch start event (button press)
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const direction = target.dataset.direction;
      
      if (direction && directionToKey[direction]) {
        this.keys[directionToKey[direction]] = true;
        target.classList.add('active');
      }
    };
    
    // Touch end event (button release)
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const direction = target.dataset.direction;
      
      if (direction && directionToKey[direction]) {
        this.keys[directionToKey[direction]] = false;
        target.classList.remove('active');
      }
    };
    
    // Add event listeners to all buttons
    [this.upButton, this.downButton, this.leftButton, this.rightButton].forEach(button => {
      button.addEventListener('touchstart', handleTouchStart, { passive: false });
      button.addEventListener('touchend', handleTouchEnd, { passive: false });
      button.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    });
  }
  
  /**
   * Get the current state of the keys
   */
  getKeys(): { [key: string]: boolean } {
    return this.keys;
  }
  
  /**
   * Show or hide the mobile controls
   * @param show Whether to show the controls
   */
  show(show: boolean): void {
    if (this.isTouchDevice) {
      this.container.style.display = show ? 'grid' : 'none';
    }
  }
  
  /**
   * Check if this is a touch device
   */
  isMobileDevice(): boolean {
    return this.isTouchDevice;
  }
} 