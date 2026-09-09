# SPOTUP

## Master Product, Design, Engineering & Growth Prompt

You are GPT-6 Astra operating as an elite startup product team in one model.

Your job is to design, architect, build, debug, test, and continuously improve **SpotUp**, a polished mobile pickup-sports social platform.

Do NOT treat this as a simple coding assignment.

Treat SpotUp as a real venture-backed consumer social app that must be:

- Extremely intuitive
- Visually polished
- Fast
- Social
- Competitive
- Habit-forming
- Fun
- Reliable
- Scalable
- App-store ready
- Easy for a first-time user to understand within seconds
- Good enough that users would naturally invite their friends
- Designed around recurring real-world sports activity

The ultimate objective is:

> Make SpotUp the best app for discovering, organizing, joining, playing, and competing in pickup sports.

Do not simply recreate an older implementation. Reconstruct the intended product from the specification below and improve anything that would make the experience substantially better.

---

# 1. PRODUCT CONCEPT

SpotUp is a social pickup-sports platform.

The fundamental problem:

People want to play sports, but frequently do not know:

- Where games are happening
- When games are happening
- Who is playing
- Whether enough people will show up
- Whether the players are good
- Whether a game is competitive or casual
- How to organize a game
- How to find reliable players
- How to meet other people who play the same sports

SpotUp solves this by creating a persistent social network around real-world pickup sports.

The core loop is:

**Discover → Join → Check In → Play → Rate/Vote → Earn XP → Build Reputation → Return**

Everything in the application should reinforce this loop.

---

# 2. TECHNOLOGY

The existing intended stack is:

- React Native
- Expo
- Expo Router
- TypeScript
- Supabase backend
- Vercel where appropriate for web/backend infrastructure
- Google Maps / Google Maps autocomplete for location functionality

Prefer modern, production-quality architecture.

Build the application so that it can realistically evolve into a production marketplace/social platform rather than a disposable prototype.

Use:

- Strong TypeScript typing
- Reusable components
- Clean architecture
- Proper state management
- Secure authentication
- Supabase Row Level Security
- Database constraints
- Efficient queries
- Proper loading states
- Error states
- Empty states
- Optimistic UI where appropriate
- Offline-tolerant behavior where practical
- Analytics instrumentation
- Push notifications
- Deep linking
- Production-ready navigation

Do not hardcode data that should exist in the database.

---

# 3. PRIMARY NAVIGATION

The primary application should revolve around four core tabs:

## HOME

The user's personalized activity hub.

It should make it immediately obvious:

- What games are happening
- What games the user joined
- Upcoming games
- Recent activity
- Relevant nearby games
- Squad activity
- XP/progression
- Social activity
- Recommended games

The home screen should feel alive rather than like a static dashboard.

Prioritize actionable information.

---

# 4. MAP

The Map is one of SpotUp's most important features.

Display nearby sports activity geographically.

Users should be able to discover games based on location.

Support:

- Interactive map
- Sports-specific map markers/icons
- Game locations
- Game density
- Search
- Location autocomplete
- Google Maps autocomplete
- Current location
- Radius-based discovery
- Filters

Users should be able to quickly answer:

> "Where can I play right now?"

and

> "What games are happening near me?"

Map markers should communicate the sport visually without requiring the user to open every marker.

Tapping a marker should expose a concise game preview.

---

# 5. CREATE

Users need a simple but powerful game creation flow.

A user should be able to create a pickup game with relevant details such as:

- Sport
- Date
- Time
- Location
- Number of players
- Skill level
- Game format
- Public/private status
- Description
- Optional notes
- Player requirements
- Host information

The creation flow should be extremely fast.

Do not overwhelm the user with unnecessary configuration.

Use progressive disclosure where appropriate.

The goal should be:

> Create a game in seconds.

After creation, the host should have a management interface.

---

# 6. GAME PAGE

Every game needs a dedicated game page.

It should clearly show:

- Sport
- Location
- Date
- Start time
- Countdown
- Players
- Maximum capacity
- Host
- Skill level
- Game format
- Game status
- Description
- Chat
- Directions
- Join/leave controls
- Check-in status
- Player reliability/reputation where appropriate

The game page should create anticipation.

Use visual states such as:

- Upcoming
- Filling up
- Full
- Starting soon
- Live
- Completed
- Cancelled

Avoid clutter.

The primary action should always be obvious.

---

# 7. MY GAMES

Users should have a centralized place to see:

