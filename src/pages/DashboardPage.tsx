import React from 'react';
import { DashboardView } from '../components/views/DashboardView';

interface DashboardPageProps {
  currentMonth: string;
  currencySymbol: string;
  onNavigate: (view: string) => void;
  onOpenAddModal: () => void;
  onOpenBeforeSpend: () => void;
  onOpenAskMoney: () => void;
  onOpenScanReceipt: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = (props) => {
  return <DashboardView {...props} />;
};

export default DashboardPage;
