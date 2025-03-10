/**
 * Input component with shadcn/ui styling
 * This is a simplified version of shadcn/ui's input component adapted for vanilla TypeScript
 */

export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  id?: string;
}

export class Input {
  private element: HTMLInputElement;
  
  constructor(props: InputProps = {}) {
    this.element = document.createElement('input');
    this.element.className = `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ''}`;
    
    this.element.type = props.type || 'text';
    
    if (props.placeholder) {
      this.element.placeholder = props.placeholder;
    }
    
    if (props.value) {
      this.element.value = props.value;
    }
    
    if (props.disabled) {
      this.element.disabled = true;
    }
    
    if (props.maxLength) {
      this.element.maxLength = props.maxLength;
    }
    
    if (props.id) {
      this.element.id = props.id;
    }
  }
  
  public getElement(): HTMLInputElement {
    return this.element;
  }
  
  public getValue(): string {
    return this.element.value;
  }
  
  public setValue(value: string): void {
    this.element.value = value;
  }
  
  public addEventListener(event: string, callback: EventListener): void {
    this.element.addEventListener(event, callback);
  }
  
  public focus(): void {
    this.element.focus();
  }
} 