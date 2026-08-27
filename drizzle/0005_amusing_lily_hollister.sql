CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receivableId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`paidAt` timestamp NOT NULL,
	`method` enum('cash','transfer','card','cheque','other') NOT NULL DEFAULT 'transfer',
	`reference` varchar(128),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`documentNumber` varchar(64) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerAddress` text,
	`issueDate` timestamp NOT NULL,
	`dueDate` timestamp NOT NULL,
	`totalAmount` decimal(14,2) NOT NULL,
	`paidAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('open','partial','paid','overdue','cancelled') NOT NULL DEFAULT 'open',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivables_id` PRIMARY KEY(`id`),
	CONSTRAINT `receivables_invoiceId_unique` UNIQUE(`invoiceId`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_receivableId_receivables_id_fk` FOREIGN KEY (`receivableId`) REFERENCES `receivables`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_invoiceId_saved_documents_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_user_paid_at_idx` ON `payments` (`userId`,`paidAt`);--> statement-breakpoint
CREATE INDEX `payments_receivable_idx` ON `payments` (`receivableId`);--> statement-breakpoint
CREATE INDEX `receivables_user_status_idx` ON `receivables` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `receivables_due_date_idx` ON `receivables` (`userId`,`dueDate`);