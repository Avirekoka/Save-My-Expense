import React from 'react';
import { DebtView } from '../components/views/DebtView';
import {
  useUpcomingLoanDeadlines,
  UpcomingLoanDeadlineInfo,
  UseUpcomingLoanDeadlinesResult,
} from '../hooks/useUpcomingLoanDeadlines';

// Re-export the hook and types directly from DebtPage as requested
export { useUpcomingLoanDeadlines };
export type { UpcomingLoanDeadlineInfo, UseUpcomingLoanDeadlinesResult };

interface DebtPageProps {
  currencySymbol: string;
}

const DebtPage: React.FC<DebtPageProps> = (props) => {
  // Hook monitoring upcoming loan deadlines within DebtPage
  const deadlineInfo = useUpcomingLoanDeadlines();

  return <DebtView {...props} upcomingDeadlineInfo={deadlineInfo} />;
};

export default DebtPage;
