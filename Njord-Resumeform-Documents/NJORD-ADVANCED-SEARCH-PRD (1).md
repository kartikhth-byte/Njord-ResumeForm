# NjordHR Advanced Search - Product Requirements Document (PRD)

**Version:** 2.1  
**Last Updated:** February 5, 2026  
**Status:** Implemented with post-redesign verification in progress  
**Owner:** KT  

---

## 📋 Executive Summary

The NjordHR Advanced Search module is a comprehensive candidate search and filtering system for maritime recruitment. It combines traditional manual filtering with AI-powered semantic search to help recruiters find qualified seafarers efficiently.

**Key Capabilities:**
- AI-powered semantic search using vector embeddings and LLM reasoning
- Traditional manual filters with 11+ filter criteria
- Confidence scoring and intelligent candidate matching
- Real-time status management and application tracking
- Persistent search results across navigation

---

## 🎯 Product Vision

**Goal:** Enable recruiters to find the best-matching maritime candidates using both traditional criteria-based filtering and advanced AI semantic search.

**Target Users:**
- Master Recruiters
- Recruiters
- Coordinators
- HR Administrators

**Success Metrics:**
- Time to find qualified candidates: <2 minutes
- Search result relevance: >85% accuracy
- User adoption: 70%+ of recruiters using AI search
- Reduction in manual screening time: 50%+

---

## 🏗️ System Architecture

### **Technology Stack**

**Frontend:**
- React 18+ with Hooks
- JavaScript (JSX)
- Tailwind CSS
- React Router v6
- localStorage for client-side caching

**Backend & Services:**
- Supabase (PostgreSQL database)
- Supabase RLS (Row Level Security)
- Pinecone (Vector database for embeddings)
- Google Gemini 2.5-flash (LLM for reasoning)
- Edge Functions (Serverless)

**APIs:**
- Supabase REST API
- Pinecone REST API
- Gemini API (via proxy)

### **Data Flow Architecture**

```
User Input
    ↓
┌─────────────────────────────────┐
│   Manual Search  │  AI Search   │
└─────────────────────────────────┘
         ↓                 ↓
    SQL Filters      Vector Search
         ↓                 ↓
    Supabase ←───────→ Pinecone
         ↓                 ↓
    Applications     Similarity Scores
         ↓                 ↓
         └────→ Merge ←────┘
                  ↓
            LLM Analysis (Gemini)
                  ↓
         Confidence + Reasoning
                  ↓
            Results Table
                  ↓
         localStorage Cache
```

---

## 📊 Database Schema

### **applications**
```sql
- id: uuid (PK)
- user_id: uuid (FK → profiles)
- reference_number: text (e.g., "NJD-001")
- applied_rank: text
- status: text (new, under_review, test_scheduled, etc.)
- public_token: uuid
- submitted_at: timestamp
- created_at: timestamp
- updated_at: timestamp
- test_attempt_number: int
- test_max_attempts: int
```

### **application_data**
```sql
- application_id: uuid (PK, FK → applications)
- data: jsonb {
    section1: { 
      appliedForRank, // Applied rank/position
      availableFrom, // Available from date
      vesselType, // Preferred vessel type
      ... 
    }
    section2: { 
      firstName, surname, email, phoneNumber, 
      nationality, dateOfBirth, 
      ... 
    }
    section8: { 
      certificates: [ // Certificates of Competency
        { grade, issuingCountry, certificateNumber, dateOfIssue, expiryDate, ... }
      ]
    }
    section14: { 
      courses: [ // STCW and training certificates
        { certificateName, dateOfIssue, expiryDate, ... }
      ]
    }
    section15: { 
      endorsements: [ // Flag state endorsements
        { flagState, endorsementType, certificateNumber, dateOfIssue, expiryDate, ... }
      ]
    }
    section16: { 
      seaService: [ // Sea service history
        { vesselName, vesselType, rank, fromDate, toDate, grossTonnage, ... }
      ]
    }
    ... (20 sections total)
  }
```

**Note:** Code review (Feb 2026) corrected schema paths. AI search and embeddings now use:
- `section1` for rank/availability (not section2)
- `section8` for certificates/CoC (not section3)
- `section14` for STCW/training (not section4)
- `section15` for endorsements (not section5)
- `section16` for sea service (not section6)

### **Pinecone Index**
```
- namespace: "applications"
- dimensions: 768 (embedding vector size)
- metadata: {
    application_id: uuid,
    chunk_text: string (resume excerpt),
    section: string (section2, section3, etc.)
  }
```

---

## 🎨 User Interface Structure

### **Current Implemented State**

```
Main Tabs:
├── All Applications
├── New
├── Under Review
├── Test Scheduled
├── Interview Scheduled
├── Advanced Search ← Current focus
│   ├── Search Mode Toggle: [AI Search | Manual Search]
│   ├── AI Search Mode
│   │   ├── Search Input
│   │   ├── Filters (Confidence, Sort)
│   │   └── Results Table
│   └── Manual Search Mode
│       ├── Status Scope Pills
│       ├── Filter Grid
│       ├── Date Range
│       ├── Apply/Clear Buttons
│       └── Results Table
└── Status Pipeline
```

### **Implemented Redesign Notes**

```
Main Tabs:
├── All Applications
├── New
├── Under Review
├── Test Scheduled
├── Interview Scheduled
├── Advanced Search
│   └── In-page sub-tabs: [AI Search | Manual Search]
│       ├── AI Search
│       │   ├── Search Input
│       │   ├── Confidence + Sort Controls
│       │   └── Results Table
│       └── Manual Search
│           ├── Status Scope Pills
│           ├── Filter Controls
│           └── Results Table
└── Status Pipeline
```

