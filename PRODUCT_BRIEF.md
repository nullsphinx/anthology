# Anthology Product Brief

**Status:** Draft v0.1  
**Date:** September 12, 2026  
**Working name:** Anthology  
**Initial scope:** Movies and television  

## 1. Product Summary

Anthology is a private, social media-tracking application where people can record what they want to watch, what they are currently watching, what they finished, and what they stopped before finishing. They can rate titles, preserve a chronological viewing history, compare their libraries with friends, and see personal and group statistics.

The longer-term product expands the same interaction model to books and music. It becomes a unified record of a person's cultural life rather than four unrelated copies of a watchlist, reading list, and listening history.

The product will not create or maintain a comprehensive entertainment catalog. It will own user activity, ratings, relationships, privacy, and derived insights while obtaining replaceable catalog metadata from external providers.

## 2. Product Thesis

Existing services are generally strongest within a single medium. Anthology's opportunity is the combination of four related jobs:

1. **Remember:** Maintain an accurate history, including unfinished and repeated consumption.
2. **Decide:** Find something a person or friend group genuinely wants to consume next.
3. **Compare:** Understand taste overlap without reducing taste to a public popularity contest.
4. **Reflect:** Turn activity into useful personal and group recaps throughout the year.

The initial wedge is not “another IMDb.” It is a better personal viewing ledger and a friend-group decision tool.

## 3. Initial Audience and Operating Assumptions

The first release is designed for the owner and a small number of invited friends.

Default assumptions:

- Accounts are invite-only.
- Profiles and activity are not publicly indexed.
- The prototype is non-commercial.
- Movies and television are the only active media types.
- Books and music influence the architecture but do not appear as empty or disabled product sections.
- The application is responsive and installable as a web app; native mobile applications are not required.
- User activity is the permanent system of record. Catalog metadata is replaceable provider data.

Commercialization is a deliberate future gate because it may require a commercial metadata license and changes to provider caching or display rules.

## 4. Product Principles

### 4.1 Partial consumption is first-class

“Partially watched” is not a vague alternate version of “watched.” It consists of:

- a lifecycle state such as In Progress, Paused, or Dropped; and
- a recorded position such as 70%, 84 minutes, or episode 6 of 10.

This lets the application distinguish “still watching at 70%” from “stopped permanently at 70%.”

### 4.2 Current state and history are different

A mutable library entry answers “What is my relationship with this title now?” A chronological consumption record answers “What happened and when?” The application needs both so that rewatches and yearly recaps are accurate.

### 4.3 Ratings are independent of completion

A user may rate a completed, paused, or dropped title. The interface should display the accompanying state and progress so a partial rating is not mistaken for a completed-viewing rating.

### 4.4 Social visibility is intentional

Private data is the default. Sharing should happen with accepted friends or explicitly selected groups. Every social query must obey the visibility of the underlying library entries and events.

### 4.5 Catalog providers are replaceable

No provider identifier becomes the application's primary identifier. Provider attribution, refresh dates, and external identifiers are stored explicitly so metadata can be refreshed, corrected, remapped, or removed without losing user history.

## 5. Scope

### 5.1 MVP capabilities

- Sign in through an invitation.
- Create and edit a profile.
- Search for movies and television series.
- View essential title metadata and artwork.
- Add a title to Want to Watch.
- Mark a title In Progress, Paused, Completed, or Dropped.
- Record movie progress as a percentage or elapsed minutes.
- Record television progress by episode, with bulk season actions.
- Apply a manual show-level progress override when episode-level detail is unavailable.
- Rate a movie or series.
- Record repeat viewings without overwriting previous viewings.
- Browse a personal shelf by state.
- Browse a chronological personal activity history.
- Create an invite-only group and accept group invitations.
- Compare eligible member activity and watchlists within a group.
- View a small year-to-date personal statistics page.

### 5.2 Explicit non-goals for the MVP

- Books, authors, editions, or reading progress.
- Albums, artists, tracks, or streaming playback.
- Public reviews, comments, likes, or moderation systems.
- Public followers or globally searchable profiles.
- An algorithmic recommendation engine.
- Custom ranked lists.
- Live synchronization with Netflix, Hulu, Spotify, or other consumption services.
- Streaming playback.
- A comprehensive local copy of a third-party catalog.
- A full annual Wrapped presentation.
- Monetization.

## 6. Core Vocabulary and Rules

### 6.1 Library states

