import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import Trust from "@/components/Trust";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import Outcomes from "@/components/Outcomes";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <main className="min-h-screen bg-ink">
      <Header />
      <Hero />
      <Problem />
      <HowItWorks />
      <Trust />
      <Features />
      <UseCases />
      <Outcomes />
      <CTA />
      <Footer />
    </main>
  );
}
