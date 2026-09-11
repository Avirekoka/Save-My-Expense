import React from 'react';
import { AnalyticsView } from '../components/views/AnalyticsView';
import { Transaction } from '../types';

interface AnalyticsPageProps {
  currentMonth: string;
  currencySymbol: string;
  onNavigate?: (viewId: string) => void;
  onOpenAddModal?: (tx?: Transaction) => void;
  onNavigateToTransactions?: (startDate: string, endDate: string) => void;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = (props) => {
  return <AnalyticsView {...props} />;
};

export default AnalyticsPage;

