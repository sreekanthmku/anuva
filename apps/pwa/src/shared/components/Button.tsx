import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[12px] bg-primary px-4 py-2 font-small text-on-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