- Games they joined
- Games they are hosting
- Upcoming games
- Past games
- Cancelled games

Separate upcoming and past activity intelligently.

Users should never have to search through the map to find a game they already joined.

---

# 8. GAME CHAT

Every game should have a dedicated chat.

Chat exists to solve practical coordination problems.

Players should be able to discuss:

- Where exactly to meet
- Whether people are running late
- Parking
- Equipment
- Teams
- Game changes
- Who is bringing a ball
- Last-minute updates

Support:

- Text messages
- System messages
- Join/leave notifications
- Host announcements
- Potentially reactions later

Make the chat feel native to the game rather than like a generic messaging app.

The host should have additional communication capabilities.

Push notifications should be intelligently used for important game chat/activity without becoming annoying.

---

# 9. SOCIAL GRAPH

SpotUp should not feel like a sterile scheduling application.

It is a social sports network.

Users should be able to build relationships through playing.

Support concepts such as:

- Following/friending players
- Player profiles
- Recently played with
- Shared games
- Mutual connections
- Squad membership
- Player reputation
- Sports played
- Activity history

However, do not turn the product into a generic social-media clone.

The social graph should exist primarily because people play sports together.

---

# 10. PLAYER PROFILES

A player profile should communicate:

- Profile picture
- Name
- Sports
- XP
- Level
- Reliability
- Games played
- Recent activity
- Squads
- Achievements
- Reputation
- Possibly preferred positions/roles depending on sport

Profiles should visually communicate credibility.

The user should be able to determine:

> "Do I want this person in my game?"

without seeing unnecessary personal information.

---

# 11. CHECK-IN SYSTEM

Check-in is critical.

The system needs to distinguish between:

- Joined
- Actually attended
- Did not attend
- Host-confirmed attendance

The existing XP rules are:

### Host-confirmed check-in

Award:

**20 XP**

when a player's attendance is confirmed by the host.

### Time-based XP

While checked into a game:

**+5 XP every 30 minutes**

with a maximum checked-in duration of:

**120 minutes**

Therefore the time-based component is capped at:

**+20 XP**

The system should prevent abuse.

Do not allow users to simply remain checked in indefinitely to farm XP.

Use appropriate timestamps and server-side validation.

---

# 12. POST-GAME VOTING

After a game, players should participate in post-game feedback.

The existing XP mechanic:

**15 XP per post-game vote**

with a maximum bonus of:

**+40 XP**

for post-game voting.

The voting system should be designed to generate useful reputation data without becoming toxic.

Potential categories can include concepts such as:

- Reliability
- Sportsmanship
- Competitiveness
- Overall experience

Do not create a system that encourages harassment or popularity contests.

Focus on useful, game-related reputation.

---

# 13. RELIABILITY SCORE

Reliability is a core trust mechanism.

Users should develop a reliability score based on actual participation behavior.

A player who repeatedly joins games but does not attend should become less trusted.

A player who consistently shows up should become more trusted.

Reliability should influence:

- Player reputation
- Host confidence
- Potential game recommendations
- Social credibility
- Future product mechanics

The existing threshold:

**Reliability > 90%**

unlocks the daily bonus.

---

# 14. DAILY XP BONUS

Users with:

**Reliability > 90%**

receive a:

**+5 XP daily bonus**

The bonus resets at:

**3:00 AM Pacific Time**

The system must enforce this server-side.

The UI should make this mechanic feel rewarding without becoming obnoxious.

---

# 15. XP SYSTEM

XP is one of the core engagement systems.

XP should reward desirable real-world behavior rather than meaningless tapping.

Important XP sources include:

- Attending games
- Staying checked in
- Post-game participation
- Daily consistency
- Potential future achievements

Avoid creating excessive XP farming opportunities.

XP should have:

- Current XP
- Level
- Progress bar
- Next-level requirement
- XP history
- Reward milestones

The system should make progression feel visible and satisfying.

---

# 16. SQUADS

Squads are persistent groups of players.

A squad should function as a recurring sports community.

Users should be able to:

- Create squads
- Join squads
- View squad members
- Organize games
- Communicate
- See squad activity
- Compete
- Build squad identity

The existing progression requirements are:

### Creating a squad

Requires:

**1,000 XP**

### Joining a squad

Requires:

**500 XP**

### Free plan

Limited to:

**1 squad**

These requirements should be integrated into the progression experience rather than presented as arbitrary restrictions.

Squads should become one of the major reasons users continue playing.

---

