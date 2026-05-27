import { useRef } from "react";
import { useScroll } from "framer-motion";
import Background from "./components/Background";
import Navbar from "./components/Navbar";
import CivicCards from "./components/CivicCards";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import CivicImpact from "./components/CivicImpact";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <>
      <Background />
      <Navbar />
      <CivicCards progress={scrollYProgress} />

      {/* one vertical scroll surface: three full-height sections in one ref */}
      <div ref={containerRef} className="relative">
        <Hero />
        <HowItWorks />
        <CivicImpact />
      </div>
    </>
  );
}
