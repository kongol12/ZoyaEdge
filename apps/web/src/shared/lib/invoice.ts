import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  try {
    const doc = new jsPDF();
    
    // -- COLORS & CONSTANTS --
    const primaryRed = [220, 38, 38]; // Zoya Red
    const darkGray = [55, 65, 81];
    const lightGray = [243, 244, 246];
    const borderGray = [229, 231, 235];

    // -- HEADER BACKGROUND (SIDE BAR) --
    doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.rect(0, 0, 10, 297, 'F');

    // -- LOGO & BRANDING --
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text('ZOYAEDGE', 25, 30);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('SMART TRADING & FINANCIAL ANALYTICS', 25, 36);

    // -- INVOICE BADGE --
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(130, 20, 65, 20, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('FACTURE', 137, 30);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${data.invoiceNumber}`, 137, 36);

    // -- COMPANY & CLIENT INFO GRID --
    // Divider
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(25, 55, 195, 55);

    // Issuer (Fixed)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text('ÉMETTEUR', 25, 65);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text('ZoyaEdge Technologies RDC', 25, 72);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.text('Kinshasa, République Démocratique du Congo', 25, 77);
    doc.text('RCCM: CD/KIN/RCCM/23-B-01234', 25, 82);
    doc.text('ID. Nat: 01-123-N12345T', 25, 87);
    doc.text('Email: info@zoyaedge.com', 25, 92);
    doc.text('Web: www.zoyaedge.com', 25, 97);

    // Client (Dynamic)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text('DESTINATAIRE', 120, 65);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(data.clientName, 120, 72);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.text(data.clientEmail, 120, 77);
    doc.text(`Date d'émission: ${data.date}`, 120, 85);
    doc.text(`Méthode: ${data.paymentMethod}`, 120, 90);
    doc.text(`Statut: ${data.status.toUpperCase()}`, 120, 95);

    // -- ITEMS TABLE --
    const tableBody = [
      [
        `Abonnement ZoyaEdge - Plan ${data.planName.toUpperCase()}`,
        '1',
        `${data.subtotal.toLocaleString()} ${data.currency}`,
        `${data.subtotal.toLocaleString()} ${data.currency}`
      ]
    ];

    autoTable(doc, {
      startY: 110,
      head: [['Description des services', 'Qté', 'Prix Unitaire HT', 'Total HT']],
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryRed as [number, number, number], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 6,
      },
      margin: { left: 25, right: 15 }
    });

    // -- SUMMARY SECTION --
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Total summary box
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(120, finalY, 75, 45, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    
    doc.text('Sous-total HT:', 125, finalY + 10);
    doc.text(`${data.subtotal.toLocaleString()} ${data.currency}`, 190, finalY + 10, { align: 'right' });
    
    doc.text(`TVA (${data.vatRate}%):`, 125, finalY + 18);
    doc.text(`${data.vat.toLocaleString()} ${data.currency}`, 190, finalY + 18, { align: 'right' });
    
    doc.text(`Frais Pay (${data.feeRate}%):`, 125, finalY + 26);
    doc.text(`${data.fee.toLocaleString()} ${data.currency}`, 190, finalY + 26, { align: 'right' });
    
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(125, finalY + 30, 190, finalY + 30);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('TOTAL PAYÉ:', 125, finalY + 38);
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text(`${data.amount.toLocaleString()} ${data.currency}`, 190, finalY + 38, { align: 'right' });

    // -- STAMP / PAID WATERMARK --
    if (data.status === 'completed') {
      doc.setDrawColor(34, 197, 94); // Green-500
      doc.setLineWidth(1);
      doc.roundedRect(30, finalY + 10, 40, 20, 2, 2, 'S');
      
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYÉ', 50, finalY + 23, { align: 'center', angle: 15 });
    }

    // -- FOOTER --
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    
    const footerY = 270;
    doc.line(25, footerY, 195, footerY);
    
    doc.text('Note finale:', 25, footerY + 8);
    doc.text('Ceci est une facture officielle générée par le système ZoyaEdge. Les services sont soumis aux conditions générales de vente.', 25, footerY + 13);
    doc.text('Pour toute question, veuillez nous contacter à support@zoyaedge.com ou via le portail client.', 25, footerY + 18);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text('Merci pour votre business!', 105, footerY + 25, { align: 'center' });

    // Save PDF
    doc.save(`Facture-ZoyaEdge-${data.invoiceNumber}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Une erreur est survenue lors de la génération de la facture.');
  }
};
