ALTER TABLE `saved_documents` ADD `status` enum('draft','sent','paid','overdue') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_documents` ADD `archivedAt` timestamp;