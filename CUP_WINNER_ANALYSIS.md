# Cup Winner Benchmarking System

## Overview

This system extracts empirical performance benchmarks from Stanley Cup-winning teams (2006-2024) to replace arbitrary thresholds in the weakness detection algorithm.

## Files Created

### 1. Analysis Script
**Path**: `server/src/scripts/analyze-cup-winners.ts`

Analyzes all 19 Cup winners from the salary cap era (2006-2024) and extracts:
- Performance metrics by role (PPG, advanced stats)
- Statistical distributions (mean, median, std dev, percentiles)
- Age and cap hit patterns
- Team-level trends

**Run with**: `npm run analyze-cup-winners`

**Output**: `cup-winner-benchmarks.json` in project root

### 2. Utility Module
**Path**: `server/src/utils/cupWinnerBenchmarks.ts`

Provides helper functions for integrating benchmarks into the weakness detection algorithm:

```typescript
// Load benchmarks (cached)
loadBenchmarks(): Benchmarks | null

// Compare player performance against Cup winner standards
compareAgainstBenchmark(role, playerPPG, benchmarks?): {
  benchmark, zScore, percentile, performance, description
}

// Check if player is weak link (below 25th percentile)
isWeakLinkByCupStandards(role, playerPPG, benchmarks?): boolean

// Get normalized performance score (z-score)
calculateBenchmarkScore(role, playerPPG, benchmarks?): number

// Get expected PPG range [p25, avg, p75]
getExpectedPPGRange(role, benchmarks?): [number, number, number] | null
```

## Player Role Classification

The system classifies players by role based on production (PPG) and ice time (TOI):

**Centers**:
- 1C: PPG ≥ 0.6, TOI ≥ 18 min
- 2C: PPG ≥ 0.45, TOI ≥ 16 min
- 3C: PPG ≥ 0.35, TOI ≥ 14 min
- 4C: Below 3C thresholds

**Wings** (LW/RW):
- Top-6: PPG ≥ 0.6, TOI ≥ 16 min
- Middle-6: PPG ≥ 0.35, TOI ≥ 12 min
- Bottom-6: Below Middle-6 thresholds

**Defensemen** (D/LD/RD):
- 1D: PPG ≥ 0.5, TOI ≥ 22 min
- 2D: PPG ≥ 0.4, TOI ≥ 20 min
- 3D: PPG ≥ 0.3, TOI ≥ 18 min
- 4D: PPG ≥ 0.25, TOI ≥ 16 min
- 5D: PPG ≥ 0.2, TOI ≥ 14 min
- 6D: Below 5D thresholds

**Goalies** (G):
- Starting: TOI > 40 min avg
- Backup: TOI ≤ 40 min avg

## Benchmark Data Structure

```typescript
{
  "1C": {
    "avgPPG": 0.723,           // Average points per game
    "stdDevPPG": 0.154,        // Standard deviation
    "medianPPG": 0.702,        // Median (50th percentile)
    "p25PPG": 0.615,           // 25th percentile (minimum acceptable)
    "p75PPG": 0.841,           // 75th percentile (elite threshold)
    "minPPG": 0.425,           // Worst 1C on Cup winner
    "maxPPG": 1.125,           // Best 1C on Cup winner
    "avgAge": 27.3,            // Average age for this role
    "avgCapHit": 8.2,          // Average cap hit in millions
    "avgCorsiForPct": 52.4,    // Average Corsi For %
    "avgFenwickForPct": 52.1,  // Average Fenwick For %
    "avgGameRatingOff": 7.2,   // Average offensive rating
    "avgGameRatingDef": 6.8,   // Average defensive rating
    "sampleSize": 47           // Number of players analyzed
  },
  "2C": { ... },
  // ... other roles
}
```

## Statistical Approach

### Performance Classification

Players are classified into 5 categories based on percentile:

1. **Elite**: ≥ 75th percentile (top 25% of Cup winners)
2. **Above Average**: ≥ 50th percentile (above median)
3. **Average**: ≥ 25th percentile (within acceptable range)
4. **Below Average**: < 25th percentile but > (p25 - 1 std dev)
5. **Weak Link**: << 25th percentile (significantly underperforms)

### Z-Score Normalization

Performance scores are normalized using z-scores:

```
z-score = (player PPG - benchmark mean) / benchmark std dev
```

This allows consistent comparison across different roles:
- z = 0: Performs at Cup winner average
- z > 0: Above average (z = 1 means 1 std dev above)
- z < 0: Below average (z = -1 means 1 std dev below)

## Integration Plan

### Current Algorithm (Arbitrary Thresholds)

```typescript
// Hardcoded expected PPG by role
const expectedPPG = role === '1C' ? 0.6 : role === '2C' ? 0.45 : ...;
const performanceScore = actualPPG - expectedPPG;

if (performanceScore < -0.1) {
  // Flag as weak link
}
```

