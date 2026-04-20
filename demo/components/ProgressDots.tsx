export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 <= current;
        return (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              active ? 'w-5 bg-gold' : 'w-1.5 bg-paper/20'
            }`}
          />
        );
      })}
    </div>
  );
}
