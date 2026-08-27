ALTER TABLE `receivable_events` MODIFY COLUMN `type` enum('created','payment-recorded','payment-voided','payment-replaced') NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `payments` ADD `voidReason` varchar(255);--> statement-breakpoint
ALTER TABLE `receivable_events` ADD `paymentId` int;--> statement-breakpoint
ALTER TABLE `receivable_events` ADD CONSTRAINT `receivable_events_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE set null ON UPDATE no action;