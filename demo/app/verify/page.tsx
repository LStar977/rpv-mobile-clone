'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

const phases = [
  'Verifying identity…',
  'Confirming jurisdiction…',
  'Checking eligibility…',
];

export default function VerifyPage() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhaseIndex(1), 500));
    timers.push(setTimeout(() => setPhaseIndex(2), 950));
    timers.push(setTimeout(() => setDone(true), 1400));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Shell step={2}>
      <div className="flex-1 flex flex-col">
        <div className="mb-2">
          <span className="font-mono text-[11px] tracking-[0.2em] text-gold uppercase">
            Step 02 · Verification
          </span>
        </div>
        <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight text-paper mb-2">
          Scan your government ID
        </h1>
        <p className="text-[14px] text-paper/60 mb-8">
          Your identity is never shared. Only your eligibility is recorded.
        </p>

        <div className="flex-1 flex flex-col items-center justify-center">
          {/* ID card with scan animation */}
          <div className="relative w-full max-w-[280px] aspect-[1.6/1] mb-8">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 rounded-2xl border border-gold/30 bg-gradient-to-br from-paper/5 to-paper/[0.02] overflow-hidden"
            >
              {/* Fake ID contents */}
              <div className="p-4 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-gold/40" />
                  <div className="font-mono text-[9px] tracking-widest text-paper/60 uppercase">
                    Alberta · ID
                  </div>
                </div>
                <div className="flex gap-3 flex-1">
                  <div className="w-14 h-16 rounded bg-paper/10" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-1.5 rounded-full bg-paper/20 w-3/4" />
                    <div className="h-1.5 rounded-full bg-paper/10 w-1/2" />
                    <div className="h-1.5 rounded-full bg-paper/10 w-2/3" />
                    <div className="h-1.5 rounded-full bg-paper/10 w-5/12" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="h-1 rounded-full bg-paper/10 flex-1" />
                  <div className="h-1 rounded-full bg-paper/10 w-10" />
                </div>
              </div>

              {/* Scanning line */}
              {!done && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent shadow-[0_0_12px_rgba(234,186,88,0.8)] animate-scan" />
                </div>
              )}

              {/* Success overlay */}
              <AnimatePresence>
                {done && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-success/20 flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      className="w-14 h-14 rounded-full bg-success flex items-center justify-center"
                    >
                      <Check size={28} strokeWidth={3} className="text-ink" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Phase text / result */}
          <div className="h-20 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div
                  key={phaseIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    <span className="font-mono text-[12px] tracking-widest text-paper/70 uppercase">
                      {phases[phaseIndex]}
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <div className="font-display text-[20px] font-semibold text-paper mb-1">
                    Verified in <span className="font-mono text-gold">1.4s</span>
                  </div>
                  <div className="text-[13px] text-paper/60">
                    Calgary, AB · Ward 7 · Eligible
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-auto"
            >
              <Button href="/proposal">Continue</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );
}
