import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  subtotal: number;
  vat: number;
  vatRate: number;
  fee: number;
  feeRate: number;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(220, 38, 38); // Zoya Red
  doc.text('ZoyaEdge', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Facture d\'abonnement', 20, 40);
  doc.text(`N°: ${data.invoiceNumber}`, 140, 40);
  doc.text(`Date: ${data.date}`, 140, 45);

  // Divider
  doc.setDrawColor(240);
  doc.line(20, 55, 190, 55);

  // Client info
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Client:', 20, 70);
  doc.setFontSize(10);
  doc.text(data.clientName, 20, 78);
  doc.text(data.clientEmail, 20, 83);

  // Company info
  doc.setFontSize(12);
  doc.text('Émetteur:', 140, 70);
  doc.setFontSize(10);
  doc.text('ZoyaEdge Inc.', 140, 78);
  doc.text('support@zoyaedge.com', 140, 83);

  // Build table body dynamically based on VAT and Fees
  const tableBody = [
    [`Abonnement ZoyaEdge - Plan ${data.planName.toUpperCase()}`, '1', `${data.subtotal.toLocaleString()} ${data.currency}`, `${data.subtotal.toLocaleString()} ${data.currency}`]
  ];

  if (data.vatRate > 0) {
    tableBody.push([`TVA (${data.vatRate}%)`, '1', `${data.vat.toLocaleString()} ${data.currency}`, `${data.vat.toLocaleString()} ${data.currency}`]);
  }

  if (data.feeRate > 0) {
    tableBody.push([`Frais ZoyaPay (${data.feeRate}%)`, '1', `${data.fee.toLocaleString()} ${data.currency}`, `${data.fee.toLocaleString()} ${data.currency}`]);
  }

  // Table
  (doc as any).autoTable({
    startY: 100,
    head: [['Description', 'Quantité', 'Prix HT', 'Total']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38] },
    margin: { top: 100 }
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Final A Payé:', 100, finalY + 10);
  doc.text(`${data.amount.toLocaleString()} ${data.currency}`, 170, finalY + 10, { align: 'right' });

  // Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Note : Des frais d\'opérateur mobile peuvent s\'appliquer au moment du paiement.', 20, 275);
  doc.text('Merci pour votre confiance en ZoyaEdge.', 20, 280);
  doc.text('Ceci est une facture générée automatiquement.', 20, 285);

  // Save the PDF
  doc.save(`Facture-ZoyaEdge-${data.invoiceNumber}.pdf`);
};
