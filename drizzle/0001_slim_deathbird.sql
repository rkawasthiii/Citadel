CREATE TABLE "niche_follows" (
	"user_id" uuid NOT NULL,
	"niche_id" uuid NOT NULL,
	"followed_at" timestamp DEFAULT now() NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"source" text,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp,
	CONSTRAINT "niche_follows_user_id_niche_id_pk" PRIMARY KEY("user_id","niche_id")
);
--> statement-breakpoint
CREATE TABLE "niches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"avatar_color" text DEFAULT '#6366F1' NOT NULL,
	"avatar_initials" text NOT NULL,
	"thumbnail_url" text,
	"category_type" text DEFAULT 'field' NOT NULL,
	"parent_niche_id" uuid,
	"metadata" jsonb,
	"stats" jsonb DEFAULT '{"totalPapers":0,"totalFollowers":0,"weeklyGrowth":0,"monthlyGrowth":0}'::jsonb,
	"popularity_score" integer DEFAULT 0 NOT NULL,
	"trending_score" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "niches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"story_type" text DEFAULT 'trending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"custom_thumbnail" text,
	"custom_title" text,
	"stats" jsonb DEFAULT '{"views":0,"clicks":0,"swipes":0}'::jsonb,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"niche_id" uuid,
	"interaction_type" text NOT NULL,
	"duration" integer,
	"scroll_depth" integer,
	"context" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_niche_weights" (
	"user_id" uuid NOT NULL,
	"niche_id" uuid NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"view_time_score" integer DEFAULT 0 NOT NULL,
	"interaction_score" integer DEFAULT 0 NOT NULL,
	"recency_score" integer DEFAULT 0 NOT NULL,
	"combined_weight" integer DEFAULT 0 NOT NULL,
	"total_views" integer DEFAULT 0 NOT NULL,
	"total_likes" integer DEFAULT 0 NOT NULL,
	"total_comments" integer DEFAULT 0 NOT NULL,
	"total_shares" integer DEFAULT 0 NOT NULL,
	"total_bookmarks" integer DEFAULT 0 NOT NULL,
	"total_time_spent" integer DEFAULT 0 NOT NULL,
	"total_hides" integer DEFAULT 0 NOT NULL,
	"total_scroll_pasts" integer DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_niche_weights_user_id_niche_id_pk" PRIMARY KEY("user_id","niche_id")
);
--> statement-breakpoint
CREATE TABLE "user_story_views" (
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"view_duration" integer,
	"clicked_through" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_story_views_user_id_story_id_pk" PRIMARY KEY("user_id","story_id")
);
--> statement-breakpoint
ALTER TABLE "feed_items" ALTER COLUMN "citation_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ALTER COLUMN "influential_citation_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ALTER COLUMN "is_open_access" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "replies_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "niche_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "authors_list" jsonb;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "impact_factor" integer;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "published_to_feed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "quality_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "relevance_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "trending_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "comments_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "bookmarks_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "shares_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "views_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_jobs" ADD COLUMN "params" jsonb;--> statement-breakpoint
ALTER TABLE "feed_jobs" ADD COLUMN "new_papers_count" integer;--> statement-breakpoint
ALTER TABLE "feed_jobs" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "feed_jobs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_jobs" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_type" text DEFAULT 'researcher' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "following_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "follower_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "papers_liked_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "papers_bookmarked_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "comments_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "settings" jsonb DEFAULT '{"emailNotifications":true,"pushNotifications":true,"theme":"auto","language":"en"}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "niche_follows" ADD CONSTRAINT "niche_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_follows" ADD CONSTRAINT "niche_follows_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niches" ADD CONSTRAINT "niches_parent_niche_id_niches_id_fk" FOREIGN KEY ("parent_niche_id") REFERENCES "public"."niches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_niche_weights" ADD CONSTRAINT "user_niche_weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_niche_weights" ADD CONSTRAINT "user_niche_weights_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_story_views" ADD CONSTRAINT "user_story_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_story_views" ADD CONSTRAINT "user_story_views_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "niche_follows_user_idx" ON "niche_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "niche_follows_niche_idx" ON "niche_follows" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "niche_follows_followed_at_idx" ON "niche_follows" USING btree ("followed_at");--> statement-breakpoint
CREATE INDEX "niche_follows_user_interaction_idx" ON "niche_follows" USING btree ("user_id","interaction_count");--> statement-breakpoint
CREATE INDEX "niches_slug_idx" ON "niches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "niches_category_idx" ON "niches" USING btree ("category_type");--> statement-breakpoint
CREATE INDEX "niches_popularity_idx" ON "niches" USING btree ("popularity_score");--> statement-breakpoint
CREATE INDEX "niches_trending_idx" ON "niches" USING btree ("trending_score");--> statement-breakpoint
CREATE INDEX "niches_active_idx" ON "niches" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "niches_featured_idx" ON "niches" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "niches_parent_idx" ON "niches" USING btree ("parent_niche_id");--> statement-breakpoint
CREATE INDEX "stories_niche_idx" ON "stories" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "stories_feed_item_idx" ON "stories" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "stories_active_idx" ON "stories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "stories_expires_idx" ON "stories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stories_niche_active_expires_idx" ON "stories" USING btree ("niche_id","is_active","expires_at");--> statement-breakpoint
CREATE INDEX "user_interactions_user_idx" ON "user_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_interactions_feed_item_idx" ON "user_interactions" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "user_interactions_niche_idx" ON "user_interactions" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "user_interactions_type_idx" ON "user_interactions" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "user_interactions_created_idx" ON "user_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_interactions_user_created_idx" ON "user_interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_interactions_niche_created_idx" ON "user_interactions" USING btree ("niche_id","created_at");--> statement-breakpoint
CREATE INDEX "user_interactions_user_type_idx" ON "user_interactions" USING btree ("user_id","interaction_type");--> statement-breakpoint
CREATE INDEX "user_niche_weights_user_weight_idx" ON "user_niche_weights" USING btree ("user_id","combined_weight");--> statement-breakpoint
CREATE INDEX "user_niche_weights_niche_weight_idx" ON "user_niche_weights" USING btree ("niche_id","combined_weight");--> statement-breakpoint
CREATE INDEX "user_niche_weights_user_updated_idx" ON "user_niche_weights" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_story_views_user_idx" ON "user_story_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_story_views_story_idx" ON "user_story_views" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "user_story_views_viewed_idx" ON "user_story_views" USING btree ("viewed_at");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_feed_item_idx" ON "bookmarks" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "bookmarks_created_idx" ON "bookmarks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookmarks_collection_idx" ON "bookmarks" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_feed_item_idx" ON "comments" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_created_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "comments_feed_item_parent_idx" ON "comments" USING btree ("feed_item_id","parent_comment_id");--> statement-breakpoint
CREATE INDEX "feed_items_niche_idx" ON "feed_items" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "feed_items_paper_id_idx" ON "feed_items" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "feed_items_published_idx" ON "feed_items" USING btree ("published_to_feed_at");--> statement-breakpoint
CREATE INDEX "feed_items_quality_idx" ON "feed_items" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "feed_items_trending_idx" ON "feed_items" USING btree ("trending_score");--> statement-breakpoint
CREATE INDEX "feed_items_active_idx" ON "feed_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "feed_items_year_idx" ON "feed_items" USING btree ("year");--> statement-breakpoint
CREATE INDEX "feed_items_niche_published_idx" ON "feed_items" USING btree ("niche_id","published_to_feed_at");--> statement-breakpoint
CREATE INDEX "feed_items_niche_trending_idx" ON "feed_items" USING btree ("niche_id","trending_score");--> statement-breakpoint
CREATE INDEX "feed_jobs_user_idx" ON "feed_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_jobs_status_idx" ON "feed_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feed_jobs_created_idx" ON "feed_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feed_jobs_user_status_idx" ON "feed_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "likes_user_idx" ON "likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "likes_feed_item_idx" ON "likes" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "likes_created_idx" ON "likes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_last_active_idx" ON "users" USING btree ("last_active_at");--> statement-breakpoint
ALTER TABLE "feed_jobs" DROP COLUMN "phrases";--> statement-breakpoint
ALTER TABLE "feed_jobs" DROP COLUMN "query";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "fields_of_study";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");