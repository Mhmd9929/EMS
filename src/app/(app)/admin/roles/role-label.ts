import { DEFAULT_ROLES, type SystemRoleKey } from "@/server/rbac/catalogue";

type RoleT = (key: `systemRoles.${SystemRoleKey}.${"name" | "description"}`) => string;

const isSystemKey = (key: string): key is SystemRoleKey => Object.prototype.hasOwnProperty.call(DEFAULT_ROLES, key);

/**
 * Display name and description of a role. Built-in roles that still carry their default English name or
 * description are shown translated (pass `useTranslations("admin")` / `getTranslations("admin")`); renamed
 * and custom roles are data and shown as stored.
 */
export function roleLabel(t: RoleT, role: { key: string; name: string; description?: string | null }) {
  const def = isSystemKey(role.key) ? DEFAULT_ROLES[role.key] : undefined;
  const key = role.key as SystemRoleKey;
  return {
    name: def && role.name === def.name ? t(`systemRoles.${key}.name`) : role.name,
    description: def && role.description === def.description ? t(`systemRoles.${key}.description`) : (role.description ?? null),
  };
}
