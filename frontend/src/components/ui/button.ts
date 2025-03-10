/**
 * Button component with shadcn/ui styling
 * This is a simplified version of shadcn/ui's button component adapted for vanilla TypeScript
 */

export enum ButtonVariant {
  DEFAULT = 'default',
  DESTRUCTIVE = 'destructive',
  OUTLINE = 'outline',
  SECONDARY = 'secondary',
  GHOST = 'ghost',
  LINK = 'link',
}

export enum ButtonSize {
  DEFAULT = 'default',
  SM = 'sm',
  LG = 'lg',
  ICON = 'icon',
}

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

export class Button {
  private element: HTMLButtonElement;
  
  constructor(text: string, props: ButtonProps = {}) {
    this.element = document.createElement('button');
    this.element.textContent = text;
    this.element.className = this.getButtonClasses(props);
    
    if (props.disabled) {
      this.element.disabled = true;
      this.element.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
  
  private getButtonClasses(props: ButtonProps): string {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background';
    
    // Variant classes
    let variantClasses = '';
    switch (props.variant) {
      case ButtonVariant.DESTRUCTIVE:
        variantClasses = 'bg-red-500 text-white hover:bg-red-600';
        break;
      case ButtonVariant.OUTLINE:
        variantClasses = 'border border-input hover:bg-accent hover:text-accent-foreground';
        break;
      case ButtonVariant.SECONDARY:
        variantClasses = 'bg-gray-200 text-gray-900 hover:bg-gray-300';
        break;
      case ButtonVariant.GHOST:
        variantClasses = 'hover:bg-accent hover:text-accent-foreground';
        break;
      case ButtonVariant.LINK:
        variantClasses = 'underline-offset-4 hover:underline text-blue-500';
        break;
      default:
        variantClasses = 'bg-blue-500 text-white hover:bg-blue-600';
        break;
    }
    
    // Size classes
    let sizeClasses = '';
    switch (props.size) {
      case ButtonSize.SM:
        sizeClasses = 'h-9 px-3';
        break;
      case ButtonSize.LG:
        sizeClasses = 'h-11 px-8';
        break;
      case ButtonSize.ICON:
        sizeClasses = 'h-10 w-10';
        break;
      default:
        sizeClasses = 'h-10 py-2 px-4';
        break;
    }
    
    return `${baseClasses} ${variantClasses} ${sizeClasses} ${props.className || ''}`;
  }
  
  public getElement(): HTMLButtonElement {
    return this.element;
  }
  
  public addEventListener(event: string, callback: EventListener): void {
    this.element.addEventListener(event, callback);
  }
  
  public setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
    if (disabled) {
      this.element.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      this.element.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
} 