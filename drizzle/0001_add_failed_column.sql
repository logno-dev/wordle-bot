PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_wordle_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_name` text NOT NULL,
	`game_number` integer NOT NULL,
	`attempts` integer,
	`failed` integer DEFAULT false NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
INSERT INTO `__new_wordle_scores`("id", "sender_name", "game_number", "attempts", "failed", "date", "created_at") 
SELECT "id", "sender_name", "game_number", "attempts", false, "date", "created_at" FROM `wordle_scores`;
--> statement-breakpoint
DROP TABLE `wordle_scores`;
--> statement-breakpoint
ALTER TABLE `__new_wordle_scores` RENAME TO `wordle_scores`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;