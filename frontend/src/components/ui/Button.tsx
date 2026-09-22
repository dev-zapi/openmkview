import { splitProps, type Component, type ComponentProps } from 'solid-js';
import { cn } from './cn';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'icon';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-input bg-background hover:bg-secondary text-foreground',
  ghost: 'hover:bg-secondary text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 text-sm',
  icon: 'h-9 w-9 p-0',
};

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class', 'classList', 'children']);
  const variant = () => local.variant ?? 'default';
  const size = () => local.size ?? 'default';

  return (
    <button
      {...rest}
      class={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant()],
        sizeClasses[size()],
        local.class,
      )}
      classList={local.classList}
    >
      {local.children}
    </button>
  );
};

export default Button;
