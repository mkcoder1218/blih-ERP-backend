import type { Request } from 'express';

export const SUPPORTED_LANGUAGES = ['en', 'am', 'ti', 'om'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

const dictionaries: Record<AppLanguage, Record<string, string>> = {
  en: {},
  am: {
    'Missing access token': 'የመዳረሻ ቶከን የለም',
    'Invalid user': 'ተጠቃሚው ትክክል አይደለም',
    'User deleted': 'ተጠቃሚው ተሰርዟል',
    'User is not active': 'ተጠቃሚው ንቁ አይደለም',
    'Employee has left the company': 'ሰራተኛው ኩባንያውን ለቋል',
    'Invalid or expired token': 'ቶከኑ ትክክል አይደለም ወይም ጊዜው አልፏል',
    'User not found': 'ተጠቃሚው አልተገኘም',
    'Business not found': 'ድርጅቱ አልተገኘም',
    'Business ID required contextually.': 'የድርጅት መለያ ያስፈልጋል።',
    'Default configurations initialized': 'ነባሪ ቅንብሮች ተጀምረዋል',
    'Invalid credentials': 'የመግቢያ መረጃው ትክክል አይደለም',
    'Invalid email or password': 'ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም',
    'Access denied': 'መዳረሻ ተከልክሏል',
    'Forbidden': 'የተከለከለ',
    'Unauthorized': 'ፈቃድ የለም',
    'Not found': 'አልተገኘም',
    'Validation failed': 'ማረጋገጫው አልተሳካም',
    'Internal server error': 'የውስጥ ሰርቨር ስህተት',
    'Request failed': 'ጥያቄው አልተሳካም',
    'Created successfully': 'በተሳካ ሁኔታ ተፈጥሯል',
    'Updated successfully': 'በተሳካ ሁኔታ ተዘምኗል',
    'Deleted successfully': 'በተሳካ ሁኔታ ተሰርዟል',
    'Saved successfully': 'በተሳካ ሁኔታ ተቀምጧል',
    'Approved successfully': 'በተሳካ ሁኔታ ጸድቋል',
    'Rejected successfully': 'በተሳካ ሁኔታ ውድቅ ተደርጓል',
    'Email already in use': 'ኢሜይሉ አስቀድሞ ጥቅም ላይ ነው',
    'Phone already in use': 'ስልኩ አስቀድሞ ጥቅም ላይ ነው',
    'File not found': 'ፋይሉ አልተገኘም',
    'Permission denied': 'ፈቃድ ተከልክሏል',
    'Insufficient permissions': 'በቂ ፈቃድ የለም',
    'Unsupported language': 'የማይደገፍ ቋንቋ',
  },
  ti: {
    'Missing access token': 'ናይ መእተዊ ቶከን የለን',
    'Invalid user': 'ተጠቃሚ ቅኑዕ ኣይኮነን',
    'User deleted': 'ተጠቃሚ ተደምሲሱ',
    'User is not active': 'ተጠቃሚ ንጡፍ ኣይኮነን',
    'Employee has left the company': 'ሰራሕተኛ ካብ ኩባንያ ወጺኡ',
    'Invalid or expired token': 'ቶከን ቅኑዕ ኣይኮነን ወይ ግዚኡ ሓሊፉ',
    'User not found': 'ተጠቃሚ ኣይተረኽበን',
    'Business not found': 'ትካል ኣይተረኽበን',
    'Business ID required contextually.': 'መለለዪ ትካል የድሊ።',
    'Default configurations initialized': 'ነባሪ ቅንብራት ተጀሚሮም',
    'Invalid credentials': 'ናይ መእተዊ ሓበሬታ ቅኑዕ ኣይኮነን',
    'Invalid email or password': 'ኢመይል ወይ መሕለፊ ቃል ቅኑዕ ኣይኮነን',
    'Access denied': 'መእተዊ ተኸልኪሉ',
    'Forbidden': 'ዝተኸልከለ',
    'Unauthorized': 'ፍቓድ የለን',
    'Not found': 'ኣይተረኽበን',
    'Validation failed': 'ምርግጋጽ ኣይተዓወተን',
    'Internal server error': 'ውሽጣዊ ጌጋ ሰርቨር',
    'Request failed': 'ሕቶ ኣይተዓወተን',
    'Created successfully': 'ብዓወት ተፈጢሩ',
    'Updated successfully': 'ብዓወት ተሓዲሱ',
    'Deleted successfully': 'ብዓወት ተደምሲሱ',
    'Saved successfully': 'ብዓወት ተዓቂቡ',
    'Approved successfully': 'ብዓወት ጸዲቑ',
    'Rejected successfully': 'ብዓወት ተነጺጉ',
    'Email already in use': 'ኢመይል ድሮ ኣብ ጥቕሚ ኣሎ',
    'Phone already in use': 'ተሌፎን ድሮ ኣብ ጥቕሚ ኣሎ',
    'File not found': 'ፋይል ኣይተረኽበን',
    'Permission denied': 'ፍቓድ ተኸልኪሉ',
    'Insufficient permissions': 'እኹል ፍቓድ የለን',
    'Unsupported language': 'ዘይድገፍ ቋንቋ',
  },
  om: {
    'Missing access token': 'Mallattoon seensaa hin jiru',
    'Invalid user': 'Fayyadamaan sirrii miti',
    'User deleted': 'Fayyadamaan haqameera',
    'User is not active': 'Fayyadamaan hojii irra hin jiru',
    'Employee has left the company': 'Hojjetaan dhaabbaticha dhiiseera',
    'Invalid or expired token': 'Mallattoon sirrii miti yookaan yeroon isaa darbeera',
    'User not found': 'Fayyadamaan hin argamne',
    'Business not found': 'Dhaabbatni hin argamne',
    'Business ID required contextually.': 'Eenyummeessaan dhaabbataa barbaachisaadha.',
    'Default configurations initialized': 'Qindaa’inni durtii jalqabameera',
    'Invalid credentials': 'Odeeffannoon seensaa sirrii miti',
    'Invalid email or password': 'Imeeliin yookaan jechi darbii sirrii miti',
    'Access denied': 'Seensi dhorkameera',
    'Forbidden': 'Dhorkameera',
    'Unauthorized': 'Hayyamni hin jiru',
    'Not found': 'Hin argamne',
    'Validation failed': 'Mirkaneessuun hin milkoofne',
    'Internal server error': 'Dogoggora keessoo sarvarii',
    'Request failed': 'Gaaffiin hin milkoofne',
    'Created successfully': 'Milkaa’inaan uumameera',
    'Updated successfully': 'Milkaa’inaan haaromfameera',
    'Deleted successfully': 'Milkaa’inaan haqameera',
    'Saved successfully': 'Milkaa’inaan olkaa’ameera',
    'Approved successfully': 'Milkaa’inaan mirkanaa’eera',
    'Rejected successfully': 'Milkaa’inaan kufaa taasifameera',
    'Email already in use': 'Imeeliin kun duraan hojii irra jira',
    'Phone already in use': 'Bilbilli kun duraan hojii irra jira',
    'File not found': 'Faayiliin hin argamne',
    'Permission denied': 'Hayyamni dhorkameera',
    'Insufficient permissions': 'Hayyamni gahaan hin jiru',
    'Unsupported language': 'Afaan hin deeggaramne',
  },
};

export function normalizeLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as AppLanguage) : null;
}

export function resolveRequestLanguage(req: Request): AppLanguage {
  const explicit = normalizeLanguage(req.headers['x-locale']);
  if (explicit) return explicit;

  const acceptLanguage = req.headers['accept-language'];
  if (typeof acceptLanguage === 'string') {
    for (const part of acceptLanguage.split(',')) {
      const language = normalizeLanguage(part.split(';')[0]);
      if (language) return language;
    }
  }

  return DEFAULT_LANGUAGE;
}

export function translateApiMessage(message: string, language: AppLanguage): string {
  if (language === 'en') return message;
  return dictionaries[language][message] ?? message;
}

const TRANSLATABLE_KEYS = new Set(['message', 'error']);

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function localizeValue(value: unknown, language: AppLanguage, parentKey?: string): unknown {
  if (typeof value === 'string') {
    if (parentKey && (TRANSLATABLE_KEYS.has(parentKey) || parentKey === 'errors')) {
      return translateApiMessage(value, language);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeValue(item, language, parentKey));
  }

  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = localizeValue(child, language, key);
  }
  return result;
}

export function localizeResponsePayload<T>(payload: T, language: AppLanguage): T {
  return localizeValue(payload, language) as T;
}
