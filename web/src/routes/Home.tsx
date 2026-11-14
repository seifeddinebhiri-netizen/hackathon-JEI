import { EthicsBand } from '@/features/home/components/EthicsBand';
import { FinalCta } from '@/features/home/components/FinalCta';
import { Hero } from '@/features/home/components/Hero';
import { PhotoBand } from '@/features/home/components/PhotoBand';
import { StepsBand } from '@/features/home/components/StepsBand';
import { StepsSection } from '@/features/home/components/StepsSection';

export default function Home() {
  return (
    <>
      <Hero />
      <StepsBand />
      <StepsSection />
      <PhotoBand />
      <EthicsBand />
      <FinalCta />
    </>
  );
}