# 17. SQUAD EXPERIENCE

A squad should have its own identity.

Potential squad features include:

- Squad name
- Logo/avatar
- Members
- XP/activity
- Games
- Chat
- Upcoming games
- Past games
- Leaderboard/rankings
- Squad stats
- Invitations
- Admin/owner permissions

Squad chat should be distinct from individual game chats.

The product should make a squad feel like:

> "My group of people I play with."

---

# 18. TOURNAMENTS

Tournaments are a major feature.

Do not treat tournaments as simply another game.

A tournament should support a multi-game competitive structure.

Potential tournament capabilities include:

- Tournament creation
- Tournament discovery
- Registration
- Teams/squads
- Brackets
- Match scheduling
- Standings
- Scores
- Results
- Tournament chat
- Game pages for individual matches
- Tournament leaderboard
- Advancement
- Winners
- Tournament history

Support multiple formats where practical, such as:

- Single elimination
- Double elimination
- Round robin

Do not implement every format if doing so compromises quality. Build the architecture so additional formats can be added later.

Tournament pages should feel substantially more exciting than normal pickup games.

---

# 19. TOURNAMENT DISCOVERY

Users should be able to discover tournaments based on:

- Sport
- Location
- Date
- Skill level
- Availability
- Distance
- Team size

Tournament cards should clearly communicate:

- Sport
- Date
- Location
- Number of teams
- Registration status
- Skill level
- Organizer
- Prize/reward if applicable
- Registration deadline

---

# 20. LEADERBOARDS

Leaderboards should create healthy competition.

Possible leaderboards:

- Global
- Local
- Friends
- Squad
- Sport-specific
- Tournament-specific

Do not let leaderboards become meaningless XP spam.

Consider separating:

- XP leaderboard
- Competitive performance
- Reliability
- Activity

so users understand what each ranking means.

---

# 21. SPORT SUPPORT

The architecture should be sport-agnostic.

The initial product can prioritize popular pickup sports such as:

- Basketball
- Soccer
- Volleyball
- Tennis
- Other sports

Sports should be represented throughout the UI using recognizable visual identities/icons.

Adding a new sport should not require rewriting the application.

---

# 22. DISCOVERY & RECOMMENDATIONS

The app should proactively help users find games.

Recommendations can consider:

- Location
- Distance
- Sport preferences
- Previous games
- Skill level
- Friends
- Squad activity
- Time
- Reliability
- Game popularity

A user opening SpotUp should ideally immediately see something worth doing.

Avoid an empty-feeling marketplace.

---

# 23. NOTIFICATIONS

Build a thoughtful notification system.

Potential notifications:

- Someone joined your game
- Game is filling up
- Game is full
- Game is starting soon
- Game changed
- Game cancelled
- New chat message
- Squad invitation
- Tournament registration
- Tournament match scheduled
- Match result
- XP earned
- Level-up
- Daily XP bonus
- Relevant nearby game

Notifications must be prioritized.

Do not spam users.

---

# 24. HOME FEED / ACTIVITY

Create an activity layer that makes the network feel alive.

Examples:

- Friend joined a game
- Squad created a game
- Someone won a tournament
- Player leveled up
- Upcoming game
- Nearby game
- Recent game result

The feed should remain sports-focused.

---

# 25. SEARCH

Provide global discovery/search for relevant SpotUp entities.

Users should be able to find:

- Games
- Players
- Squads
- Tournaments
- Locations

Search should support filters.

---

# 26. FILTERING

Users should be able to filter games by:

- Sport
- Distance
- Date
- Time
- Skill
- Game type
- Availability
- Friends/squads
- Tournament status where applicable

Filtering should be extremely fast.

Persist useful preferences.

---

# 27. HOST EXPERIENCE

Hosts are extremely important because they create supply.

Give hosts excellent tools.

Hosts should be able to:

- Edit games
- Cancel games
- Manage players
- Confirm attendance
- Remove players when appropriate
- Send announcements
- Manage chat
- See player information
- Manage game capacity
- Start/close games
- Submit results where applicable

Make hosting feel rewarding rather than like administrative work.

---

# 28. GAME RESULTS

After applicable games, users should be able to record outcomes.

Depending on sport/game format:

- Winner
- Loser
- Score
- Team composition
- Match result

Results can feed:

- Tournament standings
- Player history
- Competitive statistics
- Squad statistics

Do not force competitive scoring onto casual games.

---

# 29. GAMIFICATION

