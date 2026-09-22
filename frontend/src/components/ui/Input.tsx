import { splitProps, type Component, type ComponentProps } from 'solid-js';
import { cn } from './cn';

export interface InputProps extends ComponentProps<'input'> {}

export const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <input
      {...rest}
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-secondary px-3 py-1 text-sm',
        'transition-colors placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        local.class,
      )}
      classList={local.classList}
    />
  );
};

export default Input;
