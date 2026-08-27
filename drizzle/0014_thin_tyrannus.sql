CREATE TABLE `document_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`ownerId` int NOT NULL,
	`actorId` int,
	`revisionNumber` int NOT NULL,
	`summary` varchar(500) NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_revisions_document_revision_unique` UNIQUE(`documentId`,`revisionNumber`)
);
--> statement-breakpoint
ALTER TABLE `document_revisions` ADD CONSTRAINT `document_revisions_documentId_saved_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `saved_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_revisions` ADD CONSTRAINT `document_revisions_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_revisions` ADD CONSTRAINT `document_revisions_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_revisions_owner_document_created_idx` ON `document_revisions` (`ownerId`,`documentId`,`createdAt`);