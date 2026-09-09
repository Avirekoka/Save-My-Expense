import React from 'react';
import { LandingPageView } from '../components/views/LandingPageView';

interface LandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onInstantDemo: () => Promise<void> | void;
}

const LandingPage: React.FC<LandingPageProps> = (props) => {
  return <LandingPageView {...props} />;
};

export default LandingPage;
