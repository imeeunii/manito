CREATE TABLE `classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`student_count` integer NOT NULL,
	`excluded_numbers` text DEFAULT '[]' NOT NULL,
	`assignments` text NOT NULL,
	`custom_missions` text DEFAULT '{}' NOT NULL,
	`teacher_pin_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_code_unique` ON `classes` (`code`);
--> statement-breakpoint
CREATE TABLE `student_entries` (
	`class_id` integer NOT NULL,
	`student_number` integer NOT NULL,
	`viewed_at` text,
	`letter` text DEFAULT '' NOT NULL,
	`strength_one` text DEFAULT '' NOT NULL,
	`strength_two` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`class_id`, `student_number`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
