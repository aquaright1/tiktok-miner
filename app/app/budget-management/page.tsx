import { Metadata } from 'next';
import BudgetDashboard from '@/components/budget-management/budget-dashboard';

export const metadata: Metadata = {
      title: 'Budget Management - TikTok Miner',
  description: 'Manage budgets, track costs, and optimize spending across all platforms and services',
};

export default function BudgetManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BudgetDashboard />
    </div>
  );
}