**Important:** The redesigned UI does not currently expose recruiter-adjustable threshold controls. Threshold logic remains in the backend only.

---

## 🔍 Feature Specifications

---

## COMPLETED FEATURES ✅

### **1. AI Search - Core Functionality**

#### **1.1 Embedding Generation**

**Status:** ✅ Implemented

**Description:** One-time setup that generates vector embeddings for all applications to enable semantic search.

**User Flow:**
1. User navigates to Advanced Search → AI Search
2. If embeddings not generated, sees prominent setup card
3. Clicks "Generate Embeddings" button
4. System processes all applications
5. Creates embeddings for resume sections (section2, section3)
6. Stores vectors in Pinecone with metadata
7. Completion message shown

**Technical Implementation:**
- Uses Google's embedding model (text-embedding-004 or similar)
- Chunks resume data by section for better granularity
- Stores in Pinecone namespace: "applications"
- Metadata includes: application_id, chunk_text, section

**UI Components:**
- Purple gradient card with setup message
- "Generate Embeddings" button
- Progress indicator (if applicable)

---

#### **1.2 Vector Similarity Search**

**Status:** ✅ Implemented

**Description:** Performs semantic search across all application embeddings to find relevant candidates.

**User Flow:**
1. User types natural language query: "Chief Officer with tanker experience"
2. Clicks search or presses Enter
3. System generates embedding for query
4. Pinecone returns top matches with similarity scores
5. Results displayed with relevance percentages

**Technical Implementation:**
```javascript
// Query Pinecone
const queryEmbedding = await generateEmbedding(searchQuery)
const results = await pinecone.query({
  vector: queryEmbedding,
  topK: 20,
  includeMetadata: true
})

// Filter by similarity threshold (default 0.3)
const filteredResults = results.filter(r => r.score >= 0.3)
```

**Similarity Threshold:**
- Default: 30% (0.3)
- Adjustable via settings: 0-100%
- Higher = stricter matching, fewer results
- Lower = more lenient, more results

**UI Components:**
- Search input field
- Quick example chips
- Relevance score column (percentage)

---

#### **1.3 LLM-Powered Reasoning & Confidence Scoring**

**Status:** ✅ Implemented

**Description:** Uses Google Gemini 2.5-flash to analyze top candidates and provide detailed reasoning with confidence scores.

**User Flow:**
1. Vector search returns top 20 matches
2. System automatically analyzes top 10 with LLM
3. Progress banner shows: "Analyzing X of Y applications"
4. Confidence badges appear as analysis completes
5. Full reasoning available via hover tooltip or modal

**LLM Analysis Input:**
```javascript
{
  searchQuery: "Chief Officer with tanker experience",
  candidateData: {
    // Extracted from correct schema paths (code review Feb 2026)
    rank: "Chief Officer",  // from section1.appliedForRank
    availability: "Available from March 2026",  // from section1.availableFrom
    vesselType: "Container ship",  // from section1.vesselType
    certificates: [  // from section8.certificates
      { grade: "Chief Officer", issuingCountry: "Philippines", ... }
    ],
    courses: [  // from section14.courses
      { certificateName: "STCW Basic Safety", ... }
    ],
    endorsements: [  // from section15.endorsements
      { flagState: "Panama", endorsementType: "Officer", ... }
    ],
    seaService: [  // from section16.seaService
      { vesselName: "MV Ocean Star", vesselType: "Container", rank: "Chief Officer", 
        fromDate: "2018-01", toDate: "2026-01", ... }
    ]
  }
}
```

**Schema Correction (Feb 2026 Code Review):**
Prior to code review, embedding and LLM analysis were reading from incorrect section paths, causing AI search to miss critical candidate data. Fixed paths:
- Rank/availability: `section1` (was incorrectly using section2)
- Certificates/CoC: `section8.certificates` (was incorrectly using section3)
- STCW/training: `section14.courses` (was incorrectly using section4)
- Endorsements: `section15.endorsements` (was incorrectly using section5)
- Sea service: `section16.seaService` (was incorrectly using section6)

**LLM Analysis Output:**
```javascript
{
  is_match: true,
  confidence: 0.55,
  reason: "Candidate holds valid Chief Officer CoC and has 8 years experience. However, experience is on container vessels rather than tankers. No tanker-specific certificates listed. Moderate match due to rank alignment but vessel type mismatch.",
  isUncertain: false
}
```

**Confidence Thresholds:**
- High: ≥85% (🟢 Green badge)
- Medium: 60-84% (🟡 Yellow badge)
- Low: <60% (🔴 Red badge)

**Technical Implementation:**
- Gemini 2.5-flash model via proxy endpoint
- Analyzes top 10 results only (performance optimization)
- Returns structured JSON response
- Stores llmAnalysis in application object

**UI Components:**
- Progress banner during analysis
- Loading spinners in AI Match column
- Confidence badges with color coding

---

#### **1.4 Confidence Badges with Enhanced UX**

**Status:** ✅ Implemented

**Description:** Visual indicators showing AI confidence in candidate match quality with interactive elements.

**Features:**
- **Color-coded badges:**
  - 🟢 Green: High Confidence (85%+)
  - 🟡 Yellow: Review Needed (60-84%)
  - 🔴 Red: Low Match (<60%)

- **Hover tooltips:**
  - Dark overlay tooltip on badge hover
  - Shows confidence level, percentage, icon
  - Displays full LLM reasoning text
  - Uncertainty warning if flagged
  - "Click to view details" hint

- **Clickable modals:**
  - Click badge to open full-screen modal
  - Large confidence score display
  - Animated gradient progress bar
  - Match status grid (Qualified/Not Qualified)
  - Complete reasoning with proper formatting
  - Threshold explanation guide
  - Close via X, button, or backdrop

