CREATE TABLE `payment_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`paymentId` int NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` enum('image/png','image/jpeg','image/webp','application/pdf') NOT NULL,
	`sizeBytes` int NOT NULL,
	`caption` varchar(500),
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attachments_storage_key_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `receivable_events` MODIFY COLUMN `type` enum('created','payment-recorded','payment-voided','payment-replaced','receipt-draft-created','payment-attachment-added','payment-attachment-removed') NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_attachments` ADD CONSTRAINT `payment_attachments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attachments` ADD CONSTRAINT `payment_attachments_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payment_attachments_user_payment_deleted_created_idx` ON `payment_attachments` (`userId`,`paymentId`,`deletedAt`,`createdAt`);