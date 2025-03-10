/**
 * Card component with shadcn/ui styling
 * This is a simplified version of shadcn/ui's card component adapted for vanilla TypeScript
 */

export class Card {
  private element: HTMLDivElement;
  
  constructor(className: string = '') {
    this.element = document.createElement('div');
    this.element.className = `rounded-lg border bg-card text-card-foreground shadow-sm ${className}`;
  }
  
  public getElement(): HTMLDivElement {
    return this.element;
  }
  
  public appendChild(child: HTMLElement | Element): void {
    this.element.appendChild(child);
  }
}

export class CardHeader {
  private element: HTMLDivElement;
  
  constructor(className: string = '') {
    this.element = document.createElement('div');
    this.element.className = `flex flex-col space-y-1.5 p-6 ${className}`;
  }
  
  public getElement(): HTMLDivElement {
    return this.element;
  }
  
  public appendChild(child: HTMLElement | Element): void {
    this.element.appendChild(child);
  }
}

export class CardTitle {
  private element: HTMLHeadingElement;
  
  constructor(text: string, className: string = '') {
    this.element = document.createElement('h3');
    this.element.className = `text-2xl font-semibold leading-none tracking-tight ${className}`;
    this.element.textContent = text;
  }
  
  public getElement(): HTMLHeadingElement {
    return this.element;
  }
}

export class CardDescription {
  private element: HTMLParagraphElement;
  
  constructor(text: string, className: string = '') {
    this.element = document.createElement('p');
    this.element.className = `text-sm text-muted-foreground ${className}`;
    this.element.textContent = text;
  }
  
  public getElement(): HTMLParagraphElement {
    return this.element;
  }
}

export class CardContent {
  private element: HTMLDivElement;
  
  constructor(className: string = '') {
    this.element = document.createElement('div');
    this.element.className = `p-6 pt-0 ${className}`;
  }
  
  public getElement(): HTMLDivElement {
    return this.element;
  }
  
  public appendChild(child: HTMLElement | Element): void {
    this.element.appendChild(child);
  }
}

export class CardFooter {
  private element: HTMLDivElement;
  
  constructor(className: string = '') {
    this.element = document.createElement('div');
    this.element.className = `flex items-center p-6 pt-0 ${className}`;
  }
  
  public getElement(): HTMLDivElement {
    return this.element;
  }
  
  public appendChild(child: HTMLElement | Element): void {
    this.element.appendChild(child);
  }
} 