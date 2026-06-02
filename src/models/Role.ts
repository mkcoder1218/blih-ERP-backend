import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type RoleModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

type RoleDomainValue = string | string[];

// Maps each system role key to the domain(s) it owns.
// A user with one of these roles can only manage roles in their domain(s).
export const ROLE_DOMAIN_MAP: Record<string, RoleDomainValue> = {
  HR_MANAGER: ["hr", "finance", "it", "project"],
  FINANCE_MANAGER: "finance",
  IT_MANAGER: "it",
  SALES_MANAGER: "sales",
  PROJECT_MANAGER: "project",
  BUSINESS_ADMIN: "*", // can manage all domains
  PLATFORM_SUPER_ADMIN: "*",
};

export function roleDomainsForKey(key: string): string[] {
  const value = ROLE_DOMAIN_MAP[key];
  if (!value || value === "*") return [];
  return Array.isArray(value) ? value : [value];
}

export function roleHasAllDomains(key: string): boolean {
  return ROLE_DOMAIN_MAP[key] === "*";
}

export function roleDomainForKey(key: string): string | null {
  return roleDomainsForKey(key)[0] || null;
}

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): RoleModel => {
  const Role = sequelize.define(
    "Role",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: { type: dataTypes.UUID, allowNull: true },
      name: { type: dataTypes.STRING(120), allowNull: false },
      key: { type: dataTypes.STRING(120), allowNull: false },
      description: { type: dataTypes.STRING(255), allowNull: true },
      isSystemRole: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // domain groups roles so managers can only manage roles in their domain
      // e.g. "hr", "finance", "it", "sales", "project", or null (unrestricted)
      domain: {
        type: dataTypes.STRING(60),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: "roles",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["businessId", "key"] }],
    },
  ) as RoleModel;

  Role.associate = (models: any) => {
    models.Role.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: "roleId",
    });
    models.Role.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: "roleId",
    });
  };

  return Role;
};
