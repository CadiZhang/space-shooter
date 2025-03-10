/**
 * Label component with shadcn/ui styling
 * This is a simplified version of shadcn/ui's label component adapted for vanilla TypeScript
 */

export interface LabelProps {
  htmlFor?: string;
  className?: string;
}

export class Label {
  private element: HTMLLabelElement;
  
  constructor(text: string, props: LabelProps = {}) {
    this.element = document.createElement('label');
    this.element.className = `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${props.className || ''}`;
    this.element.textContent = text;
    
    if (props.htmlFor) {
      this.element.htmlFor = props.htmlFor;
    }
  }
  
  public getElement(): HTMLLabelElement {
    return this.element;
  }
} 