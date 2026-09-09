import React from 'react';
import { GoalsView } from '../components/views/GoalsView';

interface GoalsPageProps {
  currencySymbol: string;
}

const GoalsPage: React.FC<GoalsPageProps> = (props) => {
  return <GoalsView {...props} />;
};

export default GoalsPage;