| State | Meaning | Progress allowed | Terminal |
| --- | --- | --- | --- |
| Want to Watch | The user intends to watch but has not started this attempt. | No | No |
| In Progress | The current attempt has started and is active. | Yes | No |
| Paused | The user expects they may continue, but not currently. | Yes | No |
| Completed | The current attempt was finished. | Treated as 100% | Yes |
| Dropped | The user intentionally stopped without completing. | Yes | Yes |

Rules:

- Starting a title creates a consumption session.
- Completing or dropping closes the active session.
- Starting a completed title creates a new rewatch session rather than erasing completion history.
- A completed title can therefore display both “Watched” and “Rewatching.”
- Want to Watch is the canonical watchlist state; the watchlist is a filtered view, not a separately maintained list.
- Paused and Dropped must never be silently converted to Completed by progress calculations.

### 6.2 Ratings

- The initial interface uses five stars in half-star increments.
- The database stores an integer score from 0 through 100.
- A half-star maps to 10 points, one star to 20 points, and five stars to 100 points.
- “No rating” is distinct from zero.
- The user can rate a movie or a series in the MVP.
- Episode- and season-level ratings are deferred.
- A rating records when it was created and last changed.
- Historical rating revisions are not required for the MVP, but activity records should preserve that a rating action occurred.

### 6.3 Movie progress

- A user can enter percentage complete or elapsed minutes.
- When runtime is known, either representation can be converted for display.
- The originally supplied unit and value are preserved to avoid false precision.
- Marking Completed records 100% regardless of the previous value.
- Marking Dropped requires no minimum progress.

### 6.4 Television progress

- Episode completion is the preferred source of truth.
- A season can be marked watched or unwatched in bulk.
- Series progress is derived from watched released episodes divided by all released episodes.
- Unaired episodes are excluded from the denominator.
- Specials are excluded from the default percentage but may be tracked individually.
- A user may enter a manual percentage when exact episodes are unknown.
- Manual progress is labeled as an estimate and does not fabricate episode completions.
- If the user later logs episodes, episode-derived progress replaces the estimate only after an explicit confirmation.

### 6.5 Dates and repeat viewing

- Exact dates are optional; users may log an event without knowing the precise historical date.
- Dates have a precision marker: exact day, month, year, or unknown.
- Rewatches create additional consumption sessions.
- A user can correct or delete their own viewing event.
- Deleting an event recalculates derived statistics but does not delete the catalog title.

## 7. MVP Screens

### 7.1 Invitation and onboarding

Purpose: create an account with minimal friction and establish privacy expectations.

Required elements:

- Invitation validation.
- Email sign-in or magic link.
- Username and display name.
- Optional avatar.
- Plain-language explanation that the initial product is visible only to accepted friends and groups.

### 7.2 Home

Purpose: provide the fastest path back into logging and deciding.

Required sections:

- Continue Watching.
- Want to Watch.
- Recent personal activity.
- Recent friend activity the viewer is permitted to see.
- A search affordance prominent enough to begin the main workflow.

The page should remain useful with one user and no friends.

### 7.3 Search and discovery

Purpose: locate the correct movie or series quickly.

Required behavior:

- One query searches movies and television.
- Results clearly label Movie or TV.
- Results include title, release year, artwork, and disambiguating information.
- Selecting a result obtains fresh provider details and creates or updates a local catalog record.
- Duplicate local records are prevented through provider mappings and external IDs.

Discovery carousels and recommendation feeds are deferred.

### 7.4 Title detail

Purpose: understand a title and take any tracking action from one place.

Required elements:

- Artwork, title, year, type, summary, genres, and runtime or episode structure when available.
- Current user state and progress.
- Want to Watch, Start, Pause, Complete, Drop, and Rewatch actions as context permits.
- Rating control.
- Viewing history for the current user.
- Friend and group summary counts, subject to permissions.
- Provider attribution and source link where required.

For television, the screen also includes seasons, episodes, and bulk season actions.

### 7.5 My Shelf

Purpose: make the user's complete library understandable and manageable.

Required filters:

- All.
- Want to Watch.
- In Progress.
- Paused.
- Completed.
- Dropped.
- Movies or TV.
- Rated or unrated.

Required sorting:

- Recently updated.
- Title.
- Release date.
- User rating.
- Date completed.

### 7.6 Activity history

Purpose: provide the source record for memory and statistics.

Events include:

- Added to watchlist.
- Started.
- Progress updated.
- Paused.
- Completed.
- Dropped.
- Rewatched.
- Rated or rating changed.

