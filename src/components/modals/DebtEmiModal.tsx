import React, { useState, useEffect } from 'react';
import {
  X,
  Landmark,
  CreditCard,
  Percent,
  Calendar,
  DollarSign,
  Layers,
  Calculator,
  CheckCircle2,
  Car,
  Home,
  GraduationCap,
  Briefcase,
  Smartphone,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { EMILoan, LoanType } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface DebtEmiModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanToEdit?: EMILoan | null;
  currencySymbol: string;
  onSuccess?: () => void;
  onDelete?: (loan: EMILoan) => void;
}

const LOAN_TYPES: { type: LoanType; icon: React.FC<any>; color: string }[] = [
  { type: 'Auto Loan', icon: Car, color: '#3B82F6' },
  { type: 'Personal Loan', icon: Landmark, color: '#F59E0B' },
  { type: 'Home Loan', icon: Home, color: '#10B981' },
  { type: 'Credit Card EMI', icon: CreditCard, color: '#8B5CF6' },
  { type: 'Education Loan', icon: GraduationCap, color: '#06B6D4' },
  { type: 'Consumer Durable', icon: Smartphone, color: '#EC4899' },
  { type: 'Business Loan', icon: Briefcase, color: '#6366F1' },
  { type: 'Other', icon: HelpCircle, color: '#6B7280' },
];

const LENDER_PRESETS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bajaj Finserv',
  'Tata Capital',
  'IDFC First Bank',
  'Citibank / Chase',
  'Personal / Private Lender',
];

