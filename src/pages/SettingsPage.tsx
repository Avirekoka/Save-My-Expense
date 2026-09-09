import React from 'react';
import { SettingsView } from '../components/views/SettingsView';

interface SettingsPageProps {
  currencySymbol: string;
  onUpdateCurrency: (symbol: string) => void;
  onOpenAuthModal: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = (props) => {
  return <SettingsView {...props} />;
};

export default SettingsPage;
