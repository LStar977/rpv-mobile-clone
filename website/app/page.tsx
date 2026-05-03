import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { Trust } from '@/components/Trust';
import { HowItWorks } from '@/components/HowItWorks';
import { ForCitizens } from '@/components/ForCitizens';
import { ForCities } from '@/components/ForCities';
import { Calgary } from '@/components/Calgary';
import { FAQ } from '@/components/FAQ';
import { FinalCTA } from '@/components/FinalCTA';
import { Footer } from '@/components/Footer';

export default function Page() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Trust />
      <HowItWorks />
      <ForCitizens />
      <ForCities />
      <Calgary />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
