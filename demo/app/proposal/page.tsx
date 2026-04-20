'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin, Check, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Card } from '@/components/Card';
import { proposal } from '@/lib/demoData';

type Choice = 'support' | 'oppose' | null;

export default function ProposalPage() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVote = (vote: 'support' | 'oppose') => {
    if (submitting) return;
    setChoice(vote);
    setSubmitting(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('represent_choice', vote);
    }
    setTimeout(() => router.push('/confirm'), 550);
  };

  return (
    <Shell step={3}>
      <div className="flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 mb-5"
        >
          <MapPin size={13} className="text-gold" />
          <span className="font-mono text-[11px] tracking-wider text-gold uppercase">
            {proposal.jurisdiction}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-display text-[28px] leading-[1.15] font-semibold tracking-tight text-paper mb-5"
        >
          {proposal.question}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6">
            <p className="text-[14px] leading-relaxed text-paper/75">
              {proposal.context}
            </p>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-paper/10">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-paper/40 uppercase mb-1">
                  Cost
                </div>
                <div className="font-display text-[14px] font-medium text-paper">$800M</div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-widest text-paper/40 uppercase mb-1">
                  Stations
                </div>
                <div className="font-display text-[14px] font-medium text-paper">4 new</div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-widest text-paper/40 uppercase mb-1">
                  Complete
                </div>
                <div className="font-display text-[14px] font-medium text-paper">2027</div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-auto space-y-3"
        >
          <p className="text-center text-[13px] text-paper/50 mb-2">
            Cast your verified voice
          </p>

          <motion.button
            onClick={() => handleVote('support')}
            disabled={submitting}
            whileTap={{ scale: 0.98 }}
            animate={choice === 'support' ? { scale: [1, 1.02, 1] } : {}}
            className={`
              w-full flex items-center justify-center gap-2.5
              py-4 rounded-full font-display font-medium text-[15px]
              transition-all duration-200
              ${
                choice === 'support'
                  ? 'bg-success text-ink'
                  : 'border-2 border-success/60 text-success hover:bg-success/10'
              }
              ${submitting && choice !== 'support' ? 'opacity-30' : ''}
            `}
          >
            <Check size={18} strokeWidth={2.5} />
            Support
          </motion.button>

          <motion.button
            onClick={() => handleVote('oppose')}
            disabled={submitting}
            whileTap={{ scale: 0.98 }}
            animate={choice === 'oppose' ? { scale: [1, 1.02, 1] } : {}}
            className={`
              w-full flex items-center justify-center gap-2.5
              py-4 rounded-full font-display font-medium text-[15px]
              transition-all duration-200
              ${
                choice === 'oppose'
                  ? 'bg-steel text-paper'
                  : 'border-2 border-steel/60 text-steel hover:bg-steel/10'
              }
              ${submitting && choice !== 'oppose' ? 'opacity-30' : ''}
            `}
          >
            <X size={18} strokeWidth={2.5} />
            Oppose
          </motion.button>
        </motion.div>
      </div>
    </Shell>
  );
}