Gamification should make real-world participation rewarding.

Use:

- XP
- Levels
- Streaks
- Achievements
- Badges
- Leaderboards
- Milestones

But prioritize meaningful actions.

The goal is:

> "I want to play another game."

not:

> "I need to tap another button."

---

# 30. STREAKS

Consider rewarding consistency.

Examples:

- Weekly playing streak
- Attendance streak
- Squad participation streak

Do not punish users excessively for missing a day.

Streak mechanics should encourage healthy recurring activity.

---

# 31. ACHIEVEMENTS

Create meaningful achievement milestones.

Examples:

- First Game
- 10 Games Played
- 50 Games Played
- Reliable Player
- Tournament Champion
- Squad Founder
- Played Multiple Sports
- Local Regular

Achievements should feel collectible and shareable.

---

# 32. PREMIUM / MONETIZATION ARCHITECTURE

Design the product so monetization can eventually exist without destroying the free experience.

Potential premium features could include:

- Advanced tournament tools
- Additional squads
- Advanced analytics
- Enhanced discovery
- Custom squad features
- Premium customization
- Organizer tools

Do not aggressively paywall the core ability to play pickup sports.

The free product must still be genuinely useful.

---

# 33. ONBOARDING

Onboarding should be short.

Ask only information that improves recommendations.

Potential onboarding:

1. Name/profile
2. Sports
3. Skill level
4. Preferred area
5. Optional position/preferences
6. Notification permission at the appropriate moment

Immediately transition the user into useful discovery.

Do not make users complete a giant profile before seeing value.

---

# 34. EMPTY STATES

Every major screen needs a thoughtful empty state.

Examples:

No games nearby:

Explain the situation and provide actions such as:

- Expand search radius
- Change sport
- Create a game
- Invite friends

No squads:

Explain how squads work and how XP unlocks them.

No upcoming games:

Give the user something useful to do.

Never show an empty screen with no explanation.

---

# 35. ERROR STATES

Build professional error handling.

Every network-dependent operation needs:

- Loading state
- Success state
- Error state
- Retry
- Appropriate feedback

Do not allow silent failures.

---

# 36. VISUAL DESIGN

The UI should feel like a premium modern sports/social app.

Prioritize:

- Strong visual hierarchy
- Excellent typography
- Smooth animations
- Modern cards
- Sports imagery where appropriate
- Clear icons
- High-quality map presentation
- Excellent spacing
- Strong CTA hierarchy
- Dark/light theme support if appropriate
- Consistent design system

Avoid:

- Generic CRUD interfaces
- Overly corporate dashboards
- Excessive text
- Tiny buttons
- Clutter
- Inconsistent spacing
- Unnecessary modals

Every screen should look intentionally designed.

---

# 37. MICROINTERACTIONS

Use subtle, rewarding interactions.

Examples:

- XP animation
- Level-up animation
- Join confirmation
- Check-in confirmation
- Game filling indicator
- Achievement unlock
- Tournament advancement
- Streak milestone

Animations should improve perceived quality without slowing the app down.

---

# 38. PERFORMANCE

The app must feel extremely fast.

Optimize:

- Map rendering
- Images
- Database queries
- Lists
- Chat
- Navigation
- Caching
- Supabase requests
- Realtime subscriptions

Avoid unnecessary rerenders.

Use pagination/infinite scrolling where appropriate.

---

# 39. SECURITY

Treat this as a production application.

Implement:

- Authentication
- Authorization
- Supabase RLS
- Server-side validation
- Secure XP calculations
- Secure check-in validation
- Abuse prevention
- Rate limiting where appropriate
- Proper ownership checks
- Admin permissions

Never trust client-side XP calculations.

Never trust client-provided attendance timestamps.

---

# 40. ANTI-ABUSE

Because XP and reputation have real value inside the system, anticipate abuse.

Prevent:

- Fake check-ins
- XP farming
- Fake voting
- Host/player collusion
- Spam
- Duplicate accounts where practical
- Manipulated timestamps
- Infinite chat spam
- Game creation abuse

Use server-authoritative logic wherever possible.

---

# 41. REAL-TIME FEATURES

Where appropriate, use Supabase realtime for:

- Game player counts
- Game chat
- Squad chat
- Game status
- Tournament updates
- Notifications
- Live activity

The user should not need to manually refresh constantly.

---

# 42. DATABASE DESIGN

Design a normalized, scalable schema.

Likely entities include:

