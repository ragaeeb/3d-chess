import HeroSection from '@/components/home/hero-section';
import HowDoesWork from '@/components/home/how-does-work';

export default function HomePage() {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
            <HeroSection />
            <HowDoesWork />
        </div>
    );
}
