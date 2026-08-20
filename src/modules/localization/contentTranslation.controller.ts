import type { Request, Response } from 'express';
import { ContentTranslationService } from './contentTranslation.service';

export class ContentTranslationController {
  private service = new ContentTranslationService();

  list = async (req: Request, res: Response) => {
    const translations = await this.service.list(
      req.user!.businessId,
      req.params.entityType,
      req.params.entityId,
    );
    res.json({ translations });
  };

  saveField = async (req: Request, res: Response) => {
    const translations = await this.service.saveField(
      req.user!.businessId,
      req.params.entityType,
      req.params.entityId,
      req.params.field,
      req.body?.translations ?? {},
    );
    res.json({ message: 'Updated successfully', translations });
  };

  removeField = async (req: Request, res: Response) => {
    await this.service.removeField(
      req.user!.businessId,
      req.params.entityType,
      req.params.entityId,
      req.params.field,
    );
    res.json({ message: 'Deleted successfully' });
  };
}
