import { CallToAction } from "./components/landing/CallToAction";
import { Hero } from "./components/landing/Hero";
import { Manifesto } from "./components/landing/Manifesto";
import { MarqueeTicker } from "./components/landing/MarqueeTicker";
import { Personas } from "./components/landing/Personas";
import { Footer } from "./components/ui/Footer";
import { Header } from "./components/ui/Header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Header />
      <MarqueeTicker />
      <main>
        <Hero />
        <Manifesto />
        <Personas />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
