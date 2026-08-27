CREATE TABLE `document_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `saved_documents` ADD `status` enum('draft','sent','paid','overdue') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_documents` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_exports` ADD CONSTRAINT `document_exports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_exports` ADD CONSTRAINT `document_exports_documentId_saved_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_exports_user_document_created_idx` ON `document_exports` (`userId`,`documentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `saved_documents_user_status_updated_idx` ON `saved_documents` (`userId`,`status`,`updatedAt`);