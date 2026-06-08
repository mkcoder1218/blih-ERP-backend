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
      const where: any = { businessId };

      // Date range filter
      const from = req.query.from as string | undefined;
      const to   = req.query.to   as string | undefined;
      if (from || to) {
        where.eventDate = {};
        if (from) where.eventDate[Op.gte] = from;
        if (to)   where.eventDate[Op.lte] = to;
      }

      // Type filter
      if (req.query.type) where.eventType = req.query.type;

      // Non-managers only see upcoming events they're eligible for
      if (!canManage) {
        const today = new Date().toISOString().slice(0, 10);
        where.eventDate = { ...(where.eventDate ?? {}), [Op.gte]: today };
        where[Op.or] = [
          { visibility: "all" },
          { employeeUserId: req.user!.id },
          // departmentId scope could be added once we resolve the employee's dept
        ];
      }

      const { count, rows } = await db.HREvent.findAndCountAll({
        where,
        include: INCLUDE,
        order: [["eventDate", "ASC"]],
        limit:  size,
        offset: (page - 1) * size,
      });

      successResponse(res, { rows, total: count, page, totalPages: Math.ceil(count / size) });
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
            color:           'from-emerald-400 to-teal-500',
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
