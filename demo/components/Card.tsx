import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export function Card({ children, className = '', accent = false }: CardProps) {
  return (
    <div
      className={`
        rounded-3xl p-6
        bg-paper/[0.02]
        border
        ${accent ? 'border-gold/25' : 'border-paper/10'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
