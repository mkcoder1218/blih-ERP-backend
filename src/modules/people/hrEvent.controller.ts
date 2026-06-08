import type { Request, Response } from "express";
import { Op } from "sequelize";
import { db } from "../../models";
import { successResponse, errorResponse } from "../../utils/response";
import { AuditLogService } from "../../services/auditLog.service";

const INCLUDE = [
  { model: db.User, as: "employee", attributes: ["id", "fullName", "email"], required: false },
  { model: db.User, as: "creator",  attributes: ["id", "fullName"],          required: false },
  { model: db.Department, as: "department", attributes: ["id", "name"],      required: false },
];

export class HREventController {

  /**
   * GET /people/events
   * - HR (hr.read / profiles.read) sees all events
   * - Regular employees see upcoming events visible to them
   *
   * Query params: type, from, to, page, size
   */
  list = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const canManage  = req.user?.permissions?.includes("hr.read")
                      || req.user?.permissions?.includes("hr.write")
                      || req.user?.isPlatformSuperAdmin;

      const page = Number(req.query.page || 1);
      const size = Number(req.query.size || 50);

      // Date range condition applied to both queries
      const dateFilter: any = {};
      const from = req.query.from as string | undefined;
      const to   = req.query.to   as string | undefined;
      if (from) dateFilter[Op.gte] = from;
      if (to)   dateFilter[Op.lte] = to;

      // ── 1. Business-scoped events (company events, birthdays, anniversaries…) ──
      const bizWhere: any = { businessId };
      if (req.query.type) bizWhere.eventType = req.query.type;
      if (Object.keys(dateFilter).length) bizWhere.eventDate = dateFilter;
      if (!canManage) {
        const today = new Date().toISOString().slice(0, 10);
        bizWhere.eventDate = { ...(bizWhere.eventDate ?? {}), [Op.gte]: today };
        bizWhere[Op.or] = [{ visibility: "all" }, { employeeUserId: req.user!.id }];
        // Exclude holidays from the business-scoped query — they come from the platform query below
        bizWhere.eventType = { [Op.ne]: 'holiday' };
      }

      const bizEvents = await db.HREvent.findAll({
        where: bizWhere,
        include: INCLUDE,
        order: [["eventDate", "ASC"]],
      });