export const DebtEmiModal: React.FC<DebtEmiModalProps> = ({
  isOpen,
  onClose,
  loanToEdit,
  currencySymbol,
  onSuccess,
  onDelete,
}) => {
  useScrollLock(isOpen);

  const [name, setName] = useState('');
  const [lender, setLender] = useState('HDFC Bank');
  const [customLender, setCustomLender] = useState('');
  const [loanType, setLoanType] = useState<LoanType>('Personal Loan');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [remainingAmount, setRemainingAmount] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('10.5');
  const [tenureMonths, setTenureMonths] = useState<string>('36');
  const [paidMonths, setPaidMonths] = useState<string>('0');
  const [emiAmount, setEmiAmount] = useState<string>('');
  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loanToEdit) {
      setName(loanToEdit.name || '');
      const isPreset = LENDER_PRESETS.includes(loanToEdit.lender);
      if (isPreset) {
        setLender(loanToEdit.lender);
        setCustomLender('');
      } else {
        setLender('Other');
        setCustomLender(loanToEdit.lender || '');
      }
      setLoanType((loanToEdit.type as LoanType) || 'Personal Loan');
      setTotalAmount(loanToEdit.totalAmount ? String(loanToEdit.totalAmount) : '');
      setRemainingAmount(loanToEdit.remainingAmount !== undefined ? String(loanToEdit.remainingAmount) : '');
      setInterestRate(loanToEdit.interestRate !== undefined ? String(loanToEdit.interestRate) : '10.5');
      setTenureMonths(loanToEdit.tenureMonths ? String(loanToEdit.tenureMonths) : '36');
      setPaidMonths(loanToEdit.paidMonths !== undefined ? String(loanToEdit.paidMonths) : '0');
      setEmiAmount(loanToEdit.emiAmount ? String(loanToEdit.emiAmount) : '');
      setNextDueDate(loanToEdit.nextDueDate || '');
      setStartDate(loanToEdit.startDate || '');
      setNotes(loanToEdit.notes || '');
      setSelectedColor(loanToEdit.color || '#3B82F6');
    } else {
      setName('');
      setLender('HDFC Bank');
      setCustomLender('');
      setLoanType('Personal Loan');
      setTotalAmount('');
      setRemainingAmount('');
      setInterestRate('10.5');
      setTenureMonths('36');
      setPaidMonths('0');
      setEmiAmount('');
      // Default next due date: 5th of next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(5);
      setNextDueDate(nextMonth.toISOString().slice(0, 10));
      // Default start date: today
      setStartDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setSelectedColor('#3B82F6');
    }
    setError(null);
  }, [loanToEdit, isOpen]);

  // Standard Bank EMI formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
  const handleAutoCalculateEmi = () => {
    const principal = parseFloat(totalAmount) || parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const tenure = parseInt(tenureMonths, 10) || 12;

    if (principal <= 0 || tenure <= 0) {
      setError('Please enter principal amount and tenure first.');
      return;
    }

    if (rate === 0) {
      // 0% No-cost EMI
      const monthly = Math.round(principal / tenure);
      setEmiAmount(String(monthly));
      return;
    }

    const monthlyRate = rate / (12 * 100);
    const emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1);

    setEmiAmount(String(Math.round(emi)));
    setError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a loan or EMI name.');
      return;
    }

    const finalLender = lender === 'Other' ? customLender.trim() || 'Other' : lender;
    const parsedTotal = parseFloat(totalAmount);
    const parsedRemaining = parseFloat(remainingAmount);
    const parsedRate = parseFloat(interestRate);
    const parsedTenure = parseInt(tenureMonths, 10);
    const parsedPaidMonths = parseInt(paidMonths, 10) || 0;
    const parsedEmi = parseFloat(emiAmount);

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('Please enter a valid total loan principal amount.');
      return;
    }

    if (isNaN(parsedRemaining) || parsedRemaining < 0) {
      setError('Please enter a valid remaining balance amount.');
      return;
    }

    if (isNaN(parsedEmi) || parsedEmi <= 0) {
      setError('Please enter a valid monthly EMI amount.');
      return;
    }

    const loanData: EMILoan = {
      id: loanToEdit ? loanToEdit.id : `emi_${Date.now()}`,
      name: name.trim(),
      lender: finalLender,
      type: loanType,
      totalAmount: parsedTotal,
      remainingAmount: parsedRemaining,
      emiAmount: parsedEmi,
      interestRate: isNaN(parsedRate) ? 0 : parsedRate,
      tenureMonths: isNaN(parsedTenure) || parsedTenure <= 0 ? 12 : parsedTenure,
      paidMonths: parsedPaidMonths,
      nextDueDate: nextDueDate || new Date().toISOString().slice(0, 10),
      startDate: startDate || new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
      color: selectedColor,
    };

    storageService.saveEMILoan(loanData);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl border border-[#262626] bg-[#121212] p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: selectedColor }}
            >
              <Landmark size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {loanToEdit ? 'Edit Loan / EMI Obligation' : 'Add Debt / EMI Obligation'}
              </h2>
              <p className="text-xs text-gray-400">
                {loanToEdit
                  ? 'Update loan principal, remaining balance, interest APR, or tenure.'
                  : 'Track outstanding balance, monthly EMI outflow, and interest drag.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Loan Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Loan / EMI Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HDFC Car Loan (Creta), SBI Home Loan, Apple MacBook EMI"
              className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Loan Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Category / Debt Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LOAN_TYPES.map((lt) => {
                const isSelected = loanType === lt.type;
                const Icon = lt.icon;
                return (
                  <button
                    key={lt.type}
                    type="button"
                    onClick={() => {
                      setLoanType(lt.type);
                      setSelectedColor(lt.color);
                    }}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600/15 text-white'
                        : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Icon size={14} style={{ color: lt.color }} />
                    <span className="truncate">{lt.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lender / Bank Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Lender / Bank <span className="text-rose-400">*</span>
              </label>
              <select
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-hidden"
              >
                {LENDER_PRESETS.map((lp) => (
                  <option key={lp} value={lp}>
                    {lp}
                  </option>
                ))}
                <option value="Other">Other / Custom Lender</option>
              </select>
            </div>

            {lender === 'Other' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Specify Lender Name
                </label>
                <input
                  type="text"
                  value={customLender}
                  onChange={(e) => setCustomLender(e.target.value)}
                  placeholder="e.g. Standard Chartered, Relative"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Annual Interest Rate (% APR)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="e.g., 8.75 or 0 for No-Cost"
                    className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden pr-8"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400">
                    %
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Principal & Outstanding Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Total Sanctioned Loan ({currencySymbol}) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={totalAmount}
                  onChange={(e) => {
                    setTotalAmount(e.target.value);
                    if (!remainingAmount || parseFloat(remainingAmount) > parseFloat(e.target.value)) {
                      setRemainingAmount(e.target.value);
                    }
                  }}
                  placeholder="e.g., 500000"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Current Pending Balance ({currencySymbol}) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={remainingAmount}
                  onChange={(e) => setRemainingAmount(e.target.value)}
                  placeholder="e.g., 380000"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Tenure & EMI Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Total Tenure (Months) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="360"
                required
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                placeholder="e.g., 60"
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                EMIs Paid So Far
              </label>
              <input
                type="number"
                min="0"
                max={tenureMonths || 360}
                value={paidMonths}
                onChange={(e) => setPaidMonths(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300">
                  Monthly EMI ({currencySymbol}) <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoCalculateEmi}
                  className="text-[10px] text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Calculator size={10} /> Auto-calc
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(e.target.value)}
                  placeholder="e.g., 12500"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Next Due Date
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Loan Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Notes / Account Reference (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Loan Account #LAN982312, Auto-debit from salary on 4th..."
              className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] p-3 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-[#262626]">
            {loanToEdit && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(loanToEdit);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Loan</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#333] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#1e1e1e] hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md shadow-blue-900/30 cursor-pointer"
              >
                {loanToEdit ? 'Save Changes' : 'Add Loan Obligation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
