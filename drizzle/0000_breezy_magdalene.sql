CREATE TABLE `wordle_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_name` text NOT NULL,
	`game_number` integer NOT NULL,
	`attempts` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
