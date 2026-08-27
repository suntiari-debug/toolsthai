CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerType` enum('company','person') NOT NULL DEFAULT 'company',
	`name` varchar(255) NOT NULL,
	`taxId` varchar(32),
	`address` text,
	`contactName` varchar(255),
	`phone` varchar(64),
	`email` varchar(320),
	`note` text,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `receivables` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `saved_documents` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customers_user_archived_name_idx` ON `customers` (`userId`,`archivedAt`,`name`);--> statement-breakpoint
CREATE INDEX `customers_user_tax_id_idx` ON `customers` (`userId`,`taxId`);--> statement-breakpoint
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_documents` ADD CONSTRAINT `saved_documents_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `receivables_user_customer_idx` ON `receivables` (`userId`,`customerId`);--> statement-breakpoint
CREATE INDEX `saved_documents_user_customer_idx` ON `saved_documents` (`userId`,`customerId`);