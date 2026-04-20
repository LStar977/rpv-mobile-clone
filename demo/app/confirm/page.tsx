'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, Copy } from 'lucide-react';
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
          <h1 className="font-display text-[24px] leading-tight font-semibold tracking-tight text-paper mb-2">
            Your response has been<br />
            cryptographically recorded.
          </h1>
          <p className="text-[14px] text-paper/60">
            Permanent. Anonymous. Verifiable by anyone.
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
                {receipt.network}
              </span>
            </div>

            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Block</dt>
                <dd className="font-mono text-[13px] text-paper">
                  {receipt.block.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Transaction</dt>
                <dd className="flex items-center gap-2">
                  <code className="font-mono text-[13px] text-paper">
                    {truncateHash(receipt.txHash)}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="text-paper/40 hover:text-gold transition-colors"
                    aria-label="Copy hash"
                  >
                    <Copy size={13} />
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Response</dt>
                <dd className="font-display text-[13px] font-medium text-paper capitalize">
                  {choice || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[12px] text-paper/50">Confirmed</dt>
                <dd className="font-mono text-[13px] text-paper">2s ago</dd>
              </div>
            </dl>

            {copied && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-center text-[11px] font-mono text-success uppercase tracking-wider"
              >
                Hash copied
              </motion.div>
            )}
          </Card>

          <a
            href={`https://basescan.org/tx/${receipt.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[12px] text-paper/50 hover:text-gold transition-colors mb-8"
          >
            View on BaseScan
            <ExternalLink size={12} />
          </a>
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
