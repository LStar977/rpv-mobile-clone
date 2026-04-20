'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Mail, TrendingUp } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { results, investorEmail } from '@/lib/demoData';

const mailtoHref = `mailto:${investorEmail}?subject=${encodeURIComponent(
  'Represent — Investor Meeting'
)}&body=${encodeURIComponent(
  'Hi Lance,\n\nI played with the Represent demo and would like to learn more.\n\n'
)}`;

function Bar({
  label,
  support,
  total,
  delay = 0,
}: {
  label: string;
  support: number;
  total: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3"
    >
      <div className="font-mono text-[11px] tracking-wider text-paper/50 uppercase w-12">
        {label}
      </div>
      <div className="flex-1 h-6 rounded-full bg-paper/[0.04] overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${support}%` }}
          transition={{ delay: delay + 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-gradient-to-r from-success/70 to-success rounded-full"
        />
        <span className="absolute inset-0 flex items-center justify-end pr-3 font-mono text-[11px] font-semibold text-paper">
          {support}%
        </span>
      </div>
      <div className="font-mono text-[10px] text-paper/40 w-12 text-right">
        {total.toLocaleString()}
      </div>
    </motion.div>
  );
}

export default function ResultsPage() {
  return (
    <Shell step={5}>
      <div className="flex-1 flex flex-col pb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="font-mono text-[11px] tracking-[0.2em] text-gold uppercase">
            Public Consensus
          </span>
          <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight text-paper mt-1 mb-6">
            Calgary LRT expansion to Ward 7
          </h1>
        </motion.div>

        {/* Headline split */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card accent className="mb-6">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-paper/40 uppercase mb-1">
                  Support
                </div>
                <div className="font-display text-[44px] leading-none font-semibold text-success">
                  {results.supportPct}
                  <span className="text-[24px] text-success/60">%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] tracking-[0.2em] text-paper/40 uppercase mb-1">
                  Oppose
                </div>
                <div className="font-display text-[32px] leading-none font-semibold text-danger">
                  {results.opposePct}
                  <span className="text-[18px] text-danger/60">%</span>
                </div>
              </div>
            </div>

            {/* Combined bar */}
            <div className="h-2.5 rounded-full bg-paper/[0.04] overflow-hidden flex mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${results.supportPct}%` }}
                transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-success"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${results.opposePct}%` }}
                transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-danger"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[12px] text-paper/60">
              <TrendingUp size={12} className="text-gold" />
              <span className="font-mono">{results.totalVoices.toLocaleString()}</span>
              <span>verified voices</span>
            </div>
          </Card>
        </motion.div>

        {/* Postal codes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-4">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-[14px] font-semibold text-paper">
                By postal code
              </h3>
              <span className="font-mono text-[10px] tracking-wider text-paper/40 uppercase">
                Support
              </span>
            </div>
            <div className="space-y-2.5">
              {results.byPostalCode.map((row, i) => (
                <Bar
                  key={row.code}
                  label={row.code}
                  support={row.support}
                  total={row.total}
                  delay={0.1 * i}
                />
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Demographics */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mb-6">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-[14px] font-semibold text-paper">
                By age
              </h3>
              <span className="font-mono text-[10px] tracking-wider text-paper/40 uppercase">
                Support
              </span>
            </div>
            <div className="space-y-2.5">
              {results.byAge.map((row, i) => (
                <Bar
                  key={row.range}
                  label={row.range}
                  support={row.support}
                  total={row.total}
                  delay={0.1 * i}
                />
              ))}
            </div>
          </Card>
        </motion.div>

        <p className="text-center text-[11px] font-mono text-paper/30 tracking-wider uppercase mb-8">
          Updated every 60s · Verifiable on Base
        </p>

        {/* Investor CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card accent>
            <div className="text-center mb-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-gold uppercase mb-2">
                For investors
              </div>
              <h3 className="font-display text-[18px] font-semibold text-paper mb-1">
                Interested in what you saw?
              </h3>
              <p className="text-[13px] text-paper/60 leading-relaxed">
                Represent is building the infrastructure for verified public consensus.
              </p>
            </div>
            <a
              href={mailtoHref}
              className="flex items-center justify-center gap-2 w-full bg-gold text-ink font-display font-medium text-[15px] tracking-tight rounded-full px-6 py-3.5 hover:bg-gold/90 active:bg-gold/80 transition-all"
            >
              <Mail size={16} strokeWidth={2.5} />
              Request a meeting
            </a>
          </Card>
        </motion.div>

        <Link
          href="/"
          className="text-center text-[12px] text-paper/40 hover:text-paper/70 mt-6 transition-colors"
        >
          Start over
        </Link>
      </div>
    </Shell>
  );
}