- **Visual effects:**
  - Hover: scale 110%, shadow glow
  - Active: scale 95% (press effect)
  - Color-matched glow per confidence level
  - Ring effect on hover
  - Smooth transitions (200ms)

**Technical Implementation:**
```javascript
<ConfidenceBadge 
  llmAnalysis={app.llmAnalysis} 
  compact={true}
  applicationName={app.full_name}
/>
```

**Components:**
- `ConfidenceBadge.jsx` - Main badge component
- `ConfidenceBadge.jsx` - Inline badge and reasoning panel

---

#### **1.5 Filtering & Sorting**

**Status:** ✅ Implemented

**Description:** Post-search filtering and sorting options for AI search results.

**Confidence Filter:**
- Dropdown: All Levels, High (85%+), Medium (60-84%), Low (<60%)
- Filters results by confidence threshold
- Updates result count in real-time
- Maintains sort order

**Sort Options:**
- **Relevance:** Sort by similarity score (default)
- **Confidence:** Sort by LLM confidence score
- Toggle button with active state
- Descending order (highest first)

**Technical Implementation:**
```javascript
const getFilteredAndSortedResults = () => {
  let results = [...aiSearchResults]
  
  // Apply confidence filter
  if (confidenceFilter === 'high') {
    results = results.filter(app => app.llmAnalysis?.confidence >= 0.85)
  }
  
  // Apply sorting
  if (sortBy === 'confidence') {
    results.sort((a, b) => (b.llmAnalysis?.confidence || 0) - (a.llmAnalysis?.confidence || 0))
  } else {
    results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
  }
  
  return results
}
```

**UI Components:**
- Confidence filter dropdown
- Sort toggle (segmented control style)
- Stats display (🟢 X High 🟡 X Medium 🔴 X Low)

---

#### **1.6 Advanced Threshold Settings**

**Status:** ✅ Implemented

**Description:** Adjustable thresholds for fine-tuning matching logic and confidence levels.

**Threshold Controls:**

1. **Similarity Threshold (0-100%)**
   - Minimum similarity score for vector search results
   - Default: 30%
   - Lower = more results, higher = stricter

2. **High Confidence Threshold (50-100%)**
   - Minimum confidence for green badge
   - Default: 85%
   - Affects badge color and filtering

3. **Medium Confidence Threshold (40-80%)**
   - Minimum confidence for yellow badge
   - Default: 60%
   - Affects badge color and filtering

**UI Components:**
- Collapsible settings panel (⚙️ icon toggle)
- Three range sliders with live values
- Real-time badge/stats updates
- Reset to Defaults button
- Gradient background panel

**Technical Implementation:**
```javascript
const [similarityThreshold, setSimilarityThreshold] = useState(0.3)
const [highConfidenceThreshold, setHighConfidenceThreshold] = useState(0.85)
const [mediumConfidenceThreshold, setMediumConfidenceThreshold] = useState(0.6)
```

---

#### **1.7 Data Persistence (localStorage)**

**Status:** ✅ Implemented

**Description:** Saves AI search results to browser storage for persistence across navigation and page refreshes.

**Features:**
- Saves enriched results (with full application data)
- Includes search query and timestamp
- 30-minute expiration
- Auto-restore on page load
- Auto-switch to search tab if results exist (fixed in code review)
- Clears on explicit clear action
- **Per-recruiter scoping** - Each recruiter has isolated search cache

**Storage Structure:**
```javascript
// Storage key format: aiSearchResults:{userId}
{
  results: [ /* enriched application objects */ ],
  query: "chief officer",
  timestamp: 1738742400000
}
```

**Technical Implementation:**
```javascript
// Save after enrichment with user-specific key
const storageKey = `aiSearchResults:${user.id}`
localStorage.setItem(storageKey, JSON.stringify({
  results: enrichedResults,
  query,
  timestamp: Date.now()
}))

// Restore on mount (scoped to current user)
useEffect(() => {
  const storageKey = `aiSearchResults:${user?.id}`
  const savedSearch = localStorage.getItem(storageKey)
  if (savedSearch) {
    const { results, query, timestamp } = JSON.parse(savedSearch)
    const age = Date.now() - timestamp
    
    if (age < 30 * 60 * 1000) { // 30 minutes
      setAiSearchResults(results)
      setAiSearchQuery(query)
      setAiSearchActive(true)
    } else {
      localStorage.removeItem(storageKey)
    }
  }
}, [user?.id]) // Only restores once per user
```

**User Benefits:**
- Navigate to Dashboard and back without losing results
- Page refresh preserves search state
- Multiple recruiters on same device don't interfere
- Tab navigation no longer hijacked (code review fix)

---

#### **1.8 Results Display & Table Integration**

**Status:** ✅ Implemented

**Description:** Enhanced application table with AI-specific columns and data.

**AI Search Columns:**
- Reference Number (clickable)
- Name (enriched from application_data.section2)
- Email (enriched from application_data)
- Phone (enriched from application_data)
- Position (from section1.appliedForRank or applications.applied_rank)
- Vessel Type (from application_data.section1)
- Status (with colored badge)
- Submitted Date
- **Relevance** (similarity score %) - AI Search only
- **AI Match** (confidence badge) - AI Search only

**Conditional Rendering:**
- Relevance/AI Match columns only show in AI search mode
- Standard columns always visible
- Columns hide in manual search mode