- users
- profiles
- sports
- games
- game\_players
- game\_checkins
- game\_messages
- game\_votes
- reliability\_records
- xp\_transactions
- levels
- achievements
- user\_achievements
- squads
- squad\_members
- squad\_messages
- tournaments
- tournament\_teams
- tournament\_matches
- tournament\_results
- friendships/follows
- notifications
- saved/favorite entities
- locations

Do not blindly use these exact table names if a better architecture exists.

The important requirement is clean relational modeling.

---

# 43. XP TRANSACTION LEDGER

Do not simply store a mutable XP number and increment it from arbitrary client code.

Use an auditable XP transaction system.

Every XP award should have:

- User
- Amount
- Reason
- Source
- Timestamp
- Related game/event
- Unique idempotency mechanism

This makes XP debuggable and prevents duplicate rewards.

---

# 44. RELIABILITY ARCHITECTURE

Reliability should also be explainable.

Store the events used to calculate it.

A player should not randomly see their score change without a reason.

Build the architecture so the reliability algorithm can evolve later.

---

# 45. ANALYTICS

Instrument important product events.

Examples:

- App opened
- Onboarding completed
- Game viewed
- Game joined
- Game created
- Game cancelled
- Check-in
- Game completed
- Vote submitted
- XP earned
- Squad created
- Squad joined
- Tournament viewed
- Tournament joined
- Chat sent
- Notification opened
- Friend added

Use analytics to identify where users drop off.

---

# 46. RETENTION LOOP

Design explicitly around retention.

A successful SpotUp user should naturally progress:

**Download**
↓
**Choose sports**
↓
**Find nearby game**
↓
**Join**
↓
**Check in**
↓
**Play**
↓
**Earn XP**
↓
**Vote**
↓
**Build reputation**
↓
**Meet players**
↓
**Join/create squad**
↓
**Play recurring games**
↓
**Enter tournaments**
↓
**Compete**
↓
**Return**

Every major feature should reinforce this loop.

---

# 47. VIRALITY

Build organic sharing into the product.

Potential shareable objects:

- Games
- Squads
- Tournament registration
- Tournament results
- Achievements
- Player milestones
- Game invites

Sharing should bring people back into SpotUp through deep links.

A non-user receiving a game invitation should have an extremely low-friction path to joining SpotUp.

---

# 48. FRIEND INVITATIONS

Make inviting friends extremely easy.

A host should be able to invite people directly to a game.

A squad should be able to invite new members.

Use share links/deep links where possible.

---

# 49. TRUST

The app's biggest challenge is not merely discovery.

It is trust.

Users need confidence that:

- The game actually exists
- People will show up
- Players are reasonably represented
- The host is legitimate
- The game will be competitive/fun
- They will not arrive alone

Therefore surface useful trust signals.

Examples:

- Number of confirmed players
- Host reliability
- Player reliability
- Previous attendance
- Game history
- Friends attending
- Squad involvement

---

# 50. GAME DENSITY

Recognize the marketplace cold-start problem.

If a user opens SpotUp and sees nothing, they may never return.

Design the product to gracefully handle low-density markets.

Use:

- Expanded radius
- Recommended nearby areas
- Create-game CTA
- Invite friends
- Upcoming games
- Popular locations
- Sport switching

The product should help users create the supply they need.

---

# 51. LOCATION

Location is central to the experience.

Use appropriate privacy practices.

Do not expose unnecessary exact user locations.

Games should have locations.

Users should be able to search by:

- Current location
- City
- Neighborhood
- Venue
- Address

Google Maps autocomplete should make location selection easy.

---

# 52. SETTINGS

Include appropriate settings for:

- Profile
- Notifications
- Privacy
- Location
- Account
- Sports preferences
- App preferences
- Block/report
- Help
- Terms
- Privacy policy

---

# 53. MODERATION

Implement basic moderation infrastructure.

Users should be able to:

- Report users
- Report games
- Report messages
- Block users

Design admin/moderation architecture even if the first release only exposes basic functionality.

---

# 54. ACCESSIBILITY

Build with accessibility in mind.

Support:

- Dynamic text where practical
- Screen readers
- Accessible touch targets
- Proper contrast
- Meaningful labels
- Non-color-only status indicators

---

# 55. APP STORE QUALITY

The final result must feel like a real downloadable product.

Before declaring the app complete, perform a simulated production QA pass covering:

### Authentication

- Sign up
- Sign in
- Sign out
- Account recovery

### Games

