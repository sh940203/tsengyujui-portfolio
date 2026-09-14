CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `awards` (
	`id` text PRIMARY KEY NOT NULL,
	`year` text NOT NULL,
	`title_en` text NOT NULL,
	`title_zh` text,
	`result_en` text,
	`result_zh` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title_en` text NOT NULL,
	`title_zh` text,
	`year` text,
	`category` text,
	`piece_count` integer,
	`statement_en` text,
	`statement_zh` text,
	`theme` text DEFAULT 'dark' NOT NULL,
	`accent_note` text,
	`cover_image_id` text,
	`og_image_id` text,
	`title_image_id` text,
	`visibility` text DEFAULT 'draft' NOT NULL,
	`requires_consent` integer DEFAULT false NOT NULL,
	`consent_note_en` text,
	`consent_note_zh` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cover_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`og_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`title_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`width` integer,
	`height` integer,
	`file_size` integer,
	`rotation` integer DEFAULT 0 NOT NULL,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`alt_en` text,
	`alt_zh` text,
	`caption` text,
	`collection_id` text,
	`kind` text DEFAULT 'misc' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`name_en` text,
	`name_zh` text,
	`role_en` text,
	`role_zh` text,
	`location_en` text,
	`location_zh` text,
	`bio_en` text,
	`bio_zh` text,
	`email` text,
	`instagram` text,
	`behance` text,
	`hero_image_id` text,
	`about_image_id` text,
	`seo_title` text,
	`seo_description` text,
	`default_og_image_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`hero_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`about_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_og_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
