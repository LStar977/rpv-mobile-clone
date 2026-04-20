'use client';

import { motion } from 'framer-motion';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { proposal } from '@/lib/demoData';
import { ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <Shell step={1}>
      <div className="flex-1 flex flex-col justify-center pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-3"
        >
          <span className="font-mono text-[11px] tracking-[0.2em] text-gold uppercase">
            Proposal · {proposal.id}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-display text-[34px] leading-[1.1] font-semibold tracking-tight text-paper mb-5"
        >
          Your city wants to know{' '}
          <span className="text-gold">what you think</span> about transit expansion.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-[15px] leading-relaxed text-paper/70 mb-10"
        >
          {proposal.subLine}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card accent className="mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={16} className="text-gold" />
              </div>
              <div>
                <div className="text-[14px] font-medium text-paper mb-0.5">
                  Verified, anonymous, permanent
                </div>
                <div className="text-[13px] text-paper/60 leading-relaxed">
                  Your identity stays private. Your eligibility is recorded on Base.
                </div>
              </div>
            </div>
          </Card>

          <Button href="/verify">Participate</Button>

          <p className="text-center text-[11px] font-mono tracking-wider text-paper/40 mt-6 uppercase">
            Verified by Represent · Recorded on Base
          </p>
        </motion.div>
      </div>
    </Shell>
  );
}
