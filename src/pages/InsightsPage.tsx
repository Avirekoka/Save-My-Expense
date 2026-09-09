import React from 'react';
import { InsightsView } from '../components/views/InsightsView';

interface InsightsPageProps {
  currentMonth: string;
  currencySymbol: string;
}

const InsightsPage: React.FC<InsightsPageProps> = (props) => {
  return <InsightsView {...props} />;
};

export default InsightsPage;
