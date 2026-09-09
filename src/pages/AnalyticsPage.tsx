import React from 'react';
import { AnalyticsView } from '../components/views/AnalyticsView';

interface AnalyticsPageProps {
  currentMonth: string;
  currencySymbol: string;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = (props) => {
  return <AnalyticsView {...props} />;
};

export default AnalyticsPage;
