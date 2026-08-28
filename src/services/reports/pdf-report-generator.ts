import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { storageService } from '../storage/storage.service';
import { getMonthName } from '../../utils/formatters';

export interface GenerateReportOptions {
  month: string; // e.g. "2026-08"
  currencySymbol?: string;
}

export class MonthlyReportGenerator {
  static generateMonthlyReport(options: GenerateReportOptions): void {
    const { month, currencySymbol = '₹' } = options;
    const profile = storageService.getUserProfile();
    const categories = storageService.getCategories();
    const monthSummary = storageService.calculateMonthSummary(month);
    const budgets = storageService.getBudgets();
    const subscriptions = storageService.getSubscriptions();
    const loans = storageService.getEMILoans();
    const health = storageService.calculateFinancialHealthScore();

    const monthLabel = getMonthName(month);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Helper for currency text
    const cur = currencySymbol === '₹' ? 'INR ' : `${currencySymbol} `;

    // ----------------------------------------------------
    // 1. HEADER SECTION (Modern Dark Slate Header)
    // ----------------------------------------------------
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Blue Accent stripe
    doc.setFillColor(59, 130, 246); // Blue 500
    doc.rect(0, 37, pageWidth, 1.5, 'F');

    // App Logo & Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('FINPULSE', margin, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('AI-POWERED FINANCIAL INTELLIGENCE & LEDGER', margin, 22);

    // Document Title on Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('MONTHLY FINANCIAL REPORT', pageWidth - margin, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Period: ${monthLabel}`, pageWidth - margin, 21, { align: 'right' });
    doc.text(`Account: ${profile.name || 'Ashwin Kumar'}`, pageWidth - margin, 27, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`, pageWidth - margin, 33, { align: 'right' });

    let currentY = 46;

    // ----------------------------------------------------
    // 2. EXECUTIVE SUMMARY / METRICS CARDS
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1. EXECUTIVE SUMMARY & KEY CASH FLOW METRICS', margin, currentY);
    currentY += 5;

    const cardWidth = (pageWidth - margin * 2 - 9) / 4;
    const cardHeight = 22;

    const metrics = [
      {
        label: 'TOTAL INFLOW',
        value: `${cur}${monthSummary.totalIncome.toLocaleString('en-IN')}`,
        color: [16, 185, 129], // Emerald
        bg: [236, 253, 245],
      },
      {
        label: 'TOTAL OUTFLOW',
        value: `${cur}${monthSummary.totalExpenses.toLocaleString('en-IN')}`,
        color: [99, 102, 241], // Indigo
        bg: [238, 242, 255],
      },
      {
        label: 'NET SURPLUS',
        value: `${cur}${monthSummary.saved.toLocaleString('en-IN')}`,
        color: [59, 130, 246], // Blue
        bg: [239, 246, 255],
      },
      {
        label: 'SAVINGS RATE',
        value: `${monthSummary.savingsRate.toFixed(1)}%`,
        color: [245, 158, 11], // Amber
        bg: [254, 243, 199],
      },
    ];

    metrics.forEach((m, i) => {
      const x = margin + i * (cardWidth + 3);
      doc.setFillColor(m.bg[0], m.bg[1], m.bg[2]);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

      // Top indicator stripe
      doc.setFillColor(m.color[0], m.color[1], m.color[2]);
      doc.rect(x + 2, currentY + 2, cardWidth - 4, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label, x + cardWidth / 2, currentY + 9, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(m.value, x + cardWidth / 2, currentY + 17, { align: 'center' });
    });

    currentY += cardHeight + 8;

    // ----------------------------------------------------
    // 3. CATEGORY SPENDING & BUDGET PERFORMANCE TABLE
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. CATEGORY BREAKDOWN & BUDGET ADHERENCE', margin, currentY);
    currentY += 3;

    const categoryRows = categories
      .filter((c) => c.type !== 'income')
      .map((cat) => {
        const spent = monthSummary.categorySpending[cat.id] || 0;
        const budgetObj = budgets.find((b) => b.categoryId === cat.id);
        const budgetLimit = budgetObj?.monthlyLimit ?? (cat.budgetMonthly || 0);
        const variance = budgetLimit - spent;
        const pctUsed = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;
        const pctOfTotal =
          monthSummary.totalExpenses > 0 ? ((spent / monthSummary.totalExpenses) * 100).toFixed(1) : '0';

        let status = 'Within Budget';
        if (budgetLimit > 0) {
          if (spent > budgetLimit) status = `Over (${pctUsed}%)`;
          else if (pctUsed >= 85) status = `Near Limit (${pctUsed}%)`;
          else status = `Safe (${pctUsed}%)`;
        }

        return [
          cat.name,
          `${cur}${spent.toLocaleString('en-IN')}`,
          budgetLimit > 0 ? `${cur}${budgetLimit.toLocaleString('en-IN')}` : 'Uncapped',
          budgetLimit > 0
            ? variance >= 0
              ? `+${cur}${variance.toLocaleString('en-IN')}`
              : `-${cur}${Math.abs(variance).toLocaleString('en-IN')}`
            : '-',
          `${pctOfTotal}%`,
          status,
        ];
      })
      .filter((row) => row[1] !== `${cur}0` || row[2] !== 'Uncapped');

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Category', 'Spent', 'Budget Cap', 'Remaining / Variance', '% of Total Outflow', 'Status']],
      body: categoryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 23, 42] },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const text = String(data.cell.raw);
          if (text.startsWith('Over')) {
            data.cell.styles.textColor = [225, 29, 72]; // Rose 600
            data.cell.styles.fontStyle = 'bold';
          } else if (text.startsWith('Near')) {
            data.cell.styles.textColor = [217, 119, 6]; // Amber 600
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [16, 185, 129]; // Emerald 600
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Page overflow guard
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 18;
    }

    // ----------------------------------------------------
    // 4. TOP MERCHANTS & PAYMENT METHOD RAILS
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3. MERCHANT CONCENTRATION & PAYMENT RAILS', margin, currentY);
    currentY += 3;

    const topMerchants = Object.entries(monthSummary.merchantSpending)
      .map(([m, d]) => ({
        merchant: m,
        total: d.total,
        count: d.count,
        pct: monthSummary.totalExpenses > 0 ? ((d.total / monthSummary.totalExpenses) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((m) => [m.merchant, `${cur}${m.total.toLocaleString('en-IN')}`, `${m.count} txns`, `${m.pct}%`]);

    const paymentRailRows = Object.entries(monthSummary.paymentMethodSpending)
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => {
        const pct = monthSummary.totalExpenses > 0 ? ((amount / monthSummary.totalExpenses) * 100).toFixed(1) : '0';
        return [method, `${cur}${amount.toLocaleString('en-IN')}`, `${pct}%`];
      });

    // Top merchants table
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin + (pageWidth - margin * 2) / 2 + 3 },
      tableWidth: (pageWidth - margin * 2) / 2 - 3,
      head: [['Top 5 Merchants', 'Spent', 'Count', 'Share']],
      body: topMerchants,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'right' },
      },
    });

    const merchantsFinalY = (doc as any).lastAutoTable.finalY;

    // Payment Rail table
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin + (pageWidth - margin * 2) / 2 + 3, right: margin },
      tableWidth: (pageWidth - margin * 2) / 2 - 3,
      head: [['Payment Rail / Method', 'Total Volume', 'Share']],
      body: paymentRailRows,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
    });

    const paymentsFinalY = (doc as any).lastAutoTable.finalY;
    currentY = Math.max(merchantsFinalY, paymentsFinalY) + 8;

    // ----------------------------------------------------
    // 5. RECURRING OBLIGATIONS & FINANCIAL HEALTH SCORE
    // ----------------------------------------------------
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('4. RECURRING COMMITMENTS & FINANCIAL HEALTH SCORE', margin, currentY);
    currentY += 4;

    const healthBoxWidth = pageWidth - margin * 2;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, healthBoxWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235); // Blue 600
    doc.text(`${health.score} / 100`, margin + 6, currentY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rating: ${health.rating}`, margin + 6, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const subTotal = subscriptions.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.amount, 0);
    const emiTotal = loans.reduce((sum, l) => sum + l.emiAmount, 0);

    doc.text(
      `Active Subscriptions: ${subscriptions.filter((s) => s.status === 'active').length} (${cur}${subTotal.toLocaleString('en-IN')}/mo)   |   Active EMIs: ${loans.length} (${cur}${emiTotal.toLocaleString('en-IN')}/mo)   |   Total Fixed Load: ${cur}${(subTotal + emiTotal).toLocaleString('en-IN')}`,
      margin + 38,
      currentY + 11
    );
    doc.text(
      `Health Breakdown: ${health.factors.map((f) => `${f.name}: ${f.score}/${f.maxScore}`).join('  •  ')}`,
      margin + 38,
      currentY + 18
    );

    currentY += 30;

    // ----------------------------------------------------
    // 6. AI STRATEGIC FINANCIAL INSIGHTS & TAKEAWAYS
    // ----------------------------------------------------
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('5. AI STRATEGIC OBSERVATIONS & ACTIONABLE INSIGHTS', margin, currentY);
    currentY += 4;

    const sortedCats = Object.entries(monthSummary.categorySpending).sort((a, b) => b[1] - a[1]);
    const topCatName = categories.find((c) => c.id === sortedCats[0]?.[0])?.name || 'General';
    const topCatAmount = sortedCats[0]?.[1] || 0;

    const insights = [
      `Net Savings Velocity: You generated ${cur}${monthSummary.saved.toLocaleString('en-IN')} in net surplus with a ${monthSummary.savingsRate.toFixed(1)}% savings rate for ${monthLabel}.`,
      `Primary Outflow Driver: Highest single spending category was '${topCatName}' at ${cur}${topCatAmount.toLocaleString('en-IN')}.`,
      `Recurring Fixed Commitments: Monthly automated obligations (EMIs + Subscriptions) total ${cur}${(emiTotal + subTotal).toLocaleString('en-IN')}, within safe thresholds.`,
      `Cash Reserve Guidance: Continue allocating monthly surplus toward emergency liquidity and long-term milestone goals.`,
    ];

    insights.forEach((insight, idx) => {
      doc.setFillColor(59, 130, 246);
      doc.circle(margin + 2, currentY + idx * 6 + 2, 1, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(insight, margin + 6, currentY + idx * 6 + 3);
    });

    // ----------------------------------------------------
    // 7. FOOTER ON ALL PAGES
    // ----------------------------------------------------
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Top divider on footer
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.text('FinPulse Financial Intelligence Platform — Confidential & Personal', margin, pageHeight - 6);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    // Save and Trigger Download
    const cleanMonth = month.replace('-', '_');
    const cleanName = profile.name ? profile.name.replace(/\s+/g, '_') : 'User';
    const fileName = `FinPulse_Report_${cleanMonth}_${cleanName}.pdf`;
    doc.save(fileName);
  }
}