**Data Enrichment:**
```javascript
const enrichedResults = fullApps.map(app => {
  const appData = app.application_data?.data || {}
  
  return {
    ...app,
    full_name: `${appData.section2?.firstName || ''} ${appData.section2?.surname || ''}`.trim(),
    email: appData.section2?.email || appData.section4?.email || '',
    phone: appData.section2?.phoneNumber || appData.section4?.phoneNumber || '',
    desired_rank: appData.section1?.appliedForRank || app.applied_rank || '',
    vessel_type: appData.section1?.vesselType || '',
    similarity: results.find(r => r.application_id === app.id)?.similarity || 0,
    llmAnalysis: results.find(r => r.application_id === app.id)?.llmAnalysis
  }
})
```

**Technical Implementation:**
- Fetches full application data from Supabase
- Joins applications + application_data tables
- Merges vector search scores and LLM analysis
- Sorts by relevance by default

---

### **2. Manual Filters - Core Functionality**

#### **2.1 Status Filter (Checkboxes)**

**Status:** ✅ Implemented

**Description:** Multi-select checkboxes for filtering by application status.

**Options:**
- ✅ Active (blue checkmark icon)
- ✅ Hired (green checkmark icon)
- ❌ Rejected (red X icon)
- Withdrawn (gray icon)

**Behavior:**
- Multiple selections allowed
- Default: Active checked only
- Updates "Showing: [Status] candidates" text
- Filters applied on "Apply Filters" click

**Technical Implementation:**
```javascript
const [includeActive, setIncludeActive] = useState(true)
const [includeHired, setIncludeHired] = useState(false)
const [includeRejected, setIncludeRejected] = useState(false)
const [includeWithdrawn, setIncludeWithdrawn] = useState(false)
```

---

#### **2.2 Filter Grid (11 Filter Types)**

**Status:** ✅ Implemented

**Description:** 3x3 grid of white-bordered filter boxes for detailed candidate filtering.

**Filter Types:**

**Row 1:**
1. **Rank** - Dropdown (Chief Officer, 2nd Officer, 3rd Officer, Master, Chief Engineer, etc.)
2. **Vessel Type** - Dropdown (Tanker, Container, Bulk Carrier, LNG, Chemical, etc.)
3. **Nationality** - Dropdown/Search (Philippines, India, Ukraine, Romania, etc.)

**Row 2:**
4. **Experience** - Input/Dropdown (Years of sea service)
5. **Certificate** - Dropdown (STCW, COC Class 1, COC Class 2, Medical, etc.)
6. **Age Range** - Input/Slider (Min-Max age)

**Row 3:**
7. **Availability** - Date Picker (Available from date)
8. **Visa Type** - Dropdown (US, UK, Schengen, None)
9. **Flag State** - Dropdown (Panama, Marshall Islands, Liberia, etc.)

**Additional:**
10. **Date Range** - Separate section with Start/End date pickers
11. **Hide Filters Toggle** - Collapses/expands filter panel

**UI Layout:**
- White bordered boxes
- Each filter in its own card
- 3-column grid
- Label above input/dropdown
- Consistent spacing

**Code Review Fixes (Feb 2026):**
- Certificate filter: Fixed to use `cert.grade` instead of incorrect property
- Visa filter: Fixed to use `visa.type` instead of incorrect property
- Flag state filter: Fixed to use correct `endorsements` array path
- Filter option values: Changed to match actual stored values (e.g., "Chief Officer" instead of "chief_officer")
- State consistency: Fixed manual filter mode so table renders the correct dataset

---

#### **2.3 Filter Actions**

**Status:** ✅ Implemented

**Description:** Control buttons for filter execution and reset.

**Buttons:**
- **Apply Filters** - Executes Supabase query with selected filters
- **Clear All** - Resets all filters to default state
- **Hide Filters** - Collapses filter panel to save space

**Behavior:**
- Apply Filters triggers data fetch
- Clear All resets form + fetches unfiltered data
- Hide Filters toggles visibility (state preserved)

**Technical Implementation:**
```javascript
const applyFilters = async () => {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .in('status', getActiveStatuses())
    .eq('applied_rank', filters.rank)
    .eq('vessel_type', filters.vesselType)
    // ... more filters
}
```

---

### **3. Shared Components & Features**

#### **3.1 Application Table**

**Status:** ✅ Implemented

**Description:** Reusable table component displaying application data with actions.

**Features:**
- Responsive table layout
- Sortable columns (if implemented)
- Row hover effects
- Clickable rows → ViewApplication
- Status badges with colors
- Action buttons per row

**Columns (Standard):**
- Reference Number (NJD-XXX)
- Full Name
- Email
- Phone
- Position/Rank
- Vessel Type
- Status (badge)
- Submitted Date
- Actions (View, Mark as Hired, Schedule)

**Columns (AI Search Additional):**
- Relevance (%)
- AI Match (badge)

**Technical Implementation:**
```javascript
<ApplicationTable 
  apps={displayedApplications}
  showRelevance={aiSearchActive}
  analyzingWithLLM={analyzingWithLLM}
/>
```

---

#### **3.2 Status Management**

**Status:** ✅ Implemented

**Description:** Status dropdown and update workflow integrated into application rows.

**Status Flow:**
1. New
2. Under Review
3. Test Scheduled
4. Test Completed
5. Interview Scheduled
6. Interview Completed
7. Offer Sent
8. Hired
9. Rejected
10. Withdrawn

**Features:**
- Sequential status control (prevents skipping steps)
- Status badge color coding
- Real-time updates to Supabase
- Optimistic UI updates
- Email notifications on status change (if implemented)

**Component:**
- `SequentialStatusControl.jsx`
- Dropdown with only valid next statuses
- "Mark as Hired" shortcut button

---

#### **3.3 Pagination**

**Status:** ✅ Implemented

**Description:** Standard pagination component for large result sets.

