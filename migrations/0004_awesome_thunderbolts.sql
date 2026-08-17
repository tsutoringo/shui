CREATE TABLE `service_accounts` (
	`principal_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_principal_id` text,
	`owner_team_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "service_accounts_one_owner" CHECK(("service_accounts"."owner_user_principal_id" IS NOT NULL AND "service_accounts"."owner_team_id" IS NULL) OR ("service_accounts"."owner_user_principal_id" IS NULL AND "service_accounts"."owner_team_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `service_accounts_owner_user_idx` ON `service_accounts` (`owner_user_principal_id`);--> statement-breakpoint
CREATE INDEX `service_accounts_owner_team_idx` ON `service_accounts` (`owner_team_id`);--> statement-breakpoint
CREATE TABLE `team_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_principal_id` text NOT NULL,
	`added_by_principal_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_memberships_team_user_uidx` ON `team_memberships` (`team_id`,`user_principal_id`);--> statement-breakpoint
CREATE INDEX `team_memberships_user_idx` ON `team_memberships` (`user_principal_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL CHECK (`status` IN ('active', 'disabled')),
	`disabled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `teams_status_idx` ON `teams` (`status`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `team_membership_requires_human_principal`
BEFORE INSERT ON `team_memberships`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'team membership requires a human principal');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_account_requires_service_principal`
BEFORE INSERT ON `service_accounts`
WHEN NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`principal_id`
     AND `principals`.`type` = 'service'
)
BEGIN
  SELECT RAISE(ABORT, 'service account requires a service principal');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_account_user_owner_requires_human_principal`
BEFORE INSERT ON `service_accounts`
WHEN NEW.`owner_user_principal_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`owner_user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'service account user owner requires a human principal');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `service_account_user_owner_requires_human_principal_update`
BEFORE UPDATE OF `owner_user_principal_id` ON `service_accounts`
WHEN NEW.`owner_user_principal_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1
    FROM `principals`
   WHERE `principals`.`id` = NEW.`owner_user_principal_id`
     AND `principals`.`type` = 'human'
)
BEGIN
  SELECT RAISE(ABORT, 'service account user owner requires a human principal');
END;
