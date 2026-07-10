import { Request, Response } from 'express';
import { db } from '../../models';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { renderOfferLetter } from '../../utils/offerLetterRenderer';
import { generateOfferLetterPdf } from '../../utils/offerLetterPdfGenerator';
import { sendOfferLetterEmail } from '../../utils/offerLetterMailer';
import { DEFAULT_EMPLOYMENT_STATUS } from '../../constants/employee.constants';

export class OfferLetterController {
  
  // --- Templates ---
  getTemplates = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const templates = await db.OfferLetterTemplate.findAll({ where: { businessId, isActive: true } });
      successResponse(res, templates);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  createTemplate = async (req: Request, res: Response) => {
    try {
      const { name, subject, bodyHtml, bodyText, variables } = req.body;
      const template = await db.OfferLetterTemplate.create({
        businessId: req.user!.businessId,
        name,
        subject,
        bodyHtml,
        bodyText,
        variables: variables || [],
        createdById: req.user!.id,
        updatedById: req.user!.id,
      });
      successResponse(res, template, "Template created", 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  updateTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const template = await db.OfferLetterTemplate.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!template) return errorResponse(res, "Template not found", 404);
      
      updates.updatedById = req.user!.id;
      await template.update(updates);
      successResponse(res, template);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  deleteTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await db.OfferLetterTemplate.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!template) return errorResponse(res, "Template not found", 404);
      
      await template.update({ isActive: false, updatedById: req.user!.id });
      successResponse(res, null, "Template deleted");
    } catch (e: any) { errorResponse(res, e.message); }
  };


  // --- Offer Letters ---
  getOfferLetters = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit || 20);
      const offset = Number(req.query.offset || 0);
      const result = await db.OfferLetter.findAndCountAll({
        where: { businessId: req.user!.businessId },
        limit, offset,
        order: [['createdAt', 'DESC']],
        include: [
          { model: db.OfferLetterTemplate, attributes: ['name'] },
          { model: db.Department, attributes: ['name'] },
          { model: db.Role, attributes: ['name'] },
          { model: db.Position, attributes: ['title'] },
        ]
      });
      paginationResponse(res, result.rows, result.count, offset/limit + 1, limit);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  getOfferLetter = async (req: Request, res: Response) => {
    try {
      const letter = await db.OfferLetter.findOne({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: [
          { model: db.OfferLetterTemplate, attributes: ['name'] },
          { model: db.Department, attributes: ['name'] },
          { model: db.Role, attributes: ['name'] },
          { model: db.Position, attributes: ['title'] },
        ]
      });
      if (!letter) return errorResponse(res, "Offer letter not found", 404);
      successResponse(res, letter);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  createOfferLetter = async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      // Sanitize empty UUID strings to null so Postgres doesn't choke
      for (const field of ['departmentId', 'roleId', 'positionId', 'reportingManagerId']) {
        if (body[field] === '' || body[field] === undefined) body[field] = null;
      }
      const payload = { ...body, businessId: req.user!.businessId, createdById: req.user!.id };
      const letter = await db.OfferLetter.create(payload);
      successResponse(res, letter, "Offer draft created", 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  updateOfferLetter = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const letter = await db.OfferLetter.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!letter) return errorResponse(res, "Not found", 404);
      if (letter.status !== 'DRAFT') return errorResponse(res, "Only DRAFT letters can be updated", 400);

      await letter.update(req.body);
      successResponse(res, letter);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  deleteOfferLetter = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const letter = await db.OfferLetter.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!letter) return errorResponse(res, "Not found", 404);
      if (letter.status !== 'DRAFT') return errorResponse(res, "Only DRAFT letters can be deleted", 400);

      await letter.destroy();
      successResponse(res, null, "Deleted");
    } catch (e: any) { errorResponse(res, e.message); }
  };

  previewOfferLetter = async (req: Request, res: Response) => {
    try {
      const { templateId, data } = req.body;
      const template = await db.OfferLetterTemplate.findOne({ where: { id: templateId, businessId: req.user!.businessId } });
      if (!template) return errorResponse(res, "Template not found", 404);

      // Allow the caller to pass an edited body/subject (from the inline editor)
      const bodyHtml    = data?.overrideBodyHtml ?? template.bodyHtml;
      const bodyText    = data?.overrideSubject   ? '' : (template.bodyText || '');
      const subject     = data?.overrideSubject   ?? template.subject;

      // Strip the override keys from the render data so they don't appear as {{...}}
      const renderData: Record<string, string> = { ...data };
      delete renderData.overrideBodyHtml;
      delete renderData.overrideSubject;

      // Add common aliases so templates using {{name}} or {{positionTitle}} work too
      renderData.name          = renderData.candidateName  || renderData.name          || '';
      renderData.positionTitle = renderData.positionName   || renderData.positionTitle || renderData.roleName || '';
      renderData.department    = renderData.departmentName || renderData.department    || '';
      renderData.position      = renderData.positionName   || renderData.position      || '';
      renderData.role          = renderData.roleName       || renderData.role          || '';
      renderData.email         = renderData.candidateEmail || renderData.email         || '';
      renderData.phone         = renderData.candidatePhone || renderData.phone         || '';
      renderData.company       = renderData.companyName    || renderData.company       || '';
      // acceptUrl/rejectUrl are generated at send-time — use placeholder hrefs for preview
      renderData.acceptUrl = renderData.acceptUrl || '#accept-preview';
      renderData.rejectUrl = renderData.rejectUrl || '#reject-preview';

      const renderedHtml    = renderOfferLetter(bodyHtml,  renderData);
      const renderedText    = renderOfferLetter(bodyText,  renderData);
      const renderedSubject = renderOfferLetter(subject,   renderData);

      // If the template doesn't include styled accept/reject buttons, append preview placeholders.
      // We check for the table-based button pattern (used in the failsafe send block).
      // A bare {{acceptUrl}} link in the template body is NOT sufficient — we still append.
      let previewHtml = renderedHtml.renderedContent;
      const hasStyledButtons = previewHtml.includes('role="presentation"') && 
                               (previewHtml.includes('Accept') || previewHtml.includes('accept'));
      if (!hasStyledButtons) {
        previewHtml += `
          <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">
            <p style="color:#64748b;font-size:13px;margin-bottom:20px;font-style:italic;">
              ↓ The candidate will see these buttons in the actual email
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td style="padding-right:12px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="border-radius:8px;background:#16a34a;">
                        <span style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;border-radius:8px;background:#16a34a;">
                          ✓ Accept Offer
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-left:12px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="border-radius:8px;background:#ffffff;border:2px solid #dc2626;">
                        <span style="display:inline-block;padding:12px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#dc2626;border-radius:8px;">
                          ✗ Decline Offer
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `;
      }
      
      successResponse(res, {
        html: previewHtml,
        text: renderedText.renderedContent,
        subject: renderedSubject.renderedContent,
        missingVariables: [...new Set([...renderedHtml.missingVariables, ...renderedText.missingVariables, ...renderedSubject.missingVariables])]
          .filter((v: string) => v !== 'acceptUrl' && v !== 'rejectUrl')
      });
    } catch (e: any) { errorResponse(res, e.message); }
  };

  generatePdf = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const letter = await db.OfferLetter.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!letter) return errorResponse(res, "not found", 404);
      if (!letter.renderedHtml) return errorResponse(res, "Letter must be rendered first. (Sync missing if using draft)", 400);

      const pdfPath = await generateOfferLetterPdf(letter.renderedHtml, req.user!.businessId, letter.id);
      await letter.update({ pdfPath });
      
      successResponse(res, { pdfPath });
    } catch (e: any) { errorResponse(res, e.message); }
  };

  sendOfferLetter = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { data } = req.body;
      
      const letter = await db.OfferLetter.findOne({ where: { id, businessId: req.user!.businessId } });
      if (!letter) return errorResponse(res, "Not found", 404);
      if (letter.status !== 'DRAFT') return errorResponse(res, "Letter must be in DRAFT to send", 400);
      
      const template = await db.OfferLetterTemplate.findOne({ where: { id: letter.templateId } });
      if (!template) return errorResponse(res, "Template linked is not found", 404);

      // Build the public accept/reject URLs — must match the route mounted in app.ts
      // Public offer routes are at: /api/v1/hr/public/offers/:id/accept|reject
      const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
      const acceptUrl = `${backendUrl}/api/v1/hr/public/offers/${letter.id}/accept`;
      const rejectUrl = `${backendUrl}/api/v1/hr/public/offers/${letter.id}/reject`;

      // Merge both URLs into render data so templates can use {{acceptUrl}} and {{rejectUrl}}
      // Also add common aliases so templates using {{name}} or {{positionTitle}} work too
      // Resolve reportingManager name from user if reportingManagerId is provided
      let reportingManagerName = data?.reportingManager || '';
      if (data?.reportingManagerId) {
        const mgr = await db.User.findByPk(data.reportingManagerId, { attributes: ['fullName'] });
        if (mgr) reportingManagerName = mgr.fullName;
      }

      const renderData: Record<string, string> = {
        ...(data || {}),
        acceptUrl,
        rejectUrl,
        reportingManager: reportingManagerName,
        // aliases for common template variable names
        name:          data?.candidateName  || data?.name          || '',
        positionTitle: data?.positionName   || data?.positionTitle || data?.roleName || '',
        department:    data?.departmentName || data?.department    || '',
        position:      data?.positionName   || data?.position      || '',
        role:          data?.roleName       || data?.role          || '',
        email:         data?.candidateEmail || data?.email         || '',
        phone:         data?.candidatePhone || data?.phone         || '',
        company:       data?.companyName    || data?.company       || '',
      };

      // Render
      const renderedHtml = renderOfferLetter(template.bodyHtml, renderData);
      const renderedText = renderOfferLetter(template.bodyText, renderData);
      const renderedSubject = renderOfferLetter(template.subject, renderData);
      
      const missing = [...new Set([...renderedHtml.missingVariables, ...renderedText.missingVariables, ...renderedSubject.missingVariables])];
      // acceptUrl and rejectUrl are injected above — if still missing it means the renderer
      // didn't find them, which shouldn't happen. Only block on truly missing data fields.
      const blockingMissing = missing.filter(v => v !== 'acceptUrl' && v !== 'rejectUrl');
      if (blockingMissing.length > 0) {
        return errorResponse(res, `Missing template variables: ${blockingMissing.join(', ')}`, 400);
      }

      // Failsafe: if template didn't include the action buttons, append them
      let finalHtml = renderedHtml.renderedContent;
      const hasBothButtons = finalHtml.includes(acceptUrl) && finalHtml.includes(rejectUrl);
      if (!hasBothButtons) {
        finalHtml += `
          <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">
            <p style="color:#64748b;font-size:14px;margin-bottom:24px;">
              Please respond to this job offer by clicking one of the buttons below:
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td style="padding-right:12px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="border-radius:8px;background:#16a34a;">
                        <a href="${acceptUrl}"
                           target="_blank"
                           style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background:#16a34a;border:1px solid #16a34a;mso-padding-alt:0;text-align:center;">
                          ✓ Accept Offer
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-left:12px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="border-radius:8px;background:#ffffff;border:2px solid #dc2626;">
                        <a href="${rejectUrl}"
                           target="_blank"
                           style="display:inline-block;padding:12px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#dc2626;text-decoration:none;border-radius:8px;mso-padding-alt:0;text-align:center;">
                          ✗ Decline Offer
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="color:#94a3b8;font-size:11px;margin-top:20px;">
              Accept: <a href="${acceptUrl}" style="color:#16a34a;">${acceptUrl}</a><br/>
              Decline: <a href="${rejectUrl}" style="color:#dc2626;">${rejectUrl}</a>
            </p>
          </div>
        `;
      }

      await letter.update({
        renderedHtml: finalHtml,
        renderedText: renderedText.renderedContent,
        renderedSubject: renderedSubject.renderedContent
      });

      // Generate PDF and send email
      const pdfPath = await generateOfferLetterPdf(finalHtml, req.user!.businessId, letter.id);
      await letter.update({ pdfPath });

      await sendOfferLetterEmail(
        letter.candidateEmail,
        renderedSubject.renderedContent,
        finalHtml,
        renderedText.renderedContent,
        pdfPath,
        req.user!.businessId
      );

      await letter.update({
        status: 'SENT',
        sentAt: new Date()
      });

      successResponse(res, letter, "Offer letter sent successfully");
    } catch (e: any) { errorResponse(res, e.message); }
  };

  acceptOffer = async (req: Request, res: Response) => {
    console.log(`[OfferAccept] Attempting to accept offer for ID: ${req.params.id}`);
    const transaction = await db.sequelize.transaction();
    try {
      const { id } = req.params;
      const letter = await db.OfferLetter.findByPk(id, { transaction });
      
      if (!letter) {
        if (transaction) await transaction.rollback();
        return errorResponse(res, "Offer letter not found", 404);
      }
      
      if (letter.status === 'ACCEPTED') {
        if (transaction) await transaction.rollback();
        return successResponse(res, null, "Offer already accepted");
      }

      await letter.update({
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }, { transaction });

      const user = await db.User.findOne({ 
        where: { email: letter.candidateEmail, businessId: letter.businessId },
        transaction 
      });

      if (user) {
        await user.update({ status: 'active' }, { transaction });

        const empRec = await db.EmployeeRecord.findOne({ 
          where: { userId: user.id, businessId: letter.businessId },
          transaction 
        });
        
        if (empRec) {
          await empRec.update({ 
            employmentStatus: DEFAULT_EMPLOYMENT_STATUS
          }, { transaction });
        }
      }

      await transaction.commit();
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Offer Accepted</title></head>
        <body style="font-family:Arial,sans-serif;background:#f0fdf4;margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;padding:60px 40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:520px;margin:40px auto;">
            <div style="width:72px;height:72px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
              <span style="font-size:36px;">🎉</span>
            </div>
            <h1 style="color:#16a34a;font-size:26px;margin:0 0 12px;font-weight:800;">Offer Accepted!</h1>
            <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 12px;">
              Congratulations, <strong style="color:#1e293b;">${letter.candidateName}</strong>! You have successfully accepted the job offer.
            </p>
            <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 32px;padding:16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
              Your HR team will be in touch shortly with your personalised onboarding link.<br/>
              Please check your email — your onboarding journey is about to begin!
            </p>
            <div style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 24px;">
              <p style="color:#15803d;font-size:13px;font-weight:600;margin:0;">
                ✓ Your offer has been accepted &amp; recorded
              </p>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (e: any) {
      if (transaction) await transaction.rollback();
      errorResponse(res, e.message);
    }
  };

  rejectOffer = async (req: Request, res: Response) => {
    console.log(`[OfferReject] Attempting to reject offer for ID: ${req.params.id}`);
    try {
      const { id } = req.params;
      const letter = await db.OfferLetter.findByPk(id);

      if (!letter) return errorResponse(res, "Offer letter not found", 404);

      if (letter.status === 'REJECTED') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>Already Declined</title></head>
          <body style="font-family:Arial,sans-serif;background:#fef2f2;margin:0;padding:0;min-height:100vh;">
            <div style="text-align:center;padding:60px 40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:480px;margin:40px auto;">
              <p style="color:#64748b;font-size:15px;">This offer has already been declined.</p>
            </div>
          </body>
          </html>
        `);
      }

      if (letter.status === 'ACCEPTED') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>Already Accepted</title></head>
          <body style="font-family:Arial,sans-serif;background:#f0fdf4;margin:0;padding:0;min-height:100vh;">
            <div style="text-align:center;padding:60px 40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:480px;margin:40px auto;">
              <p style="color:#64748b;font-size:15px;">This offer has already been accepted and cannot be declined.</p>
            </div>
          </body>
          </html>
        `);
      }

      await letter.update({
        status: 'REJECTED',
        rejectedAt: new Date(),
      });

      res.send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Offer Declined</title></head>
        <body style="font-family:Arial,sans-serif;background:#fef2f2;margin:0;padding:0;min-height:100vh;">
          <div style="text-align:center;padding:60px 40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:480px;margin:40px auto;">
            <div style="width:64px;height:64px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
              <span style="font-size:32px;">✗</span>
            </div>
            <h1 style="color:#dc2626;font-size:24px;margin:0 0 12px;">Offer Declined</h1>
            <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 8px;">
              You have declined this job offer. We appreciate your time and wish you the best in your career journey.
            </p>
            <p style="color:#94a3b8;font-size:13px;">The hiring team has been notified of your decision.</p>
          </div>
        </body>
        </html>
      `);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };
}