      // ── 2. Platform-level holidays (all businesses share the same pool) ──
      // Holidays are queryable across ALL businesses — whoever imported them
      // for a given country/year, all companies benefit.
      let holidayRows: any[] = [];
      const typeFilter = req.query.type as string | undefined;
      if (!typeFilter || typeFilter === 'holiday') {
        const holidayWhere: any = { eventType: 'holiday' };
        if (Object.keys(dateFilter).length) holidayWhere.eventDate = dateFilter;
        if (!canManage) {
          const today = new Date().toISOString().slice(0, 10);
          holidayWhere.eventDate = { ...(holidayWhere.eventDate ?? {}), [Op.gte]: today };
        }
        holidayRows = await db.HREvent.findAll({
          where: holidayWhere,
          include: INCLUDE,
          order: [["eventDate", "ASC"]],
          // Deduplicate by title+date at the DB level via GROUP BY isn't easy in Sequelize,
          // so we deduplicate in JS below
        });

        // Deduplicate holidays by title + eventDate (same holiday may be imported by multiple companies)
        const seen = new Set<string>();
        holidayRows = holidayRows.filter((h: any) => {
          const key = `${h.title}__${h.eventDate}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // ── 3. Merge and sort ─────────────────────────────────────────────────────
      // For company-scoped query, holidays already excluded above; merge with platform holidays
      let combined: any[];
      if (canManage) {
        // HR/admin sees all business events; holidays already in bizEvents if type filter not set
        if (typeFilter === 'holiday') {
          combined = holidayRows;
        } else if (typeFilter) {
          combined = bizEvents;
        } else {
          // All types: business events (non-holiday) + deduplicated holidays
          const bizNonHoliday = bizEvents.filter((e: any) => e.eventType !== 'holiday');
          combined = [...bizNonHoliday, ...holidayRows]
            .sort((a: any, b: any) => a.eventDate.localeCompare(b.eventDate));
        }
      } else {
        combined = [...bizEvents, ...holidayRows]
          .sort((a: any, b: any) => a.eventDate.localeCompare(b.eventDate));
      }

      // Apply pagination
      const total = combined.length;
      const paged = combined.slice((page - 1) * size, page * size);

      successResponse(res, { rows: paged, total, page, totalPages: Math.ceil(total / size) });
    } catch (e: any) { errorResponse(res, e.message); }
  };

  /**
   * POST /people/events  — HR only
   */
  create = async (req: Request, res: Response) => {
    try {
      const {
        employeeUserId, departmentId, eventType, title, description,
        eventDate, endDate, isRecurring, visibility, emoji, color, metadata,
      } = req.body;

      if (!eventType || !title || !eventDate)
        return errorResponse(res, "eventType, title and eventDate are required", 400);

      const r = await db.HREvent.create({
        businessId:      req.user!.businessId,
        createdByUserId: req.user!.id,
        employeeUserId:  employeeUserId  ?? null,
        departmentId:    departmentId    ?? null,
        eventType, title, description: description ?? null,
        eventDate, endDate: endDate ?? null,
        isRecurring: Boolean(isRecurring),
        visibility:  visibility ?? "all",
        emoji:  emoji ?? null,
        color:  color ?? null,
        metadata: metadata ?? {},
      });
      await AuditLogService.log("CREATED_HR_EVENT", "hr_events", String(r.id), null, {}, req);
      successResponse(res, r, "Event created.", 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  /**
   * PATCH /people/events/:id  — HR only
   */
  update = async (req: Request, res: Response) => {
    try {
      const r = await db.HREvent.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
      if (!r) return errorResponse(res, "Event not found", 404);

      const allowed = [
        "employeeUserId", "departmentId", "eventType", "title", "description",
        "eventDate", "endDate", "isRecurring", "visibility", "emoji", "color", "metadata",
      ];
      const payload: any = {};
      for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];
      await r.update(payload);
      await AuditLogService.log("UPDATED_HR_EVENT", "hr_events", String(r.id), null, payload, req);
      successResponse(res, r, "Event updated.");
    } catch (e: any) { errorResponse(res, e.message); }
  };

  /**
   * POST /people/events/import-holidays
   *
   * Fetches public holidays from Calendarific using the API key stored in
   * BusinessSetting (key: "calendarific_config"), then bulk-upserts them as
   * HREvent records of type "holiday".
   *
   * Body: { country?: string; year?: number; apiKey?: string }
   *   - country defaults to stored setting, then "ET"
   *   - year    defaults to current year
   *   - apiKey  can override stored key for one-off use
   */
  importHolidays = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;

      // ── 1. Load stored config (BusinessSetting key: calendarific_config) ──
      const storedSetting = await db.BusinessSetting.findOne({
        where: { businessId, key: 'calendarific_config' },
      });
      const stored: { apiKey?: string; country?: string } = storedSetting?.value ?? {};

      const apiKey  = req.body.apiKey  || stored.apiKey;
      const country = req.body.country || stored.country || 'ET';
      const year    = Number(req.body.year || new Date().getFullYear());

      if (!apiKey) return errorResponse(res, 'Calendarific API key not configured. Save it in Settings first.', 400);

      // ── 2. Fetch from Calendarific ────────────────────────────────────────
      const url = `https://calendarific.com/api/v2/holidays?api_key=${apiKey}&country=${country}&year=${year}`;
      const fetch = (await import('node-fetch')).default;
      const raw = await fetch(url);
      if (!raw.ok) return errorResponse(res, `Calendarific API error: ${raw.status} ${raw.statusText}`, 502);
      const json: any = await raw.json();

      if (json.meta?.code !== 200) return errorResponse(res, `Calendarific returned error: ${JSON.stringify(json.meta)}`, 502);

      const holidays: any[] = json.response?.holidays ?? [];

      // ── 3. Filter to National / Public holidays only ──────────────────────
      const publicHolidays = holidays.filter(h =>
        h.primary_type === 'Public Holiday' ||
        (h.type ?? []).includes('National holiday')
      );

      // ── 4. Upsert into HREvent ─────────────────────────────────────────────
      let created = 0;
      let skipped = 0;

      for (const h of publicHolidays) {
        const eventDate = h.date?.iso?.slice(0, 10); // "YYYY-MM-DD"
        if (!eventDate) continue;

        // Check for existing record with same title + date to avoid duplicates
        const existing = await db.HREvent.findOne({
          where: { businessId, eventType: 'holiday', eventDate, title: h.name },
        });

        if (!existing) {
          await db.HREvent.create({
            businessId,
            createdByUserId: req.user!.id,
            employeeUserId:  null,
            departmentId:    null,
            eventType:       'holiday',
            title:           h.name,
            description:     h.description ?? null,
            eventDate,
            endDate:         null,
            isRecurring:     true,   // public holidays recur annually
            visibility:      'all',
            emoji:           '🗓️',
            color:           null,   // no color needed — using gradient from eventType config
            metadata: {
              country,
              year,
              primaryType:   h.primary_type,
              canonicalUrl:  h.canonical_url ?? null,
              importedAt:    new Date().toISOString(),
              calendarific:  true,
            },
          });
          created++;
        } else {
          skipped++;
        }
      }

      await AuditLogService.log('IMPORTED_PUBLIC_HOLIDAYS', 'hr_events', businessId, null, { country, year, created, skipped }, req);

      successResponse(res, { country, year, total: publicHolidays.length, created, skipped },
        `Imported ${created} new holidays for ${country} ${year}. ${skipped} already existed.`
      );
    } catch (e: any) { errorResponse(res, e.message); }
  };

  /**
   * GET  /people/events/holiday-config  — read saved Calendarific config
   * POST /people/events/holiday-config  — save Calendarific config (apiKey + country)
   */
  getHolidayConfig = async (req: Request, res: Response) => {
    try {
      const setting = await db.BusinessSetting.findOne({
        where: { businessId: req.user!.businessId, key: 'calendarific_config' },
      });
      // Never send the raw API key back — mask it
      const val: any = setting?.value ?? {};
      successResponse(res, { country: val.country ?? 'ET', hasApiKey: Boolean(val.apiKey) });
    } catch (e: any) { errorResponse(res, e.message); }
  };

  saveHolidayConfig = async (req: Request, res: Response) => {
    try {
      const { apiKey, country } = req.body;
      if (!apiKey || !country) return errorResponse(res, 'apiKey and country are required', 400);

      const [setting] = await db.BusinessSetting.findOrCreate({
        where: { businessId: req.user!.businessId, key: 'calendarific_config' },
        defaults: {
          businessId: req.user!.businessId,
          key:        'calendarific_config',
          value:      {},
          category:   'integrations',
          isPublic:   false,
        },
      });
      await setting.update({ value: { apiKey, country } });
      successResponse(res, { country, hasApiKey: true }, 'Calendarific config saved.');
    } catch (e: any) { errorResponse(res, e.message); }
  };

  /**
   * DELETE /people/events/:id  — HR only
   */
  remove = async (req: Request, res: Response) => {
    try {
      const r = await db.HREvent.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
      if (!r) return errorResponse(res, "Event not found", 404);
      await r.destroy();
      await AuditLogService.log("DELETED_HR_EVENT", "hr_events", req.params.id, null, {}, req);
      successResponse(res, null, "Event deleted.");
    } catch (e: any) { errorResponse(res, e.message); }
  };
}
