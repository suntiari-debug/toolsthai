CREATE TABLE `receivable_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receivableId` int NOT NULL,
	`type` enum('created','payment-recorded') NOT NULL,
	`amount` decimal(14,2),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receivable_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `receivable_events` ADD CONSTRAINT `receivable_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivable_events` ADD CONSTRAINT `receivable_events_receivableId_receivables_id_fk` FOREIGN KEY (`receivableId`) REFERENCES `receivables`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `receivable_events_user_receivable_created_idx` ON `receivable_events` (`userId`,`receivableId`,`createdAt`);