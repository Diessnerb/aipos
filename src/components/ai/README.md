# AI Components - Phase 1: Smart Contextual Interface

This folder contains intelligent AI components that provide contextual, proactive assistance throughout the application.

## Components

### 1. AIOrb
A floating animated AI presence that replaces the basic chat button.

**Features:**
- Pulsing animation with glow effect
- Context-aware colors (blue for help, green for suggestions, orange for alerts)
- Notification badge for pending suggestions
- Thinking indicator when processing

**Usage:**
```tsx
import { AIOrb } from '@/components/ai/AIOrb';

<AIOrb
  onClick={() => setIsOpen(true)}
  mode="suggestion"  // 'default' | 'suggestion' | 'alert'
  hasSuggestions={true}
  isThinking={false}
/>
```

### 2. AIInlineSuggestion
Contextual AI suggestions that appear inline within workflows.

**Features:**
- Slide-in animation
- Variant-based styling (info, suggestion, alert)
- Optional "Apply" action
- Dismissible

**Usage:**
```tsx
import { AIInlineSuggestion } from '@/components/ai/AIInlineSuggestion';

<AIInlineSuggestion
  message="I notice this customer usually prefers window tables"
  variant="suggestion"
  onAccept={() => applyTablePreference()}
  onDismiss={() => setShowSuggestion(false)}
/>
```

### 3. AIProactiveHelp
Smart tooltips that automatically appear to guide users through complex features.

**Features:**
- Auto-show with configurable delay
- Indicator dot for unread tips
- "Learn more" callback for deeper AI assistance
- Wraps any trigger element

**Usage:**
```tsx
import { AIProactiveHelp } from '@/components/ai/AIProactiveHelp';

<AIProactiveHelp
  trigger={<Input placeholder="Customer name" />}
  helpText="Enter the customer's name and I'll check if they have preferences from previous visits."
  autoShow={true}
  autoShowDelay={2000}
  onLearnMore={() => openAIChat()}
/>
```

### 4. AIAssistant
Enhanced universal chat widget with the new AI Orb.

**Features:**
- Streaming responses
- Context-aware system prompts
- Message history
- Error handling with toasts

### 5. ReservationAIHelper
Example implementation showing AI integration in the reservations workflow.

**Features:**
- Automatic suggestions for large parties
- Customer preference detection
- Smart table recommendations
- Proactive help on form fields

## Design System

### AI Colors (defined in index.css)
```css
--ai-primary: 217.2 91.2% 59.8%;     /* Blue - default help */
--ai-suggestion: 142.1 76.2% 36.3%;  /* Green - suggestions */
--ai-alert: 25.2 95% 53.5%;          /* Orange - alerts */
--ai-glow: 217.2 91.2% 59.8%;        /* Blue - glow effect */
```

### Animations
- `animate-ai-pulse` - Pulsing scale animation
- `animate-ai-glow` - Glowing shadow animation
- `animate-slide-in-up` - Slide up with fade in

## Integration Examples

### In Reservations Page:
```tsx
import { ReservationAIHelper } from '@/components/ai/ReservationAIHelper';

<ReservationAIHelper
  customerName={customerName}
  partySize={partySize}
  selectedDate={selectedDate}
  selectedTime={selectedTime}
  onSuggestionApply={(suggestion) => applyAISuggestion(suggestion)}
/>
```

### In Inventory Page:
```tsx
<AIInlineSuggestion
  message="You're running low on salmon. Shall I suggest alternative menu items?"
  variant="alert"
  onAccept={() => showAlternatives()}
/>
```

### In Customer Page:
```tsx
<AIProactiveHelp
  trigger={<Button>Send Message</Button>}
  helpText="I can help you draft a personalized message based on this customer's preferences and history."
  onLearnMore={() => openAIDraft()}
/>
```

## Next Steps (Phase 2)

Phase 2 will focus on **Company Data Security**:
- Database-scoped AI context
- Company-specific memory
- Data isolation validation
- RLS enforcement in AI queries

## Next Steps (Phase 3)

Phase 3 will add **Advanced AI Integration**:
- Voice commands
- Smart quick actions
- Deep workflow integration
- Predictive suggestions
