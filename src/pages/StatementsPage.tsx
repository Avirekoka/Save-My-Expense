import React from 'react';
import { StatementsView } from '../components/views/StatementsView';

interface StatementsPageProps {
  currencySymbol: string;
  onNavigate: (view: string) => void;
}

const StatementsPage: React.FC<StatementsPageProps> = (props) => {
  return <StatementsView {...props} />;
};

export default StatementsPage;
