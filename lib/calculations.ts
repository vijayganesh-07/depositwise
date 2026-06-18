export function calculateFDMaturity(
  principal: number,
  ratePercent: number,
  tenureYears: number,
  tenureMonths: number,
  tenureDays: number,
  compoundingFrequency: string,
  startDateStr?: string
): { maturityAmount: number; interestEarned: number; effectiveYield: number; maturityDate: Date } {
  const totalYears = tenureYears + (tenureMonths / 12) + (tenureDays / 365);
  const totalMonths = totalYears * 12;
  const r = ratePercent / 100;

  const nMap: Record<string, number> = {
    Monthly: 12,
    Quarterly: 4,
    'Half-Yearly': 2,
    Annually: 1,
  };
  const n = nMap[compoundingFrequency] || 4;

  const maturityAmount = principal * Math.pow(1 + r / n, n * totalYears);
  const interestEarned = maturityAmount - principal;
  const effectiveYield = (Math.pow(1 + r / n, n) - 1) * 100;

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const maturityDate = new Date(startDate);
  
  if (isNaN(startDate.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + Math.round(totalMonths));
    return {
      maturityAmount: Math.round(maturityAmount),
      interestEarned: Math.round(interestEarned),
      effectiveYield: Math.round(effectiveYield * 100) / 100,
      maturityDate: fallback,
    };
  }

  maturityDate.setFullYear(startDate.getFullYear() + tenureYears);
  maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);
  maturityDate.setDate(maturityDate.getDate() + tenureDays);

  return {
    maturityAmount: Math.round(maturityAmount),
    interestEarned: Math.round(interestEarned),
    effectiveYield: Math.round(effectiveYield * 100) / 100,
    maturityDate,
  };
}

export function calculateRDMaturity(
  monthlyDeposit: number,
  ratePercent: number,
  tenureMonths: number,
  compoundingFrequency: string,
  startDateStr?: string
): { maturityAmount: number; interestEarned: number; effectiveYield: number; maturityDate: Date } {
  const r = ratePercent / 100;
  const nMap: Record<string, number> = {
    Monthly: 12,
    Quarterly: 4,
    'Half-Yearly': 2,
    Annually: 1,
  };
  const n = nMap[compoundingFrequency] || 4;
  const i = r / n;

  // Denominator: 1 - (1 + i)^(-n / 12)
  const den = 1 - Math.pow(1 + i, -n / 12);
  
  // Numerator: (1 + i)^(n * T / 12) - 1
  const num = Math.pow(1 + i, (n * tenureMonths) / 12) - 1;

  const maturityAmount = monthlyDeposit * (num / den);
  const totalPrincipal = monthlyDeposit * tenureMonths;
  const interestEarned = maturityAmount - totalPrincipal;
  const effectiveYield = (Math.pow(1 + r / n, n) - 1) * 100;

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const maturityDate = new Date(startDate);
  
  if (isNaN(startDate.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + tenureMonths);
    return {
      maturityAmount: Math.round(maturityAmount),
      interestEarned: Math.round(interestEarned),
      effectiveYield: Math.round(effectiveYield * 100) / 100,
      maturityDate: fallback,
    };
  }

  maturityDate.setMonth(startDate.getMonth() + tenureMonths);

  return {
    maturityAmount: Math.round(maturityAmount),
    interestEarned: Math.round(interestEarned),
    effectiveYield: Math.round(effectiveYield * 100) / 100,
    maturityDate,
  };
}

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatCurrencyFull(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getDaysUntilMaturity(maturityDate: string | null): number | null {
  if (!maturityDate) return null;
  const now = new Date();
  const maturity = new Date(maturityDate);
  const diff = maturity.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatMaturityDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function getMaturityLabel(maturityDate: string | null, status: string): string {
  if (status === 'matured') return 'Matured';
  if (status === 'closed') return 'Closed';
  const days = getDaysUntilMaturity(maturityDate);
  if (days === null) return '-';
  if (days <= 0) return 'Matured';
  if (days < 30) return `${days}d left`;
  if (days < 90) return `${Math.floor(days / 30)}mo left`;
  if (days < 365) return `${Math.floor(days / 30)}mo left`;
  return `${Math.floor(days / 365)}yr left`;
}
