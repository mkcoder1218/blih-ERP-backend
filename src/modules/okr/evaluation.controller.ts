import type { Request, Response, NextFunction } from 'express';
import { evaluationService } from './evaluation.service';

export class EvaluationController {
  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const data = await evaluationService.listTemplates(businessId, req.query);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const template = await evaluationService.getTemplate(businessId, req.params.id);
      res.status(200).json({ template });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const template = await evaluationService.createTemplate(businessId, userId, req.body);
      res.status(201).json({ template });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const template = await evaluationService.updateTemplate(businessId, req.params.id, req.body);
      res.status(200).json({ template });
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      await evaluationService.deleteTemplate(businessId, req.params.id);
      res.status(200).json({ message: "Template successfully deleted" });
    } catch (error) {
      next(error);
    }
  }

  async duplicateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const template = await evaluationService.duplicateTemplate(businessId, req.params.id, userId);
      res.status(201).json({ template });
    } catch (error) {
      next(error);
    }
  }

  async downloadSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const template = await evaluationService.getTemplate(businessId, req.params.id);
      
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: template.title,
        description: template.description,
        type: "object",
        properties: (template.sections || []).reduce((acc: any, sec: any) => {
          (sec.questions || []).forEach((q: any) => {
            acc[q.id] = {
              type: q.type === 'NUMBER' || q.type === 'RATING' ? 'number' : q.type === 'BOOLEAN' ? 'boolean' : 'string',
              title: q.label,
              description: q.description,
              isRequired: q.isRequired
            };
          });
          return acc;
        }, {})
      };

      res.setHeader('Content-disposition', `attachment; filename=evaluation_schema_${req.params.id}.json`);
      res.setHeader('Content-type', 'application/json');
      res.send(JSON.stringify(jsonSchema, null, 2));
    } catch (error) {
      next(error);
    }
  }

  // --- Assignments & Responses ---
  async assignTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const assignments = await evaluationService.createAssignments(businessId, req.body);
      res.status(201).json({ assignments });
    } catch (error) {
      next(error);
    }
  }

  async listUserAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const assignments = await evaluationService.listAssignments(businessId, userId, req.query);
      res.status(200).json({ assignments });
    } catch (error) {
      next(error);
    }
  }

  async getAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const assignment = await evaluationService.getAssignmentDetails(businessId, req.params.id);
      res.status(200).json({ assignment });
    } catch (error) {
      next(error);
    }
  }

  async submitAssignmentResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const response = await evaluationService.submitResponse(businessId, userId, req.body);
      res.status(200).json({ response });
    } catch (error) {
      next(error);
    }
  }

  async getResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const response = await evaluationService.getResponseDetails(businessId, req.params.assignmentId);
      res.status(200).json({ response });
    } catch (error) {
      next(error);
    }
  }

  async templateStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const stats = await evaluationService.getCompletionStats(businessId, req.params.id);
      res.status(200).json({ stats });
    } catch (error) {
      next(error);
    }
  }
}

export const evaluationController = new EvaluationController();