The user can edit or remove their own events when a correction is needed.

### 7.7 Profile

Purpose: express taste without requiring public performance.

Required elements:

- Display name, username, and avatar.
- Favorite titles selected manually.
- Recent visible activity.
- Counts by state and media type.
- Year-to-date summary.
- Visibility appropriate to the relationship between viewer and profile owner.

### 7.8 Group overlap

Purpose: help a friend group understand shared experience and choose what to watch.

Required views:

- Titles watched by each member.
- Titles watched by all members.
- Titles on multiple members' watchlists.
- Titles no one has completed but multiple people want to watch.
- Highest-rated titles unseen by at least one member.
- Member-by-title overlap matrix for a selected result set.

Each result should expose the counts behind it rather than presenting an unexplained recommendation score.

### 7.9 Year-to-date statistics

Purpose: prove the value of reflection before investing in a full Wrapped experience.

Initial metrics:

- Movies completed.
- Episodes completed.
- Approximate minutes watched.
- Titles dropped.
- Rewatches.
- Average and distribution of ratings.
- Most-watched genres and release decades.
- Most frequent directors or creators when metadata coverage permits.
- Group members with the highest title overlap.

Every metric must disclose important coverage limitations, such as missing runtime or creator data.

## 8. Social and Privacy Model

### 8.1 Relationships

The MVP uses mutual friendships and explicit groups, not asymmetric followers.

- A friend request must be accepted.
- A group has one or more administrators.
- Group invitations must be accepted.
- Removing a member immediately removes their access to group-only data.
- Blocking and abuse-reporting are deferred while access remains invite-only, but the data model must not prevent adding them later.

### 8.2 Visibility

Initial visibility values:

- Private.
- Friends.
- Selected Groups.

Default visibility is Friends for ordinary activity and Private for free-form notes if notes are introduced later.

Rules:

- Group aggregates include only entries visible to that group.
- The interface must not reveal a hidden entry through a count, average, tooltip, or recommendation.
- Database authorization is enforced at the row level rather than only hidden in the interface.
- Users can export and delete their own activity data.

## 9. Catalog and Provider Strategy

### 9.1 Initial provider

The working local prototype uses Stremio's documented Cinemeta catalog and metadata endpoints because they provide real movie and series search, IMDb identifiers, posters, and episode metadata without placing a secret in browser code. The production provider remains an explicit deployment decision. TMDB is the recommended candidate for a non-commercial hosted MVP because it supplies unified search, movies, series, seasons, episodes, credits, images, and useful external identifiers.

Required operating rules:

- Keep the API credential server-side.
- Display required TMDB attribution and source links.
- Do not imply TMDB endorsement.
- Review licensing before introducing revenue.
- Do not use TMDB content for prohibited machine-learning or AI purposes.
- Track fetch time and provider for every normalized catalog record.
- Implement provider-data refresh and purge capabilities.
- Do not download the full catalog.

Relevant documentation:

