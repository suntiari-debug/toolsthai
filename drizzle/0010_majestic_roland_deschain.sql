CREATE TABLE `receivable_reminder_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`daysBeforeDue` varchar(32) NOT NULL DEFAULT '1,3,7',
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Bangkok',
	`scheduleCronTaskUid` varchar(65),
	`lastEvaluatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivable_reminder_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `receivable_reminder_settings_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `receivable_reminder_settings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `receivable_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receivableId` int NOT NULL,
	`reminderType` enum('due-soon','overdue') NOT NULL,
	`dueDate` timestamp NOT NULL,
	`dueDateBasis` varchar(10) NOT NULL,
	`evaluationDate` varchar(10) NOT NULL,
	`outstandingAmount` decimal(14,2) NOT NULL,
	`documentNumber` varchar(64) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`status` enum('unread','read') NOT NULL DEFAULT 'unread',
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receivable_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_user_receivable_type_day_unique` UNIQUE(`userId`,`receivableId`,`reminderType`,`evaluationDate`)
);
--> statement-breakpoint
ALTER TABLE `receivable_reminder_settings` ADD CONSTRAINT `receivable_reminder_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivable_reminders` ADD CONSTRAINT `receivable_reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivable_reminders` ADD CONSTRAINT `receivable_reminders_receivableId_receivables_id_fk` FOREIGN KEY (`receivableId`) REFERENCES `receivables`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `reminder_user_status_created_idx` ON `receivable_reminders` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reminder_user_type_created_idx` ON `receivable_reminders` (`userId`,`reminderType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reminder_user_receivable_idx` ON `receivable_reminders` (`userId`,`receivableId`);