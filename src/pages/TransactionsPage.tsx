import React from 'react';
import { TransactionsView } from '../components/views/TransactionsView';
import { Transaction } from '../types';

interface TransactionsPageProps {
  currentMonth: string;
  currencySymbol: string;
  onOpenAddModal: (tx?: Transaction) => void;
  onOpenScanReceipt: () => void;
  onSelectMonth?: (month: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
  onClearDateRange?: () => void;
}

const TransactionsPage: React.FC<TransactionsPageProps> = (props) => {
  return <TransactionsView {...props} />;
};

export default TransactionsPage;

