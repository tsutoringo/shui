CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`actor_principal_id` text,
	`subject_principal_id` text,
	`subject_user_id` text,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_events_created_idx` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_principal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bootstrap_state` (
	`id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
	`status` text NOT NULL DEFAULT 'uninitialized' CHECK (`status` IN ('uninitialized', 'reserved', 'user-created', 'completed')),
	`reservation_id` text,
	`email` text,
	`user_id` text,
	`principal_id` text,
	`reserved_at` integer,
	`user_created_at` integer,
	`completed_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	`updated_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bootstrap_state_reservation_id_unique` ON `bootstrap_state` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `human_principals` (
	`principal_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL DEFAULT 'active' CHECK (`status` IN ('active', 'disabled')),
	`disabled` integer NOT NULL DEFAULT false,
	`disabled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `human_principals_user_id_unique` ON `human_principals` (`user_id`);--> statement-breakpoint
CREATE INDEX `human_principals_user_id_idx` ON `human_principals` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`status` text NOT NULL DEFAULT 'pending' CHECK (`status` IN ('pending', 'claimed', 'completed', 'revoked', 'expired')),
	`expires_at` integer NOT NULL,
	`invited_by_principal_id` text NOT NULL,
	`claimed_user_id` text,
	`claimed_principal_id` text,
	`system_role_keys` text NOT NULL DEFAULT '[]',
	`claimed_at` integer,
	`completed_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`invited_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`claimed_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`claimed_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`,`status`);--> statement-breakpoint
CREATE INDEX `invitations_expires_idx` ON `invitations` (`expires_at`,`status`);--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending' CHECK (`status` IN ('pending', 'in-flight', 'sent', 'failed')),
	`attempts` integer NOT NULL DEFAULT 0,
	`available_at` integer NOT NULL,
	`last_error` text,
	`sent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_events_dedupe_key_unique` ON `outbox_events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `outbox_events_pending_idx` ON `outbox_events` (`status`,`available_at`);--> statement-breakpoint
CREATE TABLE `principals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL CHECK (`type` IN ('human', 'service')),
	`status` text NOT NULL DEFAULT 'active' CHECK (`status` IN ('active', 'disabled')),
	`disabled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `principals_status_idx` ON `principals` (`status`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_updated_idx` ON `rate_limit_buckets` (`updated_at`);--> statement-breakpoint
CREATE TABLE `system_role_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_by_principal_id` text,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `system_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_role_grants_principal_role_uidx` ON `system_role_grants` (`principal_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `system_role_grants_role_idx` ON `system_role_grants` (`role_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `system_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_roles_key_unique` ON `system_roles` (`key`);
--> statement-breakpoint
INSERT OR IGNORE INTO `bootstrap_state` (`id`, `status`) VALUES (1, 'uninitialized');
--> statement-breakpoint
INSERT OR IGNORE INTO `principals` (`id`, `type`, `status`, `disabled_at`, `created_at`, `updated_at`)
SELECT 'human_' || `id`, 'human', 'active', NULL, `created_at`, `updated_at`
  FROM `user`;
--> statement-breakpoint
INSERT OR IGNORE INTO `human_principals`
  (`principal_id`, `user_id`, `status`, `disabled`, `disabled_at`, `created_at`, `updated_at`)
SELECT 'human_' || `id`, `id`, 'active', 0, NULL, `created_at`, `updated_at`
  FROM `user`;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `session_requires_active_human_principal`
BEFORE INSERT ON `session`
WHEN NOT EXISTS (
  SELECT 1
    FROM `human_principals` AS hp
    JOIN `principals` AS p ON p.id = hp.principal_id
   WHERE hp.user_id = NEW.user_id
     AND hp.status = 'active'
     AND hp.disabled = 0
     AND p.type = 'human'
     AND p.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'active human principal required');
END;
--> statement-breakpoint
INSERT OR IGNORE INTO `system_roles` (`id`, `key`, `name`, `description`, `created_at`) VALUES
	('root', 'root', 'root', 'Full control of Shui and recovery-critical operations', cast(unixepoch('subsecond') * 1000 as integer)),
	('user-admin', 'user-admin', 'user-admin', 'Manage users, invitations, teams, and memberships', cast(unixepoch('subsecond') * 1000 as integer)),
	('application-admin', 'application-admin', 'application-admin', 'Manage applications, assignments, roles, clients, and provisioning', cast(unixepoch('subsecond') * 1000 as integer));