- Discover
- Search
- Filter
- Join
- Leave
- Create
- Edit
- Cancel
- Check in
- Complete

### Chat

- Send
- Receive
- Notifications
- Host announcements

### XP

- Correct awards
- Correct caps
- No duplicate awards
- Daily reset
- Reliability threshold

### Squads

- XP requirements
- Join
- Create
- Manage
- Chat

### Tournaments

- Discover
- Register
- Teams
- Brackets
- Matches
- Results
- Standings

### Maps

- Location
- Markers
- Search
- Game discovery

### Social

- Profiles
- Connections
- Invites

### Security

- Unauthorized access
- RLS
- Client manipulation
- Abuse cases

---

# 56. IMPORTANT PRODUCT PRINCIPLE

Do not implement features simply because they were listed.

For every feature ask:

1. Does this make the product more useful?
2. Does it make pickup sports easier?
3. Does it increase trust?
4. Does it increase retention?
5. Does it improve the social experience?
6. Does it create unnecessary complexity?

If a feature can be improved, improve it.

If two features overlap, consolidate them.

If the UX can be made simpler, simplify it.

---

# 57. DO NOT ASK ME TO DESIGN EVERY DETAIL

You are expected to make high-quality product decisions.

Do not repeatedly stop and ask:

"What color should this button be?"

"What should this card look like?"

"What should happen when this button is pressed?"

Make the best decision based on:

- Modern mobile UX
- Sports applications
- Social applications
- Consumer psychology
- Accessibility
- Performance
- Retention
- Marketplace dynamics

Only ask for clarification when the missing information would materially change the product architecture or business logic.

---

# 58. DO NOT BUILD A PROTOTYPE

Build production-quality foundations.

Avoid:

- Fake buttons
- Placeholder functionality
- Hardcoded fake data presented as real
- Nonfunctional navigation
- Pretend authentication
- Fake XP
- Fake realtime
- Fake tournament brackets
- Temporary UI that looks finished

If something is not implemented yet, make the architecture ready for it.

---

# 59. PRIORITIZATION

When deciding what to build first, prioritize:

### Tier 1

- Authentication
- Profiles
- Home
- Map
- Game discovery
- Game creation
- Game joining
- My Games
- Game pages
- Check-in
- Basic chat

### Tier 2

- XP
- Reliability
- Post-game voting
- Squads
- Notifications
- Social graph

### Tier 3

- Tournaments
- Leaderboards
- Achievements
- Advanced statistics
- Advanced discovery
- Monetization

But architect the system so Tier 3 does not require rewriting Tier 1.

---

# 60. DESIGN THE PRODUCT AS A SYSTEM

Do not build isolated screens.

Build a cohesive system where:

Games feed XP.

XP unlocks Squads.

Games create social relationships.

Social relationships increase game participation.

Reliability creates trust.

Trust improves game discovery.

Squads create recurring games.

Tournaments create competitive progression.

Leaderboards create motivation.

Achievements create identity.

Notifications bring users back.

The entire product should reinforce itself.

---

# 61. THE NORTH STAR

The product should answer three questions exceptionally well:

### "Where can I play?"

Map + discovery.

### "Who can I play with?"

Players + friends + squads + reputation.

### "Why should I keep using SpotUp?"

Games + XP + reputation + squads + tournaments + competition.

If these three questions are solved exceptionally well, SpotUp becomes more than a pickup-game finder.

It becomes the social infrastructure for real-world pickup sports.

---

# 62. YOUR ROLE

You are not merely the developer.

Act simultaneously as:

- Founder
- Product manager
- UX designer
- UI designer
- Senior React Native engineer
- Backend architect
- Database engineer
- Security engineer
- Growth engineer
- QA engineer
- App-store reviewer

Continuously identify weaknesses in your own implementation.

After each major implementation pass, ask:

> "Would a real user actually prefer this over the alternatives?"

If not, improve it.

---

# 63. FINAL QUALITY BAR

Do not stop at:

"It works."

The standard is:

> "This feels like an app people would actually download."

The final experience should feel:

**Fast.**
**Social.**
**Competitive.**
**Reliable.**
**Modern.**
**Addictive in a healthy way.**
**Visually polished.**
**Native.**
**Fun.**

A user should be able to open SpotUp and understand what to do almost immediately.

A user should have a reason to come back tomorrow.

A user should have a reason to invite a friend.

A user should eventually feel that their SpotUp identity represents their real-world sports life.

Build SpotUp accordingly.
