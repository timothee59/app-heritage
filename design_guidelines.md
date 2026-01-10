# Design Guidelines: Héritage Partagé

## Design Approach: Apple HIG + Material Design Hybrid
**Rationale**: Utility-focused family app requiring clarity, accessibility for elderly users (65+), and mobile-first design. Apple HIG provides touch-optimized patterns for iOS/iPad PWA, while Material Design offers excellent badge/chip patterns for preference indicators.

## Typography System
- **Primary**: System fonts (San Francisco on iOS, Roboto on Android) via system-ui
- **Headings**: Medium weight (500), generous line-height (1.4)
  - Screen titles: text-2xl
  - Card titles: text-lg
  - Section headers: text-base font-medium
- **Body**: Regular weight (400), text-base
- **Metadata**: text-sm text-gray-600
- **Accessibility**: Minimum 16px base for elderly users, clear contrast ratios

## Layout & Spacing System
**Tailwind Units**: Standardize on 4, 6, 8, 12, 16 units
- Component padding: p-4 (cards), p-6 (screens)
- Vertical rhythm: space-y-6 between sections
- Touch targets: Minimum 44px (h-11, min-h-[44px])
- Screen margins: px-4 mobile, px-6 desktop
- Grid gaps: gap-4 (gallery), gap-6 (larger layouts)

## Core Components

### Navigation
**Bottom Tab Bar** (iOS pattern for PWA):
- Fixed bottom navigation with 4-5 primary sections
- Large icons with labels (easier for elderly users)
- Height: h-16, icons at 24px, labels at text-xs

### Gallery Grid
**Photo-First Card Grid**:
- 2 columns mobile (grid-cols-2), 3-4 desktop (md:grid-cols-3 lg:grid-cols-4)
- Square aspect ratio cards (aspect-square)
- Item number overlay (top-left corner badge)
- Preference indicators as colored chips overlaid bottom
- Conflict indicator: prominent badge (top-right)
- Subtle border, rounded-lg corners

### Item Detail Screen
**Full-Screen Photo Viewer**:
- Hero image carousel at top (aspect-video or aspect-square, takes 40-50% viewport)
- Swipe-enabled gallery for multiple photos
- Below photos: Title input field, Description textarea
- Preference buttons: Three large touch-friendly buttons (h-12) in horizontal row
  - "Je le veux!" | "Je le veux bien" | "Pas intéressé"
  - Full-width on mobile, contained on desktop
- Preference summary: Chips showing who wants what (flex-wrap)
- Comments thread: Timeline-style with avatars (initials in circles)

### Photo Capture Interface
**Camera-First Flow**:
- Large centered camera preview (aspect-square or 3:4)
- Bottom action bar: Cancel | Capture | Gallery Import
- Capture button: Large circular (w-16 h-16)
- Auto-numbering display prominent after capture

### Filter/Sort Bar
**Sticky Top Bar**:
- Horizontal scrollable chips (overflow-x-auto)
- Active filter highlighted
- Options: Tous | Mes favoris | Non traités | Conflits | Par personne

### User Identification Screen
**Simplified Entry**:
- Centered card (max-w-md) on neutral background
- Large name input field (h-12)
- Role toggle buttons (Parent/Enfant) full-width, stacked
- Primary action button prominent at bottom

## Status Indicators & Badges
- **Preference levels**: Circular colored chips (w-8 h-8)
- **Conflict badge**: Red accent, rounded-full, positioned absolute
- **Item numbers**: Badge with monospace font, subtle background
- **Deleted items**: Strikethrough overlay, reduced opacity (opacity-50)

## Interaction Patterns
- Tap cards to view detail (no hover states needed for mobile)
- Swipe for photo gallery navigation
- Pull-to-refresh on gallery view
- Large tap targets throughout (min 44px)
- Bottom sheets for secondary actions (iOS pattern)

## Accessibility for Elderly Users
- Generous whitespace between interactive elements (min space-y-4)
- High contrast text (no light gray on white)
- Large, clear labels on all buttons
- No small tap targets or gesture-only interactions
- Loading states clearly visible
- Error messages prominent and helpful

## Images
**No hero image** - This is a utility app, not marketing. All images are user-generated photos of household items displayed in:
- Gallery grid thumbnails (square cropped)
- Detail view carousel (original aspect ratio)
- Comment avatars (generated from initials)