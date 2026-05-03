import { Container } from './Container';

const ROW = [
  'City of Calgary',
  'Office of the Clerk',
  'Deloitte LLP · audit',
  'Canadian passport · NFC verify',
  'Service Alberta · ID API',
  'Indigenous Status Card',
  'Base · on-chain receipts',
  'SOC 2 Type II',
];

export function Trust() {
  return (
    <section className="relative border-y border-bone/[0.06] bg-ink-900/60">
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:gap-10 md:py-7">
        <span className="eyebrow shrink-0 md:w-44">TRUSTED ENDS</span>
        <div className="flex flex-wrap gap-x-7 gap-y-3 text-[12.5px] text-bone-muted">
          {ROW.map((r) => (
            <span key={r} className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-gold" />
              {r}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
