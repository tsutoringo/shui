import { t } from "elysia";

export const emailSchema = t.String({ format: "email", maxLength: 320, minLength: 3 });
export const tokenSchema = t.String({ maxLength: 1024, minLength: 1 });
export const idSchema = t.String({ maxLength: 256, minLength: 1 });
export const ownerTypeSchema = t.Union([t.Literal("user"), t.Literal("team")]);
export const resourceIdentifierSchema = t.String({ format: "uri", maxLength: 2048, minLength: 1 });
export const principalStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("disabled"),
  t.Literal("unmanaged"),
]);

export const CommonModels = {
  Error: t.Object({ error: t.String() }),
  IdentifierParams: t.Object({ id: idSchema }),
  Owner: t.Object({ id: idSchema, label: t.String(), type: ownerTypeSchema }),
  OwnerCandidate: t.Object({ id: idSchema, name: t.String() }),
  OwnershipBody: t.Object({ ownerId: idSchema, ownerType: ownerTypeSchema }),
} as const;

export type Owner = typeof CommonModels.Owner.static;
export type OwnerCandidate = typeof CommonModels.OwnerCandidate.static;
export type OwnershipBody = typeof CommonModels.OwnershipBody.static;