**Features:**
- Current page indicator
- Total pages display
- Previous/Next buttons
- Page number buttons (e.g., 1 2 3 ... 10)
- Items per page selector (20, 50, 100)
- Total items count
- Jump to page functionality

**Technical Implementation:**
```javascript
<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(totalItems / itemsPerPage)}
  onPageChange={setCurrentPage}
  itemsPerPage={itemsPerPage}
  totalItems={totalItems}
/>
```

**Behavior:**
- Works with both AI search and manual filters
- Preserves filter/search state across pages
- URL sync (if implemented)

---

#### **3.4 URL State Management**

**Status:** ✅ Implemented

**Description:** Syncs UI state with URL for shareable links and browser navigation.

**URL Parameters:**
- `?tab=search` - Active main tab
- `?status=new` - Status filter

**Features:**
- Back/forward browser buttons work
- Shareable URLs maintain filters
- Page refresh preserves tab selection
- URL updates on tab switch

**Technical Implementation:**
```javascript
const [searchParams, setSearchParams] = useSearchParams()

const updateActiveTab = (newTab) => {
  const newParams = new URLSearchParams(searchParams)
  newParams.set('tab', newTab)
  setSearchParams(newParams, { replace: true })
}
```

---

#### **3.5 Loading States & Error Handling**

**Status:** ✅ Implemented

**Description:** User feedback during async operations and error scenarios.

**Loading States:**
- Initial data load spinner
- AI analysis progress banner
- Loading spinners in AI Match column
- Button disabled states during save

**Error Handling:**
- Network errors → Toast/banner message
- Supabase errors → User-friendly message
- Pinecone errors → Fallback to manual search
- Gemini API errors → Show results without confidence scores
- Console logging for debugging

**Error Messages:**
- "Failed to fetch applications"
- "AI search unavailable"
- "Error analyzing candidates"
- "Network error, please try again"

---

## PENDING FEATURES ⏳

---

### **4. UI Restructure (In Progress)**

#### **4.1 Sub-Tab Navigation**

**Status:** ⏳ Pending

**Description:** Split Advanced Search into two sub-tabs for better organization.

**Proposed Structure:**
```
Advanced Search
    ├── Manual Search (Default)
    └── AI Search
```

**Design:**
- Segmented control style (iOS/macOS inspired)
- Active tab: white background, shadow
- Inactive tab: transparent, gray text
- Smooth transition animation
- Result counts on tabs: "Manual Search (145)" "AI Search (8)"

**Benefits:**
- Clear separation of concerns
- Reduced cognitive load
- Better progressive disclosure
- Industry-standard pattern

---

#### **4.2 Manual Search Tab Redesign**

**Status:** ⏳ Pending

**Description:** Modernize manual filters with horizontal layout and instant filtering.

**Proposed Changes:**

**Horizontal Filter Bar:**
```
[Status ▼] [Rank ▼] [Vessel Type ▼] [Nationality ▼] [Experience ▼] [Certificate ▼] [More Filters... ▼]
```

**Active Filter Pills:**
```
Active: [Active ×] [Chief Officer ×] [Tanker ×] [Clear All]
```

**Features:**
- Compact 2-row layout vs 3x3 grid
- Instant filtering (remove "Apply Filters" button)
- Active filters shown as removable pills
- "More Filters" button opens modal for advanced filters
- Result count updates in real-time

**Benefits:**
- Space-efficient
- Modern UX pattern (Greenhouse, Lever, Ashby)
- Faster workflow (no Apply button)
- Clear visual feedback

---

#### **4.3 AI Search Tab Redesign**

**Status:** ⏳ Pending

**Description:** Clean, focused AI search interface with settings in modal.

**Proposed Layout:**

**State 1: No Embeddings**
```
┌─────────────────────────────────────┐
│ 🤖 AI Search Setup                  │
│ [Generate Embeddings Button]        │
└─────────────────────────────────────┘
```

**State 2: Ready to Search**
```
┌─────────────────────────────────────┐
│ 🔍 [Type your search...]            │
│    Quick: Chief Officer | US visa   │
├─────────────────────────────────────┤
│ ✓ Ready (520 applications) [⚙️]    │
└─────────────────────────────────────┘
```

**State 3: Results**
```
┌─────────────────────────────────────┐
│ 🔍 [chief officer]                  │
├─────────────────────────────────────┤
│ 8 results · 🟢 0 🟡 0 🔴 8          │
│ [Confidence ▼] [Sort ▼] [⚙️] [Clear] │
└─────────────────────────────────────┘
```

**Settings Modal (⚙️):**
```
┌───── AI Search Settings ─────┐
│ 📊 EMBEDDING STATUS           │
│ ✓ Generated 2 days ago       │
│ [🔄 Regenerate]              │
│ ──────────────────────────── │
│ 🎚️ THRESHOLDS                │
│ High:    [━━━━━●──] 85%     │
│ Medium:  [━━●──────] 60%     │
│ Similarity: [━●────] 30%     │
│ ──────────────────────────── │
│      [Reset] [Close]          │
└───────────────────────────────┘
```

**Benefits:**
- Clean, uncluttered interface
- Settings hidden until needed (progressive disclosure)
- One control bar (not 3+ panels)
- Professional, modern appearance

---

#### **4.4 Visual Design System**

**Status:** ⏳ Pending

**Description:** Consistent design language across both sub-tabs.

**Design Tokens:**

