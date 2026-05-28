import { Request, Response } from 'express';
import { db } from '../../models';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { renderOfferLetter } from '../../utils/offerLetterRenderer';
import { generateOfferLetterPdf } from '../../utils/offerLetterPdfGenerator';
import { sendOfferLetterEmail } from '../../utils/offerLetterMailer';

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
      const payload = { ...req.body, businessId: req.user!.businessId, createdById: req.user!.id };
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
      
      const renderedHtml = renderOfferLetter(template.bodyHtml, data);
      const renderedText = renderOfferLetter(template.bodyText, data);
      const renderedSubject = renderOfferLetter(template.subject, data);
      
      successResponse(res, {
        html: renderedHtml.renderedContent,
        text: renderedText.renderedContent,
        subject: renderedSubject.renderedContent,
        missingVariables: [...new Set([...renderedHtml.missingVariables, ...renderedText.missingVariables, ...renderedSubject.missingVariables])]
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

      // Render
      const renderedHtml = renderOfferLetter(template.bodyHtml, data);
      const renderedText = renderOfferLetter(template.bodyText, data);
      const renderedSubject = renderOfferLetter(template.subject, data);
      
      const missing = [...new Set([...renderedHtml.missingVariables, ...renderedText.missingVariables, ...renderedSubject.missingVariables])];
      if (missing.length > 0) {
        return errorResponse(res, `Missing template variables: ${missing.join(', ')}`, 400);
      }

      await letter.update({
        renderedHtml: renderedHtml.renderedContent,
        renderedText: renderedText.renderedContent,
        renderedSubject: renderedSubject.renderedContent
      });

      // Optionally Generate PDF directly before sending
      const pdfPath = await generateOfferLetterPdf(renderedHtml.renderedContent, req.user!.businessId, letter.id);
      await letter.update({ pdfPath });

      // Send Email
      await sendOfferLetterEmail(
        letter.candidateEmail,
        renderedSubject.renderedContent,
        renderedHtml.renderedContent,
        renderedText.renderedContent,
        pdfPath
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
            employmentStatus: 'probation' 
          }, { transaction });
        }
      }

      await transaction.commit();
      res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #2563eb;">Congratulations!</h1>
          <p>You have successfully accepted the job offer.</p>
          <p>Your account is now active. You can log in to the portal using the email and password provided in your onboarding email.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Go to Login</a>
        </div>
      `);
    } catch (e: any) {
      if (transaction) await transaction.rollback();
      errorResponse(res, e.message);
    }
  };
}
