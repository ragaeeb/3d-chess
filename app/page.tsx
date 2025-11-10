import HeroSection from "@/components/home/hero-section";
import HowDoesWork from "@/components/home/how-does-work";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full">
      <HeroSection />
      <HowDoesWork />
    </div>
  );
}
