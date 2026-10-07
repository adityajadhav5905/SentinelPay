import PDFDocument from 'pdfkit';

interface InvoiceData {
  paymentId: string;
  userId: string;
  amount: number;
  date: string;
  currency?: string;
}

/**
 * Generates an invoice PDF stream.
 */
export const generateInvoicePDF = (invoiceData: InvoiceData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 });

  generateHeader(doc);
  generateCustomerInformation(doc, invoiceData);
  generateInvoiceTable(doc, invoiceData);
  generateFooter(doc);

  doc.end();
  return doc;
};

function generateHeader(doc: PDFKit.PDFDocument) {
  doc
    //.image('src/config/logo.png', 50, 45, { width: 50 }) // Logo requires a valid image file
    .fillColor('#444444')
    .fontSize(20)
    .text('SentinelPay Inc.', 110, 57)
    .fontSize(10)
    .text('123 Tech Street', 200, 50, { align: 'right' })
    .text('Bangalore, India', 200, 65, { align: 'right' })
    .moveDown();
}

function generateCustomerInformation(doc: PDFKit.PDFDocument, invoiceData: InvoiceData) {
  doc
    .fillColor('#444444')
    .fontSize(20)
    .text('Invoice', 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text('Invoice Number:', 50, customerInformationTop)
    .font('Helvetica-Bold')
    .text(invoiceData.paymentId, 150, customerInformationTop)
    .font('Helvetica')
    .text('Invoice Date:', 50, customerInformationTop + 15)
    .text(invoiceData.date || new Date().toISOString().split('T')[0], 150, customerInformationTop + 15)
    .text('Balance Due:', 50, customerInformationTop + 30)
    .text('0', 150, customerInformationTop + 30)

    .font('Helvetica-Bold')
    .text(invoiceData.userId, 300, customerInformationTop)
    .font('Helvetica')
    .moveDown();

  generateHr(doc, 252);
}

function generateInvoiceTable(doc: PDFKit.PDFDocument, invoiceData: InvoiceData) {
  let i = 0;
  const invoiceTableTop = 330;

  doc.font('Helvetica-Bold');
  generateTableRow(doc, invoiceTableTop, 'Item', 'Description', 'Unit Cost', 'Quantity', 'Line Total');
  generateHr(doc, invoiceTableTop + 20);
  doc.font('Helvetica');

  const position = invoiceTableTop + (i + 1) * 30;
  generateTableRow(
    doc,
    position,
    'Subscription Plan',
    'SentinelPay Pro Svc',
    String(invoiceData.amount),
    '1',
    String(invoiceData.amount)
  );

  generateHr(doc, position + 20);

  const subtotalPosition = invoiceTableTop + (i + 2) * 30;
  // Totals
  doc.font('Helvetica-Bold');
  doc.text('Total', 400, subtotalPosition + 15);
  doc.text(String(invoiceData.amount), 500, subtotalPosition + 15); // Adjust column width if needed
}

function generateFooter(doc: PDFKit.PDFDocument) {
  doc
    .fontSize(10)
    .text(
      'Payment received. Thank you for your business.',
      50,
      780,
      { align: 'center', width: 500 }
    );
}

function generateTableRow(doc: PDFKit.PDFDocument, y: number, item: string, description: string, unitCost: string, quantity: string, lineTotal: string) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(description, 150, y)
    .text(unitCost, 280, y, { width: 90, align: 'right' })
    .text(quantity, 370, y, { width: 90, align: 'right' })
    .text(lineTotal, 0, y, { align: 'right' });
}

function generateHr(doc: PDFKit.PDFDocument, y: number) {
  doc
    .strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}
