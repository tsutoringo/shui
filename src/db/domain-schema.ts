import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

import { user } from "./auth-schema";

export const principals = sqliteTable(
  "principals",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["human", "service"] }).notNull(),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    disabledAt: integer("disabled_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("principals_status_idx").on(table.status)],
);

export const humanPrincipals = sqliteTable(
  "human_principals",
  {
    principalId: text("principal_id")
      .primaryKey()
      .references(() => principals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    disabled: integer("disabled", { mode: "boolean" }).notNull(),
    disabledAt: integer("disabled_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("human_principals_user_id_idx").on(table.userId)],
);

export const systemRoles = sqliteTable("system_roles", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const systemRoleGrants = sqliteTable(
  "system_role_grants",
  {
    id: text("id").primaryKey(),
    principalId: text("principal_id")
      .notNull()
      .references(() => principals.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => systemRoles.id, { onDelete: "cascade" }),
    grantedByPrincipalId: text("granted_by_principal_id").references(() => principals.id, {
      onDelete: "set null",
    }),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("system_role_grants_principal_role_uidx").on(table.principalId, table.roleId),
    index("system_role_grants_role_idx").on(table.roleId, table.revokedAt),
  ],
);

export const bootstrapState = sqliteTable("bootstrap_state", {
  id: integer("id").primaryKey(),
  status: text("status", {
    enum: ["uninitialized", "reserved", "user-created", "completed"],
  }).notNull(),
  reservationId: text("reservation_id").unique(),
  email: text("email"),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  principalId: text("principal_id").references(() => principals.id, { onDelete: "set null" }),
  reservedAt: integer("reserved_at"),
  userCreatedAt: integer("user_created_at"),
  completedAt: integer("completed_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    name: text("name"),
    status: text("status", {
      enum: ["pending", "claimed", "completed", "revoked", "expired"],
    }).notNull(),
    expiresAt: integer("expires_at").notNull(),
    invitedByPrincipalId: text("invited_by_principal_id")
      .notNull()
      .references(() => principals.id, { onDelete: "restrict" }),
    claimedUserId: text("claimed_user_id").references(() => user.id, { onDelete: "set null" }),
    claimedPrincipalId: text("claimed_principal_id").references(() => principals.id, {
      onDelete: "set null",
    }),
    systemRoleKeys: text("system_role_keys").notNull(),
    claimedAt: integer("claimed_at"),
    completedAt: integer("completed_at"),
    revokedAt: integer("revoked_at"),
    expiredAt: integer("expired_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("invitations_email_idx").on(table.email, table.status),
    index("invitations_expires_idx").on(table.expiresAt, table.status),
    uniqueIndex("invitations_active_email_unique")
      .on(table.email)
      .where(sql`${table.status} IN ('pending', 'claimed')`),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    actorPrincipalId: text("actor_principal_id").references(() => principals.id, {
      onDelete: "set null",
    }),
    subjectPrincipalId: text("subject_principal_id").references(() => principals.id, {
      onDelete: "set null",
    }),
    subjectUserId: text("subject_user_id").references(() => user.id, { onDelete: "set null" }),
    metadata: text("metadata").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("audit_events_created_idx").on(table.createdAt),
    index("audit_events_actor_idx").on(table.actorPrincipalId, table.createdAt),
  ],
);

export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: text("payload").notNull(),
    status: text("status", { enum: ["pending", "in-flight", "sent", "failed"] }).notNull(),
    attempts: integer("attempts").notNull(),
    availableAt: integer("available_at").notNull(),
    lastError: text("last_error"),
    sentAt: integer("sent_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("outbox_events_pending_idx").on(table.status, table.availableAt)],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    bucketKey: text("bucket_key").primaryKey(),
    windowStartedAt: integer("window_started_at").notNull(),
    count: integer("count").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("rate_limit_buckets_updated_idx").on(table.updatedAt)],
);
