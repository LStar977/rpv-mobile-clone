'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { receipt } from '@/lib/demoData';

function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export default function ConfirmPage() {
  const [choice, setChoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setChoice(sessionStorage.getItem('represent_choice'));
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Shell step={4}>
      <div className="flex-1 flex flex-col">
        {/* Success mark */}
        <div className="flex flex-col items-center pt-6 pb-8">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 180 }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-full bg-success/30 blur-2xl" />
            <div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center">
              <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <Check size={40} strokeWidth={3} className="text-ink" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-paper mb-2">
            Your voice has been counted.
          </h1>
          <p className="text-[14px] text-paper/60">
            Anonymous. Permanent. Verified.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card accent className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] tracking-[0.2em] text-gold uppercase">
                Receipt
              </span>
              <span className="font-mono text-[10px] tracking-wider text-paper/40 uppercase">
                #{receipt.block.toLocaleString()}
              </span>
            </div>

            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Response</dt>
                <dd className="font-display text-[13px] font-medium text-paper capitalize">
                  {choice || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Jurisdiction</dt>
                <dd className="font-display text-[13px] font-medium text-paper">
                  Calgary · Ward 7
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Status</dt>
                <dd className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="font-display text-[13px] font-medium text-success">
                    Verified
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Confirmed</dt>
                <dd className="font-mono text-[13px] text-paper">2s ago</dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t border-paper/10 flex items-center justify-between">
              <span className="text-[11px] text-paper/40">Proof</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[11px] text-paper/60">
                  {truncateHash(receipt.txHash)}
                </code>
                <button
                  onClick={handleCopy}
                  className="text-paper/40 hover:text-gold transition-colors"
                  aria-label="Copy proof hash"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            {copied && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-center text-[11px] font-mono text-success uppercase tracking-wider"
              >
                Proof copied
              </motion.div>
            )}
          </Card>

          <p className="text-center text-[11px] font-mono tracking-wider text-paper/30 uppercase mb-8">
            Every response is independently verifiable
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-auto"
        >
          <Button href="/results">See results</Button>
        </motion.div>
      </div>
    </Shell>
  );
}
