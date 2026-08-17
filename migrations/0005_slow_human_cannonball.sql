CREATE TABLE `application_oauth_clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`client_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_oauth_clients_application_idx` ON `application_oauth_clients` (`application_id`);--> statement-breakpoint
CREATE TABLE `application_resources` (
	`application_id` text PRIMARY KEY NOT NULL,
	`resource_identifier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_identifier`) REFERENCES `oauth_resource`(`identifier`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_resources_resource_identifier_unique` ON `application_resources` (`resource_identifier`);--> statement-breakpoint
CREATE INDEX `application_resources_resource_idx` ON `application_resources` (`resource_identifier`);--> statement-breakpoint
CREATE TABLE `application_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_roles_application_key_uidx` ON `application_roles` (`application_id`,`key`);--> statement-breakpoint
CREATE INDEX `application_roles_application_idx` ON `application_roles` (`application_id`,`status`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`disabled_at` integer,
	`owner_user_principal_id` text,
	`owner_team_id` text,
	`authz_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "applications_one_owner" CHECK(("applications"."owner_user_principal_id" IS NOT NULL AND "applications"."owner_team_id" IS NULL) OR ("applications"."owner_user_principal_id" IS NULL AND "applications"."owner_team_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`);--> statement-breakpoint
CREATE INDEX `applications_owner_user_idx` ON `applications` (`owner_user_principal_id`);--> statement-breakpoint
CREATE INDEX `applications_owner_team_idx` ON `applications` (`owner_team_id`);--> statement-breakpoint
CREATE TABLE `service_account_application_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`service_account_principal_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_account_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_account_application_assignments_uidx` ON `service_account_application_assignments` (`application_id`,`service_account_principal_id`);--> statement-breakpoint
CREATE INDEX `service_account_application_assignments_service_idx` ON `service_account_application_assignments` (`service_account_principal_id`);--> statement-breakpoint
CREATE TABLE `service_account_application_role_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`service_account_principal_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_by_principal_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_account_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `application_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_account_application_role_grants_uidx` ON `service_account_application_role_grants` (`application_id`,`service_account_principal_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `service_account_application_role_grants_service_idx` ON `service_account_application_role_grants` (`service_account_principal_id`);--> statement-breakpoint
CREATE TABLE `team_application_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`team_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_application_assignments_uidx` ON `team_application_assignments` (`application_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `team_application_assignments_team_idx` ON `team_application_assignments` (`team_id`);--> statement-breakpoint
CREATE TABLE `team_application_role_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`team_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_by_principal_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `application_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_application_role_grants_uidx` ON `team_application_role_grants` (`application_id`,`team_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `team_application_role_grants_team_idx` ON `team_application_role_grants` (`team_id`);--> statement-breakpoint
CREATE TABLE `user_application_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`user_principal_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_application_assignments_uidx` ON `user_application_assignments` (`application_id`,`user_principal_id`);--> statement-breakpoint
CREATE INDEX `user_application_assignments_user_idx` ON `user_application_assignments` (`user_principal_id`);--> statement-breakpoint
CREATE TABLE `user_application_role_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`user_principal_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_by_principal_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `application_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_application_role_grants_uidx` ON `user_application_role_grants` (`application_id`,`user_principal_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `user_application_role_grants_user_idx` ON `user_application_role_grants` (`user_principal_id`);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `application_owner_user_requires_human_principal`
BEFORE INSERT ON `applications`
WHEN NEW.`owner_user_principal_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`owner_user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'application user owner requires a human principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `application_owner_user_requires_human_principal_update`
BEFORE UPDATE OF `owner_user_principal_id` ON `applications`
WHEN NEW.`owner_user_principal_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`owner_user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'application user owner requires a human principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `user_application_assignment_requires_human_principal`
BEFORE INSERT ON `user_application_assignments`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'user application assignment requires a human principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_application_assignment_requires_service_principal`
BEFORE INSERT ON `service_account_application_assignments`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`service_account_principal_id`
     AND `principals`.`type` = 'service'
)
BEGIN
  SELECT RAISE(ABORT, 'service account application assignment requires a service principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `user_application_role_grant_requires_human_principal`
BEFORE INSERT ON `user_application_role_grants`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'user application role grant requires a human principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_application_role_grant_requires_service_principal`
BEFORE INSERT ON `service_account_application_role_grants`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`service_account_principal_id`
     AND `principals`.`type` = 'service'
)
BEGIN
  SELECT RAISE(ABORT, 'service account application role grant requires a service principal');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `user_application_role_grant_requires_matching_application`
BEFORE INSERT ON `user_application_role_grants`
WHEN NOT EXISTS (
  SELECT 1
    FROM `application_roles`
   WHERE `application_roles`.`id` = NEW.`role_id`
     AND `application_roles`.`application_id` = NEW.`application_id`
)
BEGIN
  SELECT RAISE(ABORT, 'user application role grant requires a role from the same application');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_application_role_grant_requires_matching_application`
BEFORE INSERT ON `service_account_application_role_grants`
WHEN NOT EXISTS (
  SELECT 1
    FROM `application_roles`
   WHERE `application_roles`.`id` = NEW.`role_id`
     AND `application_roles`.`application_id` = NEW.`application_id`
)
BEGIN
  SELECT RAISE(ABORT, 'service application role grant requires a role from the same application');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `team_application_role_grant_requires_matching_application`
BEFORE INSERT ON `team_application_role_grants`
WHEN NOT EXISTS (
  SELECT 1
    FROM `application_roles`
   WHERE `application_roles`.`id` = NEW.`role_id`
     AND `application_roles`.`application_id` = NEW.`application_id`
)
BEGIN
  SELECT RAISE(ABORT, 'team application role grant requires a role from the same application');
END;
