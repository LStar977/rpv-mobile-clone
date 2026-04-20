'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  href?: string;
  onClick?: () => void;
  icon?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold/90 active:bg-gold/80',
  secondary: 'border border-paper/20 text-paper hover:bg-paper/5 active:bg-paper/10',
  ghost: 'text-paper/60 hover:text-paper',
};

export function Button({
  children,
  variant = 'primary',
  href,
  onClick,
  icon = true,
  disabled,
  fullWidth = true,
  type = 'button',
}: ButtonProps) {
  const classes = `
    inline-flex items-center justify-center gap-2
    font-display font-medium text-[15px] tracking-tight
    rounded-full px-6 py-3.5
    transition-all duration-150
    disabled:opacity-50 disabled:pointer-events-none
    ${fullWidth ? 'w-full' : ''}
    ${variants[variant]}
  `;

  const content = (
    <>
      <span>{children}</span>
      {icon && variant === 'primary' && <ArrowRight size={17} strokeWidth={2.5} />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