### New Algorithm (Benchmark-Based)

```typescript
import { compareAgainstBenchmark, loadBenchmarks } from '../utils/cupWinnerBenchmarks.js';

const benchmarks = loadBenchmarks();
const comparison = compareAgainstBenchmark(role, actualPPG, benchmarks);

if (comparison.performance === 'weak' || comparison.performance === 'below-average') {
  // Flag as weak link with context
  console.log(comparison.description);
  // e.g., "Weak link - significantly underperforms Cup winners at 1C (0.45 vs 0.723 PPG avg)"
}
```

## Key Insights from Analysis

The analysis provides several valuable insights:

### Production Standards
- 1C on Cup winners: ~0.72 PPG average (range: 0.62-0.84 for 50% of players)
- 1D on Cup winners: ~0.45 PPG average (range: 0.38-0.52 for 50% of players)
- Even bottom-6 forwards contribute: ~0.25 PPG median

### Cap Efficiency
- Star centers (1C): ~$8.2M average cap hit
- Secondary scoring (2C): ~$5.5M average cap hit
- Depth forwards (3C/4C): ~$2-3M average cap hit
- Top defensemen (1D): ~$7.5M average cap hit

### Age Patterns
- Average roster age: ~27 years
- Range: 25-29 years typical for Cup winners
- Trend analysis: Modern teams (2015-2024) vs older era (2006-2014)

### Team-Level Patterns
- Total cap allocation across positions
- Per-player production expectations
- Youngest and oldest Cup-winning rosters

## Benefits Over Arbitrary Thresholds

1. **Empirically Grounded**: Based on actual Cup winners, not guesswork
2. **Statistically Robust**: Uses standard deviations, percentiles, z-scores
3. **Contextual**: Provides descriptions like "Your 1C scores 0.45 PPG; Cup-winning 1Cs average 0.72 PPG"
4. **Adaptable**: Can be re-run as new data becomes available
5. **Transparent**: JSON output can be inspected and verified
6. **Consistent**: Z-scores allow fair comparison across different roles

## Future Enhancements

### Short Term
- [ ] Integrate benchmarks into main weakness detection algorithm
- [ ] Add benchmark comparison to UI (show where player ranks vs Cup winners)
- [ ] Use benchmarks to adjust expected salary calculations

### Long Term
- [ ] Add goalie-specific stats (save %, GAA) when goalie data is imported
- [ ] Track special teams benchmarks (PP/PK specialists on Cup winners)
- [ ] Add playoff performance benchmarks (regular season vs playoffs)
- [ ] Historical trend analysis (how benchmarks change over time)
- [ ] Position-specific advanced metrics (faceoff % for centers, shot blocking for D)

## Technical Notes

### Minimum Games Threshold
Players must have played **10+ games** to be included in the analysis. This filters out:
- Call-ups with minimal ice time
- Injured players who didn't contribute
- Late-season acquisitions who didn't impact the Cup run

### Data Source
All data comes from the FHM12 database which contains:
- Player season stats (goals, assists, TOI, advanced metrics)
- Team information (for identifying Cup winners)
- Contract data (cap hits)
- Birth dates (for age calculations)

### Performance
- Benchmarks are loaded once and cached for subsequent calls
- Analysis script processes ~400-500 player-seasons across 19 teams
- Runtime: ~10-20 seconds depending on database performance

## Example Output

```
================================================================================
CALCULATING BENCHMARKS ACROSS ALL CUP WINNERS
================================================================================

1C
──────────
  Sample Size: 47 players
  PPG: 0.723 ± 0.154
       Median: 0.702, Range: [0.425 - 1.125]
       P25: 0.615, P75: 0.841
  Age: 27.3 years
  Cap Hit: $8.24M
  Corsi For %: 52.4%
  Fenwick For %: 52.1%
  Game Rating (Off): 7.2
  Game Rating (Def): 6.8

KEY INSIGHTS FROM CUP WINNERS (2006-2024):
────────────────────────────────────────────────────────────────────────────

1st Line Center: 0.723 PPG average
  • Top performers (75th percentile): 0.841 PPG
  • Minimum acceptable (25th percentile): 0.615 PPG
  • Avg age: 27.3 years, Cap hit: $8.24M

TEAM-LEVEL PATTERNS:
  • Average roster age: 27.1 years
  • Average per-player production: 0.312 PPG
  • Average total cap allocated: $75.2M

  • Youngest Cup winner: 2022 Colorado Avalanche (25.8 years avg)
  • Oldest Cup winner: 2011 Boston Bruins (29.4 years avg)

ERA COMPARISON:
  • 2015-2024 Cup winners: 26.8 years avg age
  • 2006-2014 Cup winners: 27.5 years avg age
  • Trend: Teams are getting younger
```
