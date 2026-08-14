export const MAX_SIMILARITY_CANDIDATES = 15;
export function normalizeSimilarityText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
function relevanceScore(description, candidate) {
    const normalizedDescription = normalizeSimilarityText(description);
    const normalizedCandidate = normalizeSimilarityText(candidate.description);
    const queryTokens = normalizedDescription.split(' ').filter(Boolean);
    const candidateTokens = new Set(normalizedCandidate.split(' ').filter(Boolean));
    let score = normalizedDescription === normalizedCandidate ? 12 : 0;
    if (normalizedCandidate.includes(normalizedDescription))
        score += 4;
    for (const token of queryTokens) {
        if (candidateTokens.has(token)) {
            score += /\d/.test(token) ? 4 : 3;
            continue;
        }
        if (token.length >= 4 && [...candidateTokens].some((candidateToken) => candidateToken.length >= 4 && (candidateToken.startsWith(token) || token.startsWith(candidateToken)))) {
            score += 1;
        }
    }
    return score;
}
function stableCandidateOrder(left, right) {
    const leftKey = `${normalizeSimilarityText(left.description)}\u0000${left.code}\u0000${left.id ?? ''}`;
    const rightKey = `${normalizeSimilarityText(right.description)}\u0000${right.code}\u0000${right.id ?? ''}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
export function prefilterSimilarityCandidates(description, stockId, catalog) {
    const scoped = catalog.filter((candidate) => candidate.stockId === stockId);
    const ranked = scoped
        .map((candidate) => ({ candidate, score: relevanceScore(description, candidate) }))
        .sort((left, right) => right.score - left.score || stableCandidateOrder(left.candidate, right.candidate));
    if (scoped.length <= MAX_SIMILARITY_CANDIDATES) {
        return ranked.map(({ candidate }) => candidate);
    }
    return ranked
        .filter(({ score }) => score > 0)
        .slice(0, MAX_SIMILARITY_CANDIDATES)
        .map(({ candidate }) => candidate);
}
//# sourceMappingURL=similarity-candidate-prefilter.js.map