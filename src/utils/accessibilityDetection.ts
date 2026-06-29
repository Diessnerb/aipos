import { Reservation } from '@/types/reservation';

export interface AccessibilityAnalysis {
  needsAccessible: boolean;
  avoidHighTop: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  matched: string[];
}

/**
 * Analyzes reservation notes for accessibility needs and seating preferences
 * Uses fuzzy matching and negation detection for robust analysis
 */
export function analyzeAccessibilityNotes(notes: string): AccessibilityAnalysis {
  if (!notes || typeof notes !== 'string') {
    return {
      needsAccessible: false,
      avoidHighTop: true, // Default to meal seating
      confidence: 'none',
      reasons: [],
      matched: []
    };
  }

  const normalizedNotes = notes.toLowerCase().trim();
  const matched: string[] = [];
  const reasons: string[] = [];
  
  // High-confidence accessibility keywords (explicit needs)
  const highAccessibilityTerms = [
    'wheelchair', 'wheel chair', 'mobility scooter', 'disabled access', 
    'wheelchair user', 'ramp needed', 'cannot walk', "can't walk", 
    'unable to walk', 'walker needed', 'rollator'
  ];
  
  // Medium-confidence accessibility indicators
  const mediumAccessibilityTerms = [
    'difficulty walking', 'walking issues', 'walking difficulties',
    'walker', 'crutches', 'bad knee', 'bad hip', 'knee problems', 'hip problems',
    'near entrance', 'no stairs', 'ground floor', 'limited mobility',
    'mobility issues', 'assistance needed', 'special assistance'
  ];
  
  // Bar/high-top preference indicators
  const barHighTopTerms = [
    'bar', 'high top', 'tall table', 'drinks only', 'bar seating',
    'cocktails', 'standing', 'bar snacks', 'quick drink'
  ];
  
  // Meal/dining preference (reinforces avoiding high-top)
  const mealDiningTerms = [
    'meal', 'dining', 'dinner', 'lunch', 'full menu', 'restaurant seating',
    'low table', 'proper seating', 'sit down meal'
  ];
  
  // Negation words within proximity
  const negationWords = ['no', 'not', 'without', "don't", "doesn't", "isn't", 'never'];
  
  let accessibilityScore = 0;
  let highTopPreference = false;
  let avoidHighTop = true; // Default for meals
  
  // Helper function to check for negation within 3 words
  function isNegated(match: RegExpMatchArray): boolean {
    const matchStart = match.index || 0;
    const beforeMatch = normalizedNotes.substring(Math.max(0, matchStart - 30), matchStart);
    const words = beforeMatch.split(/\s+/).slice(-3); // Last 3 words before match
    return negationWords.some(neg => words.some(word => word.includes(neg)));
  }
  
  // Check high accessibility terms
  for (const term of highAccessibilityTerms) {
    const regex = new RegExp(`\\b${term.replace(/'/g, "['']?")}\\b`, 'gi');
    const matches = Array.from(normalizedNotes.matchAll(regex));
    
    for (const match of matches) {
      if (!isNegated(match)) {
        accessibilityScore += 10;
        matched.push(term);
        reasons.push(`High confidence: "${match[0]}"`);
      } else {
        reasons.push(`Negated: "no ${match[0]}"`);
      }
    }
  }
  
  // Check medium accessibility terms
  for (const term of mediumAccessibilityTerms) {
    const regex = new RegExp(`\\b${term.replace(/'/g, "['']?")}\\b`, 'gi');
    const matches = Array.from(normalizedNotes.matchAll(regex));
    
    for (const match of matches) {
      if (!isNegated(match)) {
        accessibilityScore += 5;
        matched.push(term);
        reasons.push(`Medium confidence: "${match[0]}"`);
      }
    }
  }
  
  // Check bar/high-top preferences
  for (const term of barHighTopTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(normalizedNotes)) {
      highTopPreference = true;
      avoidHighTop = false;
      matched.push(term);
      reasons.push(`Bar/high-top preference: "${term}"`);
    }
  }
  
  // Check meal/dining preferences (reinforces avoiding high-top)
  for (const term of mealDiningTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(normalizedNotes)) {
      avoidHighTop = true;
      matched.push(term);
      reasons.push(`Dining preference: "${term}"`);
    }
  }
  
  // Determine confidence and need
  let needsAccessible = false;
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  
  if (accessibilityScore >= 10) {
    needsAccessible = true;
    confidence = 'high';
  } else if (accessibilityScore >= 5) {
    needsAccessible = true;
    confidence = 'medium';
  } else if (accessibilityScore >= 2) {
    needsAccessible = false; // Low confidence treated as hint only
    confidence = 'low';
  }
  
  return {
    needsAccessible,
    avoidHighTop: !highTopPreference, // If they want bar/high-top, don't avoid it
    confidence,
    reasons,
    matched
  };
}

/**
 * Convenience function for simple accessibility detection
 * Returns the same interface as the existing detectAccessibilityNeeds for compatibility
 */
export function detectAccessibilityNeeds(reservation: Reservation): { needsAccessible: boolean; confidence: 'high' | 'medium' | 'low' | 'none' } {
  const analysis = analyzeAccessibilityNotes(reservation.notes || '');
  return {
    needsAccessible: analysis.needsAccessible,
    confidence: analysis.confidence
  };
}