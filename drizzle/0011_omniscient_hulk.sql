ALTER TABLE `receivable_reminders` ADD `invoiceId` int;--> statement-breakpoint
UPDATE `receivable_reminders` AS `reminder` INNER JOIN `receivables` AS `receivable` ON `receivable`.`id` = `reminder`.`receivableId` AND `receivable`.`userId` = `reminder`.`userId` SET `reminder`.`invoiceId` = `receivable`.`invoiceId` WHERE `reminder`.`invoiceId` IS NULL;--> statement-breakpoint
ALTER TABLE `receivable_reminders` MODIFY `invoiceId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `receivable_reminders` ADD CONSTRAINT `receivable_reminders_invoiceId_saved_documents_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;
