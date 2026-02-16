/**
 * Natural Language Parser for navigation commands
 * Extracts start and destination from natural language input
 * 
 * Supported patterns:
 * - "Take me to X from Y"
 * - "Navigate from X to Y"
 * - "Go to X"
 * - "How to reach X from Y"
 * - "Find path from X to Y"
 * - "Directions to X from Y"
 * - "X to Y"
 */

const PATTERNS = [
    /take\s+me\s+to\s+(.+?)\s+from\s+(.+)/i,
    /navigate\s+(?:me\s+)?from\s+(.+?)\s+to\s+(.+)/i,
    /(?:find|get|show)\s+(?:the\s+)?(?:path|route|way|directions?)\s+from\s+(.+?)\s+to\s+(.+)/i,
    /(?:how\s+(?:to|do\s+I)\s+)?(?:get|go|reach|walk)\s+(?:to\s+)?(.+?)\s+from\s+(.+)/i,
    /directions?\s+(?:to|for)\s+(.+?)\s+from\s+(.+)/i,
    /from\s+(.+?)\s+to\s+(.+)/i,
    /(.+?)\s+to\s+(.+)/i,
];

const GO_TO_PATTERNS = [
    /(?:take\s+me|go|navigate|walk|head)\s+to\s+(.+)/i,
    /(?:find|where\s+is|locate|search)\s+(.+)/i,
    /(?:how\s+to\s+reach)\s+(.+)/i,
];

export function parseNavigation(input) {
    if (!input || typeof input !== 'string') return null;
    const text = input.trim();

    // Try start+destination patterns first
    for (const pattern of PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            // "take me to X from Y" → dest=X, start=Y
            if (pattern === PATTERNS[0] || pattern === PATTERNS[3] || pattern === PATTERNS[4]) {
                return { destination: match[1].trim(), start: match[2].trim() };
            }
            return { start: match[1].trim(), destination: match[2].trim() };
        }
    }

    // Try destination-only patterns
    for (const pattern of GO_TO_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return { destination: match[1].trim(), start: null };
        }
    }

    // If nothing matched, treat entire input as destination search
    return { destination: text, start: null };
}

/**
 * Find best matching node by name (fuzzy)
 */
export function findBestMatch(query, nodes) {
    if (!query || !nodes.length) return null;
    const q = query.toLowerCase().trim();

    // Exact match
    let match = nodes.find(n => n.name.toLowerCase() === q);
    if (match) return match;

    // Starts with
    match = nodes.find(n => n.name.toLowerCase().startsWith(q));
    if (match) return match;

    // Contains
    match = nodes.find(n => n.name.toLowerCase().includes(q));
    if (match) return match;

    // Fuzzy: any word match
    const words = q.split(/\s+/);
    match = nodes.find(n => words.every(w => n.name.toLowerCase().includes(w)));
    if (match) return match;

    return null;
}
