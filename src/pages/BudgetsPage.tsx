import React from 'react';
import { BudgetsView } from '../components/views/BudgetsView';

interface BudgetsPageProps {
  currentMonth: string;
  currencySymbol: string;
}

const BudgetsPage: React.FC<BudgetsPageProps> = (props) => {
  return <BudgetsView {...props} />;
};

export default BudgetsPage;
