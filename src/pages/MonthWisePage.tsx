import React from 'react';
import { MonthWiseExpenseView } from '../components/views/MonthWiseExpenseView';

interface MonthWisePageProps {
  currencySymbol: string;
  onNavigate: (view: string) => void;
  onSelectMonth: (month: string) => void;
  onOpenAddModal: () => void;
}

const MonthWisePage: React.FC<MonthWisePageProps> = (props) => {
  return <MonthWiseExpenseView {...props} />;
};

export default MonthWisePage;