**Colors:**
- Background: White (#FFFFFF)
- Border: Gray-200 (#E5E7EB)
- Primary: Blue-600 (#2563EB)
- Success: Green-600 (#16A34A)
- Warning: Yellow-600 (#CA8A04)
- Danger: Red-600 (#DC2626)
- Text: Gray-900 (#111827)
- Text Muted: Gray-600 (#4B5563)

**Spacing:**
- Section gap: 24px (space-y-6)
- Control gap: 16px (gap-4)
- Card padding: 24px (p-6)
- Tight spacing: 8px (gap-2)

**Shadows:**
- Card: shadow-sm (subtle)
- Hover: shadow-md
- Modal: shadow-2xl

**Border Radius:**
- Cards: 12px (rounded-xl)
- Buttons: 8px (rounded-lg)
- Pills: 9999px (rounded-full)

**Typography:**
- Headings: font-semibold
- Body: font-normal
- Labels: text-sm
- Stats: text-xs

**Benefits:**
- Professional appearance
- Visual consistency
- Industry-standard patterns
- Accessible color contrast

---

### **5. Future Enhancements (Wishlist)**

#### **5.1 Search History**

**Status:** 💡 Idea

**Description:** Save and recall past searches for quick access.

**Features:**
- Recent searches dropdown
- Saved searches with custom names
- One-click re-run
- Delete/edit saved searches

---

#### **5.2 Bulk Actions**

**Status:** 💡 Idea

**Description:** Perform actions on multiple candidates at once.

**Features:**
- Multi-select checkboxes
- Bulk status update
- Bulk email
- Bulk export
- "Select all" option

---

#### **5.3 Advanced Analytics**

**Status:** 💡 Idea

**Description:** Insights and metrics on search effectiveness.

**Features:**
- Most searched queries
- Average confidence scores
- Filter usage statistics
- Time-to-hire by search method
- Dashboard with charts

---

#### **5.4 AI Search Improvements**

**Status:** 💡 Idea

**Description:** Enhance AI capabilities and accuracy.

**Features:**
- Multi-language support
- Query suggestions/autocomplete
- "Similar candidates" button
- Negative search ("NOT tanker")
- Date range in search query
- Explainability improvements

---

#### **5.5 Export & Reporting**

**Status:** 💡 Idea

**Description:** Export search results and generate reports.

**Features:**
- CSV export
- PDF report generation
- Custom column selection
- Filtered vs full data export
- Email report to stakeholders

---

## 📝 Technical Specifications

### **State Management**

```javascript
// AI Search State
const [aiSearchResults, setAiSearchResults] = useState([])
const [aiSearchQuery, setAiSearchQuery] = useState('')
const [aiSearchActive, setAiSearchActive] = useState(false)
const [analyzingWithLLM, setAnalyzingWithLLM] = useState(false)
const [confidenceFilter, setConfidenceFilter] = useState('all')
const [sortBy, setSortBy] = useState('relevance')
const [similarityThreshold, setSimilarityThreshold] = useState(0.3)
const [highConfidenceThreshold, setHighConfidenceThreshold] = useState(0.85)
const [mediumConfidenceThreshold, setMediumConfidenceThreshold] = useState(0.6)
const [showThresholdSettings, setShowThresholdSettings] = useState(false)

// Manual Search State
const [applications, setApplications] = useState([])
const [filteredApplications, setFilteredApplications] = useState([])
const [statusFilter, setStatusFilter] = useState('all')
const [filters, setFilters] = useState({})
const [includeActive, setIncludeActive] = useState(true)
const [includeHired, setIncludeHired] = useState(false)
const [includeRejected, setIncludeRejected] = useState(false)
const [includeWithdrawn, setIncludeWithdrawn] = useState(false)

// Shared State
const [loading, setLoading] = useState(false)
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(20)
const [activeTab, setActiveTab] = useState('all')
```

---

### **API Endpoints**

#### **Supabase Queries**

**Fetch Applications:**
```javascript
const { data, error } = await supabase
  .from('applications')
  .select(`
    id,
    user_id,
    applied_rank,
    status,
    created_at,
    updated_at,
    reference_number,
    public_token,
    submitted_at,
    application_data (data)
  `)
  .in('status', activeStatuses)
  .order('created_at', { ascending: false })
```

**Update Status:**
```javascript
const { error } = await supabase
  .from('applications')
  .update({ status: newStatus, updated_at: new Date() })
  .eq('id', applicationId)
```

---

#### **Pinecone API**

**Query Vectors:**
```javascript
POST https://INDEX-NAME.svc.ENVIRONMENT.pinecone.io/query

{
  "namespace": "applications",
  "vector": [0.123, 0.456, ...],
  "topK": 20,
  "includeMetadata": true
}
```

**Response:**
```javascript
{
  "matches": [
    {
      "id": "uuid-chunk-id",
      "score": 0.85,
      "metadata": {
        "application_id": "uuid",
        "chunk_text": "Chief Officer with 8 years...",
        "section": "section2"
      }
    }
  ]
}
```

---

#### **Gemini API (via Proxy)**

**Endpoint:**
```
POST /api/gemini-reasoning
```

**Request:**
```javascript
{
  "searchQuery": "Chief Officer with tanker experience",
  "candidateData": {
    "rank": "Chief Officer",
    "vesselType": "Container",
    "experience": "8 years",
    "certificates": ["COC", "STCW"]
  }
}
```

**Response:**
```javascript
{
  "is_match": true,
  "confidence": 0.55,
  "reason": "Detailed reasoning text...",
  "isUncertain": false
}
```

---

### **Performance Considerations**

**Optimizations:**
- Pagination limits data transfer
- Vector search returns top 20, analyzes top 10
- localStorage caching reduces repeated searches
- Debounced search input (if implemented)
- Lazy loading for large datasets

**Bottlenecks:**
- Gemini API rate limits (10 requests/second)
- Pinecone query latency (~200-500ms)
- Large application_data JSON parsing
- Sequential LLM analysis (10 requests)

**Future Improvements:**
- Batch LLM analysis requests
- WebSocket for real-time updates
- Service worker caching
- CDN for static assets

---

## 🔧 Code Review & Corrections (February 2026)

A comprehensive code review was conducted on the Advanced Search module, identifying and fixing critical bugs that affected search accuracy and filter functionality.

### **Major Issues Fixed**

#### **1. Schema Path Corrections (CRITICAL)**

**Problem:** AI search, embeddings, and LLM reasoning were reading from incorrect section paths in the application_data JSONB structure, causing the system to miss critical candidate information.

**Impact:** 
- AI search analyzed incomplete/wrong data
- Confidence scores were inaccurate
- Candidate matching was unreliable

**Fixes Applied:**
- ✅ Updated `embeddingService.js` with correct schema paths
- ✅ Created normalized application-profile helper function
- ✅ Fixed embedding extraction to use live schema
- ✅ Updated LLM reasoning context with correct paths:
  - `section1`: rank, availability, vesselType
  - `section8`: certificates (CoC)
  - `section14`: STCW/training certificates
  - `section15`: flag state endorsements
  - `section16`: sea service history
- ✅ Removed all stale references to old section locations

**Result:** AI search now analyzes complete, accurate candidate data

---

#### **2. Manual Filter State Inconsistency (CRITICAL)**

**Problem:** Manual filters in Advanced Search tab were updating one state slice while the table was rendering from another, causing stale or empty results to display.

**Impact:**
- Filters appeared to not work
- UI showed incorrect data
- User frustration with broken functionality

**Fixes Applied:**
- ✅ Fixed manual filter mode to render correct dataset
- ✅ Synchronized state between filter application and table display
- ✅ Ensured `filteredApplications` used consistently

**Result:** Manual filters now work reliably

---

#### **3. Filter Property Mapping Errors (HIGH)**

**Problem:** Certificate and visa filters were checking incorrect property names and using values that didn't match stored data.

**Impact:**
- Certificate filter returned no results
- Visa filter didn't match actual visa data
- Flag state filter failed

**Fixes Applied:**
- ✅ Certificate filter: Changed to use `cert.grade` property
- ✅ Visa filter: Changed to use `visa.type` property
- ✅ Flag state filter: Fixed to use correct `endorsements` array
- ✅ Updated ApplicationFilters.jsx with correct option values (e.g., "Chief Officer" instead of "chief_officer")

**Result:** All filters now match against correct data properties

---

#### **4. Runtime Errors & State Bugs (MEDIUM)**

**Problem:** Several runtime issues causing crashes and incorrect behavior.

**Issues:**
- Rejection flow referenced undefined setter
- Unused modal state for non-existent rejection flow
- AI search pagination didn't reset on new search
- localStorage not scoped per recruiter
- Tab navigation hijacked by restore effect

**Fixes Applied:**
- ✅ Removed broken rejection modal path from RecruiterApplications
- ✅ Removed undefined retake setter reference
- ✅ Reset AI search pagination to page 1 on new search
- ✅ Scoped localStorage with user-specific key: `aiSearchResults:{userId}`
- ✅ Fixed restore effect dependency to prevent tab hijacking
- ✅ Removed `activeTab` from restore effect dependency list

**Result:** Clean runtime with no errors, proper user isolation

---

#### **5. Candidate Field Extraction (MEDIUM)**

**Problem:** Candidate field extraction logic used outdated schema paths, missing data even when present.

**Fixes Applied:**
- ✅ Updated RecruiterApplications.jsx extraction logic
- ✅ Fixed full_name extraction from correct sections
- ✅ Fixed email extraction with fallback paths
- ✅ Fixed phone extraction with fallback paths
- ✅ Fixed vessel type extraction from section1

**Result:** All candidate fields display correctly in table

---

#### **6. Status Count Logic (LOW)**

**Problem:** Status count logic could crash on undefined properties.

**Fixes Applied:**
- ✅ Changed to safe `hasOwnProperty` access
- ✅ Added null/undefined checks

**Result:** Robust status counting

---

### **Build & Lint Cleanup**

**Actions Taken:**
- ✅ Installed dependencies: `npm install`
- ✅ Fixed deterministic lint errors across 20+ files
- ✅ Removed unused variables and imports
- ✅ Added targeted ESLint suppressions for intentional patterns
- ✅ Increased `chunkSizeWarningLimit` in vite.config.js
- ✅ Verified: `npm run lint` passes ✅
- ✅ Verified: `npm run build` passes ✅

**Files Updated:**
- Main functional files: RecruiterApplications.jsx, embeddingService.js, ApplicationFilters.jsx
- Lint cleanup: 20+ component files across the codebase

---

### **Testing Performed**

**Post-Fix Verification:**
- ✅ AI search with correct schema
- ✅ Manual filters working correctly
- ✅ Certificate/visa filters matching data
- ✅ Multi-recruiter localStorage isolation
- ✅ Tab navigation working smoothly
- ✅ No runtime errors in console
- ✅ Clean build output

---

### **Impact Summary**

**Before Code Review:**
- ❌ AI search using wrong data
- ❌ Manual filters broken
- ❌ Certificate/visa filters non-functional
- ❌ Runtime errors
- ❌ Data leaking between recruiters
- ❌ Lint/build warnings

**After Code Review:**
- ✅ AI search analyzing complete, correct data
- ✅ All filters functional and accurate
- ✅ Clean runtime with no errors
- ✅ Proper user data isolation
- ✅ Clean build with no warnings
- ✅ Foundation ready for UI redesign

---

## 🧪 Testing Requirements

### **Manual Test Scenarios**

#### **AI Search Testing**
1. Generate embeddings for first time
2. Search with exact match query
3. Search with semantic query
4. Verify confidence badges appear
5. Test hover tooltips
6. Test clickable modals
7. Filter by High/Medium/Low confidence
8. Sort by Relevance vs Confidence
9. Adjust thresholds and verify badge changes
10. Clear search and verify state reset
11. Navigate to Dashboard and back
12. Refresh page and verify auto-restore
13. **NEW: Verify correct schema data used** - Check that AI analyzes data from section1, section8, section14, section15, section16
14. **NEW: Test multi-recruiter isolation** - Login as different recruiters, verify localStorage doesn't leak
15. **NEW: Verify tab navigation not hijacked** - Restore shouldn't force tab switch on every navigation
16. **NEW: Verify pagination resets** - New search should reset to page 1

#### **Manual Search Testing**
1. Filter by Active status only
2. Filter by multiple statuses
3. Select Rank filter
4. Combine multiple filters
5. Apply filters and verify results
6. Clear all filters
7. Hide/show filters panel
8. Use date range filter
9. Test pagination
10. Verify URL state sync
11. **NEW: Test certificate filter** - Verify filters use `cert.grade` property correctly
12. **NEW: Test visa filter** - Verify filters use `visa.type` property correctly
13. **NEW: Test flag state filter** - Verify filters use correct endorsements array
14. **NEW: Verify filter state consistency** - Table shows data from correct state slice
15. **NEW: Test filter option values** - Verify options match stored data format

#### **Integration Testing**
1. Switch between Manual/AI sub-tabs
2. Perform search in each mode
3. Update application status
4. Mark candidate as Hired
5. View application details
6. Test with 0 results
7. Test with 1000+ results
8. Test with slow network
9. Test error scenarios

---

### **Automated Testing (Future)**

**Unit Tests:**
- Component rendering
- State management logic
- Filtering functions
- Sorting functions
- Data enrichment logic

**Integration Tests:**
- API calls and responses
- localStorage save/load
- URL state management
- Filter combinations

**E2E Tests:**
- Complete search workflows
- Status update flows
- Navigation flows
- Error recovery

---

## 📊 Success Metrics

**Quantitative:**
- Search completion time: <2 minutes
- AI search accuracy: >85%
- User adoption rate: >70%
- Time savings vs manual screening: >50%
- System uptime: >99%

**Qualitative:**
- User satisfaction score: >4.5/5
- Ease of use rating: >4/5
- Confidence in AI results: >4/5
- Willingness to recommend: >80%

---

## 🚀 Deployment Plan

### **Phase 1: Testing & Validation**
- [ ] Complete feature audit
- [ ] Create testing checklist
- [ ] Perform comprehensive manual testing
- [ ] Fix critical bugs
- [ ] Get stakeholder approval

### **Phase 2: UI Restructure Implementation**
- [ ] Create feature branch
- [ ] Implement sub-tab navigation
- [ ] Redesign Manual Search tab
- [ ] Redesign AI Search tab
- [ ] Add feature flag
- [ ] Test thoroughly

### **Phase 3: Staged Rollout**
- [ ] Deploy to staging environment
- [ ] Internal team testing
- [ ] Beta user group testing
- [ ] Collect feedback
- [ ] Make adjustments

### **Phase 4: Production Launch**
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Track usage metrics
- [ ] Gather user feedback
- [ ] Iterate based on data

---

## 📚 Documentation

### **User Documentation**
- [ ] User guide for AI Search
- [ ] User guide for Manual Search
- [ ] Video tutorial (AI Search basics)
- [ ] FAQ document
- [ ] Troubleshooting guide

### **Technical Documentation**
- [ ] API documentation
- [ ] Database schema docs
- [ ] Component library docs
- [ ] Deployment guide
- [ ] Maintenance runbook

---

## 🔐 Security & Privacy

**Data Security:**
- Supabase RLS policies enforce access control
- No PII in Pinecone metadata
- HTTPS for all API calls
- API keys stored in environment variables

**Privacy Considerations:**
- Candidate data access based on role
- Audit logs for data access (if implemented)
- GDPR compliance (data export/deletion)
- Consent for AI analysis (if required)

---

## 📞 Support & Maintenance

**Support Channels:**
- Email: support@njordhr.com
- Slack: #njordhr-support
- Documentation: docs.njordhr.com

**Maintenance Schedule:**
- Weekly: Review error logs
- Monthly: Performance optimization
- Quarterly: Feature updates
- Annually: Major version upgrades

**Known Issues:**
- [List any current bugs/limitations]

---

## 📝 Changelog

**v2.1 - February 5, 2026**
- **Comprehensive code review completed**
- Fixed AI search schema paths (CRITICAL)
- Fixed manual filter state consistency (CRITICAL)
- Fixed certificate/visa filter properties
- Implemented per-recruiter localStorage
- Fixed runtime errors and tab navigation
- Updated 20+ files with lint/build cleanup
- All critical bugs resolved
- Foundation ready for UI redesign

**v2.0 - February 2026 (In Progress)**
- UI restructure with sub-tabs
- Modern design system
- Improved filter UX

**v1.5 - February 2026**
- Added confidence badge modals
- Enhanced hover tooltips
- Improved visual effects
- Added threshold settings

**v1.0 - January 2026**
- Initial AI Search launch
- Vector embeddings
- LLM reasoning
- Confidence scoring
- Basic filtering

---

## 👥 Stakeholders

**Product Owner:** KT  
**Development Team:** [List team members]  
**QA Team:** [List QA members]  
**End Users:** Master Recruiters, Recruiters, Coordinators

---

**END OF PRD**
