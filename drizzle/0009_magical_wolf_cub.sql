CREATE TABLE `receipt_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receivableId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`receiptDocumentId` int NOT NULL,
	`activePaymentIds` text NOT NULL,
	`paymentTotalAtCreation` decimal(14,2) NOT NULL,
	`createdFrom` varchar(32) NOT NULL DEFAULT 'receivable-paid',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipt_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_sources_receivable_unique` UNIQUE(`receivableId`),
	CONSTRAINT `receipt_sources_receipt_document_unique` UNIQUE(`receiptDocumentId`)
);
--> statement-breakpoint
ALTER TABLE `receivable_events` MODIFY COLUMN `type` enum('created','payment-recorded','payment-voided','payment-replaced','receipt-draft-created') NOT NULL;--> statement-breakpoint
ALTER TABLE `receipt_sources` ADD CONSTRAINT `receipt_sources_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_sources` ADD CONSTRAINT `receipt_sources_receivableId_receivables_id_fk` FOREIGN KEY (`receivableId`) REFERENCES `receivables`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_sources` ADD CONSTRAINT `receipt_sources_invoiceId_saved_documents_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_sources` ADD CONSTRAINT `receipt_sources_receiptDocumentId_saved_documents_id_fk` FOREIGN KEY (`receiptDocumentId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `receipt_sources_user_receivable_idx` ON `receipt_sources` (`userId`,`receivableId`);