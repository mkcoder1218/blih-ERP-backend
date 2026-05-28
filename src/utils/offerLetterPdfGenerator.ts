import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export async function generateOfferLetterPdf(htmlContent: string, businessId: string, offerLetterId: string): Promise<string> {
  const pdfStoragePath = process.env.OFFER_LETTER_PDF_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'offer_letters');
  const targetDir = path.join(pdfStoragePath, businessId);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fileName = `offer_${offerLetterId}.pdf`;
  const tempFilePath = path.join(targetDir, fileName);

  const browser = await puppeteer.launch({
    headless: true, // true is the regular headless, 'new' might be needed depending on puppeteer version but true works mostly
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' } as any);
    await page.pdf({
      path: tempFilePath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      printBackground: true,
    });
    return tempFilePath;
  } finally {
    await browser.close();
  }
}
