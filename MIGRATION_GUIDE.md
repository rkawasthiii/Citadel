# Database Migration Guide

## Overview

This guide covers the migration from the old schema to the new optimized schema for Veritus social platform.

## What's Changing?

### New Tables:
1. **niches** - Research topics/fields (extracted from fieldsOfStudy)
2. **niche_follows** - User follows niches instead of having preferences
3. **user_interactions** - Event stream for all user activities
4. **user_niche_weights** - Precomputed affinity scores
5. **stories** - Trending papers for stories feature
6. **user_story_views** - Story viewing analytics

### Modified Tables:
1. **users** - Added counts, onboarding data, settings
2. **feed_items** - Added nicheId, scores, denormalized counts
3. **comments** - Added threading support, moderation flags
4. **feed_jobs** - Enhanced with error handling

### Deprecated Tables:
1. **user_preferences** - Will be migrated to niche_follows

---

## Migration Steps

### Step 1: Backup Current Database

```bash
# Export current data
npm run db:push  # Ensure schema is up to date
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Step 2: Run Migration Script

```bash
# Generate migration files
npm run db:generate

# Review migration files in drizzle/ folder

# Apply migration
npm run db:push
```

### Step 3: Data Migration

Run the data migration script to populate new tables:

```bash
npx tsx scripts/migrate-data.ts
```

This script will:
1. Extract unique fieldsOfStudy → Create niches
2. Map feed_items to niches
3. Convert user_preferences to niche_follows
4. Initialize user_niche_weights

### Step 4: Verify Migration

```bash
npx tsx scripts/verify-migration.ts
```

Checks:
- All feed items have nicheId
- All users have niche follows
- Counts are correct

### Step 5: Update Application Code

1. Replace old schema imports with new schema
2. Update API routes to use new tables
3. Test all features

### Step 6: Monitor & Rollback Plan

- Monitor for 1 week
- Keep backup for 2 weeks
- Rollback script available if needed

---

## Migration Script

Create `scripts/migrate-data.ts`:

```typescript
import { db } from '@/lib/db';
import { niches, feedItems, nicheFollows, users, userPreferences } from '@/lib/db/schema.new';
import { eq, sql } from 'drizzle-orm';

async function migrateData() {
  console.log('Starting data migration...');

  // Step 1: Create niches from unique fieldsOfStudy
  console.log('Creating niches...');
  
  const fieldsResult = await db.execute(sql`
    SELECT DISTINCT unnest(fields_of_study) as field
    FROM feed_items
    WHERE fields_of_study IS NOT NULL
  `);

  const uniqueFields = fieldsResult.rows.map((r: any) => r.field);
  
  for (const field of uniqueFields) {
    const slug = field.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const initials = field
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    // Generate random color
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    await db.insert(niches)
      .values({
        slug,
        name: field,
        displayName: field.split(' ').map(w => w.slice(0, 10)).join(' '),
        avatarInitials: initials,
        avatarColor: color,
        categoryType: 'field',
        metadata: {
          fieldsOfStudy: [field],
        },
      })
      .onConflictDoNothing();
  }

  console.log(`Created ${uniqueFields.length} niches`);

  // Step 2: Link feed_items to niches (use primary field of study)
  console.log('Linking papers to niches...');
  
  const allNiches = await db.select().from(niches);
  const nicheMap = new Map(allNiches.map(n => [n.name, n.id]));
  
  const papers = await db.select().from(feedItems);
  
  for (const paper of papers) {
    if (paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0) {
      const primaryField = paper.fieldsOfStudy[0];
      const nicheId = nicheMap.get(primaryField);
      
      if (nicheId) {
        await db.update(feedItems)
          .set({ nicheId })
          .where(eq(feedItems.id, paper.id));
      }
    }
  }

  console.log(`Linked ${papers.length} papers to niches`);

  // Step 3: Migrate user_preferences to niche_follows
  console.log('Migrating user preferences...');
  
  const preferences = await db.select().from(userPreferences);
  
  for (const pref of preferences) {
    if (pref.fieldsOfStudy && pref.fieldsOfStudy.length > 0) {
      for (const field of pref.fieldsOfStudy) {
        const nicheId = nicheMap.get(field);
        
        if (nicheId) {
          await db.insert(nicheFollows)
            .values({
              userId: pref.userId,
              nicheId,
              followedAt: new Date(),
              notificationsEnabled: true,
              source: 'migration',
            })
            .onConflictDoNothing();
        }
      }
    }
  }

  console.log(`Migrated preferences for ${preferences.length} users`);

  // Step 4: Initialize user_niche_weights
  console.log('Initializing user-niche weights...');
  
  const follows = await db.select().from(nicheFollows);
  
  for (const follow of follows) {
    await db.insert(userNicheWeights)
      .values({
        userId: follow.userId,
        nicheId: follow.nicheId,
        combinedWeight: 60, // Default mid-level interest
        engagementScore: 50,
        viewTimeScore: 50,
        interactionScore: 50,
        recencyScore: 100,
      })
      .onConflictDoNothing();
  }

  console.log(`Initialized weights for ${follows.length} follows`);

  // Step 5: Update user counts
  console.log('Updating user counts...');
  
  await db.execute(sql`
    UPDATE users u
    SET following_count = (
      SELECT COUNT(*)
      FROM niche_follows nf
      WHERE nf.user_id = u.id
    )
  `);

  console.log('Migration completed successfully!');
}

// Run migration
migrateData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

---

## Rollback Plan

If issues occur:

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD.sql

# Or run rollback script
npx tsx scripts/rollback-migration.ts
```

---

## Post-Migration Checklist

- [ ] All feed items have nicheId
- [ ] All users have at least one niche follow
- [ ] Counts are accurate (likes, bookmarks, comments)
- [ ] API endpoints work with new schema
- [ ] Feed generation works
- [ ] Gorse integration works
- [ ] Performance is acceptable
- [ ] No errors in production logs

---

## Timeline

- **Day 1**: Backup, run migration, verify
- **Day 2-7**: Monitor closely, fix issues
- **Week 2-4**: Full production monitoring
- **After 4 weeks**: Remove legacy tables

---

## Support

If you encounter issues:
1. Check migration logs
2. Verify data integrity
3. Check Drizzle Studio for data
4. Rollback if critical issues

---

**Last Updated:** December 7, 2025
