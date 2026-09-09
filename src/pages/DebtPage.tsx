import React from 'react';
import { DebtView } from '../components/views/DebtView';

interface DebtPageProps {
  currencySymbol: string;
}

const DebtPage: React.FC<DebtPageProps> = (props) => {
  return <DebtView {...props} />;
};

export default DebtPage;
