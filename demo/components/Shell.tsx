'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { ProgressDots } from './ProgressDots';

interface ShellProps {
  children: React.ReactNode;
  step?: number;
  total?: number;
}

export function Shell({ children, step, total = 5 }: ShellProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-ink">
      <div className="w-full max-w-md min-h-screen flex flex-col px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-[15px] font-medium tracking-tight text-paper">
              Represent
            </span>
          </div>
          {step !== undefined && <ProgressDots current={step} total={total} />}
        </header>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
