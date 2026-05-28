import nodemailer from 'nodemailer';

export async function sendOfferLetterEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  pdfAttachmentPath?: string
): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  let transportConfig: any;

  if (!host || !user || !pass) {
    console.warn('SMTP credentials missing. Generating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    transportConfig = {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    };
  } else {
    transportConfig = {
      host,
      port,
      secure,
      auth: { user, pass },
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'HR'}" <${process.env.SMTP_FROM_EMAIL || user}>`,
    to: toEmail,
    subject: subject,
    text: textContent,
    html: htmlContent,
  };

  if (pdfAttachmentPath) {
    mailOptions.attachments = [
      {
        filename: 'Offer_Letter.pdf',
        path: pdfAttachmentPath,
        contentType: 'application/pdf',
      },
    ];
  }

  const info = await transporter.sendMail(mailOptions);
  
  if (!host || !user || !pass) {
    console.log('--- TEST EMAIL SENT ---');
    console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info as any));
    console.log('-----------------------');
  }

  return true;
}