- [TMDB API FAQ and attribution](https://developer.themoviedb.org/docs/faq)
- [TMDB API terms](https://www.themoviedb.org/api-terms-of-use)
- [TMDB multi-search](https://developer.themoviedb.org/reference/search-multi)
- [TMDB external IDs](https://developer.themoviedb.org/reference/movie-external-ids)

### 9.2 Provider adapter boundary

Application code should depend on a small internal catalog interface rather than TMDB response shapes. The boundary needs operations equivalent to:

- Search movies and series.
- Fetch one movie or series.
- Fetch seasons and episodes.
- Fetch credits.
- Fetch artwork references.
- Fetch external identifiers.
- Refresh an existing provider record.
- Remove provider-owned fields while retaining user-owned activity.

Raw provider responses should not be treated as permanent application records. Only needed normalized fields should enter the catalog tables; short-lived raw response caching can be added if provider terms permit it.

### 9.3 Future providers

- TVmaze can supplement television data if a specific coverage gap justifies its CC BY-SA obligations.
- Wikidata can supply CC0 cross-identifiers and selected factual enrichment.
- Watchmode can be evaluated later for streaming availability if its cost is justified.
- IMDb downloadable datasets must not be used to create the application's online catalog under their non-commercial dataset license.
- Scraping Letterboxd, IMDb, Goodreads, StoryGraph, or streaming services is outside the product strategy.

## 10. Conceptual Data Model

The exact schema will be produced during technical design. The product requires the following boundaries.

### 10.1 Identity and social

**Profile**

- Internal user ID.
- Username and display name.
- Avatar.
- Account and profile timestamps.

**Friendship**

- Requester and recipient.
- Pending, accepted, declined, or removed state.
- State timestamps.

**Group**

- Internal group ID.
- Name, creator, and timestamps.

**GroupMembership**

- Group and user IDs.
- Member or administrator role.
- Invitation state and timestamps.

### 10.2 Catalog

**MediaItem**

- Internal immutable ID.
- Media type.
- Canonical display title.
- Release date and date precision.
- Normalized common metadata.
- Primary current provider attribution.
- Fetch and refresh timestamps.

**MovieDetails**

- Media item ID.
- Runtime and movie-specific metadata.

**SeriesDetails**

- Media item ID.
- Series status and television-specific metadata.

**Season** and **Episode**

- Internal IDs and parent relationships.
- Provider ordering and identifiers.
- Air dates, runtime, and release state.

**ExternalIdentifier**

- Internal media entity ID.
- Provider name, entity type, and provider identifier.
- Unique constraint preventing duplicate mappings.

**CatalogCredit**

- Media item, person, role, and ordering.
- Provider attribution.

**CatalogImage**

- Media item, image kind, provider reference, dimensions, language, and attribution.

### 10.3 User-owned media data

**LibraryEntry**

- User and media item IDs.
- Current state.
- Current rating reference or value.
- Visibility.
- First-added and last-updated timestamps.
- Unique constraint on user and media item.

**ConsumptionSession**

- User and media item IDs.
- Attempt number.
- In-progress, completed, or dropped outcome.
- Start, end, and date precision.
- Progress value and unit.
- Whether progress is derived or manually estimated.

**EpisodeCompletion**

- User, episode, and optional consumption-session IDs.
- Completion time and date precision.
- Source such as individual action or bulk season action.

**Rating**

- User and media item IDs.
- Integer value from 0 through 100.
- Associated session when applicable.
- Created and updated timestamps.

**ActivityEvent**

- Actor, media item, and optional session IDs.
- Event type and timestamp.
- Minimal structured event details.
- Visibility snapshot or reference.

User-owned rows remain intact if external provider metadata is refreshed, remapped, or purged.

## 11. Derived Data and Group Queries

Derived values should be computed from user-owned records or maintained as reproducible projections.

Examples:

- A member has watched a title if they have at least one completed session.
- A member is currently watching if they have an active session, even if they completed it previously.
- Rewatch count equals completed sessions after the first completion.
- Group completed count equals distinct eligible members with a completed session.
- Group watchlist count equals distinct eligible members whose current state is Want to Watch.
- Group average rating uses only visible ratings and always displays the number of ratings.
- Series percentage uses released non-special episodes unless a labeled manual estimate is active.

Frequently used overlap queries should be implemented in PostgreSQL views or functions with explicit authorization tests. Materialized summaries are unnecessary until measured query volume warrants them.

## 12. Recap Foundation

The MVP does not need a polished Wrapped experience, but it must preserve enough history to create one later.

Requirements from day one:

- Timestamped consumption sessions and activity events.
- Repeat-viewing history.
- Historical dates with precision markers.
- Runtime and genre coverage markers.
- Deterministic definitions for completed, dropped, and rewatched.
- Ability to regenerate a year's statistics from source records.

When annual recaps are introduced, finalized recaps should be snapshotted so later catalog corrections do not silently change what a user previously saw.

## 13. Recommended Technical Architecture

This is an architectural recommendation, not an implementation commitment.

- **Client and application server:** Next.js with TypeScript, delivered as a responsive progressive web application.
- **Database:** PostgreSQL hosted by Supabase.
- **Authentication:** Supabase Auth with administrator-issued invitations.
- **Authorization:** PostgreSQL grants and row-level security, with allow-and-deny tests for every exposed table.
- **Catalog access:** Server-only provider adapter and credential.
- **Background work:** A small scheduled refresh job for stale, actively used catalog records.
- **Deployment:** Managed web hosting plus Supabase for the prototype.
- **Observability:** Structured application errors, catalog-provider request metrics, and job history.

No microservices, dedicated search engine, event broker, recommendation model, or bulk metadata pipeline is justified for the initial product.

## 14. Delivery Plan and Acceptance Gates

### Slice 0: Executable foundation

Deliverables:

- Repository and project scaffolding.
- Local development environment.
- Repeatable database migrations.
- Authentication shell.
- Provider adapter contract and one TMDB implementation.
- Attribution surface.

Gate:

- A fresh checkout can be configured and run locally using documented commands.
- No secret is committed or exposed to the browser.
- An invited test user can sign in.

### Slice 1: Movies end to end

Deliverables:

- Movie search and detail.
- Want to Watch, In Progress, Paused, Completed, and Dropped states.
- Percentage or minute progress.
- Ratings.
- Viewing sessions and rewatches.
- My Shelf and activity history.

Gate:

- A user can take one movie through every lifecycle path without corrupting history.
- Starting a rewatch does not erase the first completion.
- Dropping at 70% is visibly different from being active at 70%.

### Slice 2: Episodic television

Deliverables:

- Series, season, and episode detail.
- Episode completion.
- Bulk season actions.
- Derived and estimated series progress.
- Series ratings.

Gate:

- Released-episode progress is correct and excludes unaired episodes and default-excluded specials.
- Manual estimates never fabricate episode history.

### Slice 3: Friends and groups

Deliverables:

- Friend requests.
- Group invitations and membership.
- Profile visibility.
- Group overlap views and decision queries.

Gate:

- Every aggregate respects visibility.
- A removed group member immediately loses access.
- Hidden entries cannot be inferred through group counts.

### Slice 4: Year-to-date insight

Deliverables:

- Personal statistics.
- Group overlap statistics.
- Coverage disclosures.

Gate:

- Metrics can be reproduced from underlying sessions and events.
- Missing metadata does not create misleading zero values.

### Later phases

1. Imports and exports.
2. Books through a work-and-edition-aware catalog adapter.
3. Music through an album-release-and-track-aware catalog adapter.
4. Custom lists and richer taste expression.
5. A polished annual recap.
6. Optional service integrations.
7. Public product and monetization review, including metadata licensing.

## 15. Key Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Catalog license changes or commercialization | Provider adapter, internal IDs, explicit attribution, refresh/purge tooling, and a licensing gate before revenue. |
| Attempting to model every medium identically | Share interaction primitives while keeping medium-specific catalog structures. |
| Losing history through a single mutable status | Separate current LibraryEntry from repeatable ConsumptionSession and ActivityEvent records. |
| Misleading television percentages | Prefer released episode completions, label estimates, and exclude unaired episodes. |
| Social queries leak private activity | Enforce database-level authorization and test aggregates for indirect disclosure. |
| Empty product before a user has friends | Make personal shelf, progress, and statistics independently useful. |
| Scope expands into recommendations and public social features | Complete the movie, TV, group-overlap, and year-to-date gates first. |
| External metadata outages | Cache normalized data for interacted-with titles, refresh asynchronously, and degrade to local snapshots. |

## 16. Decisions Fixed for the First Build

Unless explicitly revised before implementation, the first build will use these decisions:

- The working product name is Anthology.
- The prototype is private, invite-only, and non-commercial.
- Movies are implemented before television within the movie/TV phase.
- Want to Watch is a state-derived watchlist.
- Progress and lifecycle state are separate.
- Rewatches create new sessions.
- Ratings are displayed as half-star increments and stored on a 0–100 scale.
- Series ratings are included; episode and season ratings are not.
- Television progress is episode-derived with labeled manual estimates.
- Friendships are mutual.
- Groups are explicit and invitation-based.
- TMDB is the initial catalog provider behind a provider-independent interface.
- User activity remains intact if provider metadata must be removed.

## 17. Decisions That Can Safely Wait

These choices do not block the first implementation slice:

- Final product name and branding.
- Public profiles or followers.
- Whether reviews or notes become social.
- Custom list design.
- Recommendation algorithms.
- Streaming-availability provider.
- Exact annual recap visual design.
- Book and music provider fallbacks.
- Native mobile applications.
- Monetization model.

They should be revisited only when the completed MVP supplies evidence that they are needed.

## 18. Success Criteria for the Initial Product

The initial product is successful when:

- Logging a movie takes only a few obvious actions.
- A user can accurately represent unfinished consumption without marking it watched.
- Rewatch history remains correct.
- Television progress reflects real episodes or clearly labeled estimates.
- A personal shelf remains useful without social participation.
- A friend group can find meaningful shared watchlist opportunities.
- Year-to-date totals can be explained and reproduced.
- Catalog-provider changes cannot destroy user-owned history.

The first qualitative test is simple: after using Anthology for several weeks, users should trust it as the record of what they watched and open it when their group asks, “What should we watch?”
