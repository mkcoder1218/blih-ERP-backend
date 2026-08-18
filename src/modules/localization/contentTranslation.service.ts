import { Op } from 'sequelize';
import { sequelize } from '../../database/sequelize';
import { ContentTranslation } from './contentTranslation.model';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n/localization';

const SAFE_IDENTIFIER = /^[a-zA-Z0-9_.:-]{1,191}$/;

function assertIdentifier(value: string, label: string) {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Invalid ${label}`);
}

export class ContentTranslationService {
  async list(businessId: string, entityType: string, entityId: string) {
    assertIdentifier(entityType, 'entity type');
    assertIdentifier(entityId, 'entity id');

    const rows = await ContentTranslation.findAll({
      where: { businessId, entityType, entityId },
      order: [['field', 'ASC'], ['language', 'ASC']],
    });

    const translations: Record<string, Partial<Record<AppLanguage, string>>> = {};
    for (const row of rows as any[]) {
      if (!translations[row.field]) translations[row.field] = {};
      translations[row.field][row.language as AppLanguage] = row.value;
    }
    return translations;
  }

  async saveField(
    businessId: string,
    entityType: string,
    entityId: string,
    field: string,
    translations: Record<string, unknown>,
  ) {
    assertIdentifier(entityType, 'entity type');
    assertIdentifier(entityId, 'entity id');
    assertIdentifier(field, 'field');

    const entries = Object.entries(translations ?? {}).filter(
      ([language, value]) =>
        (SUPPORTED_LANGUAGES as readonly string[]).includes(language) && typeof value === 'string',
    ) as [AppLanguage, string][];

    if (!entries.length) throw new Error('At least one supported translation is required');

    await sequelize.transaction(async (transaction) => {
      for (const [language, rawValue] of entries) {
        const value = rawValue.trim();
        const where = { businessId, entityType, entityId, field, language };
        const existing = await ContentTranslation.findOne({ where, transaction });

        if (!value) {
          if (existing) await existing.destroy({ transaction });
          continue;
        }

        if (existing) await existing.update({ value }, { transaction });
        else await ContentTranslation.create({ ...where, value }, { transaction });
      }
    });

    return this.list(businessId, entityType, entityId);
  }

  async removeField(businessId: string, entityType: string, entityId: string, field: string) {
    assertIdentifier(entityType, 'entity type');
    assertIdentifier(entityId, 'entity id');
    assertIdentifier(field, 'field');
    await ContentTranslation.destroy({ where: { businessId, entityType, entityId, field } });
  }

  async resolve(
    businessId: string,
    entityType: string,
    entityId: string,
    field: string,
    language: AppLanguage,
    fallbackValue?: string,
  ) {
    const rows = await ContentTranslation.findAll({
      where: {
        businessId,
        entityType,
        entityId,
        field,
        language: { [Op.in]: [language, DEFAULT_LANGUAGE] },
      },
    });
    const byLanguage = new Map((rows as any[]).map((row) => [row.language, row.value]));
    return byLanguage.get(language) ?? byLanguage.get(DEFAULT_LANGUAGE) ?? fallbackValue ?? '';
  }
}
