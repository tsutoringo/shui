CREATE TABLE `service_account_oauth_clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`service_account_principal_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_account_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_account_oauth_clients_application_idx` ON `service_account_oauth_clients` (`application_id`);--> statement-breakpoint
CREATE INDEX `service_account_oauth_clients_service_idx` ON `service_account_oauth_clients` (`service_account_principal_id`);