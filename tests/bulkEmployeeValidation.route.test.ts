import express from "express";
import request from "supertest";

jest.mock("../src/middlewares/auth", () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = {
      id: "admin-1",
      businessId: "business-a",
      permissions: req.headers.authorization === "Bearer allowed" ? ["hr.write"] : [],
      roles: [],
      isPlatformSuperAdmin: false,
    };
    next();
  },
}));

jest.mock("../src/middlewares/requireActiveModule", () => ({
  requireActiveModule: () => (_req: any, _res: any, next: any) => next(),
}));

const validateMock = jest.fn();
const applyMock = jest.fn();
jest.mock("../src/modules/hr/bulkEmployeeValidation.service", () => ({
  BulkEmployeeValidationService: jest.fn().mockImplementation(() => ({
    validate: validateMock,
    apply: applyMock,
  })),
}));

jest.mock("../src/utils/offerLetterPdfGenerator", () => ({
  generateOfferLetterPdf: jest.fn(),
}));

jest.mock("../src/utils/offerLetterMailer", () => ({
  sendOfferLetterEmail: jest.fn(),
}));

jest.mock("../src/models", () => ({
  db: {
    EmployeeRecord: { create: jest.fn(), update: jest.fn() },
  },
}));

import { hrRoutes } from "../src/modules/hr/hr.routes";
import { db } from "../src/models";

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/hr", hrRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });
  return app;
}

const validBulkRow = (overrides: any = {}) => ({
  rowNumber: 1,
  account: {
    firstName: "Alice",
    lastName: "Worker",
    email: "alice@example.com",
    ...(overrides.account || {}),
  },
  profile: {
    employeeCode: "EMP-100",
    roleKeys: ["employee", "hr_manager"],
    employmentType: "full_time",
    employmentStatus: "active",
    hireDate: "2024-01-01",
    ...(overrides.profile || {}),
  },
  ...(overrides.row || {}),
});

describe("POST /api/v1/hr/records/bulk/validate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateMock.mockResolvedValue({
      summary: { total: 0, READY_TO_CREATE: 0, READY_TO_UPDATE: 0, UNCHANGED: 0, INVALID: 0, CONFLICT: 0 },
      results: [],
    });
    applyMock.mockResolvedValue({
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      failed: 0,
      conflicts: 0,
      results: [],
    });
  });

  it("requires hr.write permission", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk/validate")
      .set("Authorization", "Bearer denied")
      .send({ rows: [] });

    expect(res.status).toBe(403);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("returns validation results and writes nothing", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk/validate")
      .set("Authorization", "Bearer allowed")
      .send({ rows: [validBulkRow()] });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total).toBe(0);
    expect(validateMock).toHaveBeenCalledWith("business-a", [expect.objectContaining({ rowNumber: 1 })]);
    expect(db.EmployeeRecord.create).not.toHaveBeenCalled();
    expect(db.EmployeeRecord.update).not.toHaveBeenCalled();
  });

  it("passes bulk roleKeys through route validation for row-level normalization", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk/validate")
      .set("Authorization", "Bearer allowed")
      .send({ rows: [validBulkRow()] });

    expect(res.status).toBe(200);
    expect(validateMock).toHaveBeenCalledWith("business-a", [
      expect.objectContaining({
        profile: expect.objectContaining({ roleKeys: ["employee", "hr_manager"] }),
      }),
    ]);
  });

  it("rejects empty bulk rows at request shape validation", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk/validate")
      .set("Authorization", "Bearer allowed")
      .send({ rows: [] });

    expect(res.status).toBe(400);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("requires hr.write permission for bulk writes", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk")
      .set("Authorization", "Bearer denied")
      .send({ rows: [] });

    expect(res.status).toBe(403);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("calls the bulk write service for authorized users", async () => {
    const res = await request(testApp())
      .post("/api/v1/hr/records/bulk")
      .set("Authorization", "Bearer allowed")
      .send({ rows: [validBulkRow({ row: { action: "CREATE" } })] });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(applyMock).toHaveBeenCalledWith("business-a", [expect.objectContaining({ rowNumber: 1 })]);
  });
});
