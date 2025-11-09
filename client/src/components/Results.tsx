// src/components/Results.tsx
import { useState } from 'react';

function ReplacementDropdown({ replacementOptions }: { replacementOptions: any[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!replacementOptions || replacementOptions.length === 0) {
    return <div className="no-replacements">No replacement options available</div>;
  }

  const selected = replacementOptions[selectedIndex];

  return (
    <div className="replacement-dropdown">
      <div className="dropdown-header">
        <label htmlFor="replacement-select">Replacement Options ({replacementOptions.length})</label>
        <select
          id="replacement-select"
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
          className="replacement-select"
        >
          {replacementOptions.map((option, index) => (
            <option key={index} value={index}>
              #{index + 1}: {option.name} ({option.teamAbbrev}) - ${typeof option.capHit === 'number' ? option.capHit.toFixed(1) : typeof option.capHit === 'string' ? parseFloat(option.capHit).toFixed(1) : '0.0'}M
            </option>
          ))}
        </select>
      </div>

      <div className="selected-replacement">
        <div className="replacement-header">
          → <strong>{selected.name}</strong> ({selected.teamAbbrev})
          {selected.capHit && (
            <span className="salary"> — ${typeof selected.capHit === 'number' ? selected.capHit.toFixed(1) : typeof selected.capHit === 'string' ? parseFloat(selected.capHit).toFixed(1) : '0.0'}M</span>
          )}
        </div>
        <div className="replacement-analysis">
          {selected.detailedAnalysis}
        </div>
      </div>
    </div>
  );
}

export default function Results({ data }: { data: any | null }) {
  if (!data) return null;
  const { weakLinks = [], recommendations = [], cupWinnerBenchmarks } = data;

  return (
    <div className="results">
      {cupWinnerBenchmarks && (
        <>
          <h3>Cup Winner Benchmark Analysis</h3>
          <div className="benchmark-summary">
            <div className="summary-stat">
              <span>Players Analyzed:</span> <strong>{cupWinnerBenchmarks.summary.totalPlayers}</strong>
            </div>
            <div className="summary-stat">
              <span>Average Z-Score:</span>
              <strong className={cupWinnerBenchmarks.summary.averageZScore < 0 ? 'negative' : 'positive'}>
                {cupWinnerBenchmarks.summary.averageZScore.toFixed(2)}
              </strong>
            </div>
            <div className="breakdown">
              <span className="critical">🔴 {cupWinnerBenchmarks.summary.criticalWeaknesses}</span>
              <span className="high">🟠 {cupWinnerBenchmarks.summary.highWeaknesses}</span>
              <span className="moderate">🟡 {cupWinnerBenchmarks.summary.moderateWeaknesses}</span>
              <span className="good">🟢 {cupWinnerBenchmarks.summary.meetsStandards}</span>
            </div>
          </div>
        </>
      )}

      <h3>Weak Links</h3>
      {weakLinks.length === 0 ? (
        <div className="muted">None / need data.</div>
      ) : (
        <ul className="list">
          {weakLinks.map((w: any, i: number) => (
            <li className="item weak" key={i}>
              <b>{w.player.name}</b> ({w.player.position}) — {w.player.role}
              {w.player.capHit && typeof w.player.capHit === 'number' && (
                <span className="salary"> — ${w.player.capHit.toFixed(1)}M</span>
              )}
              <div className="weakness-detail">
                <div className="basic-weakness">
                  <strong>{w.weakness?.description}</strong>
                  <div className="context">{w.weakness?.context}</div>
                </div>
                {w.weakness?.detailedAnalysis && (
                  <div className="detailed-analysis">
                    <h5>GM Analysis</h5>
                    <p>{w.weakness.detailedAnalysis}</p>
                  </div>
                )}
                {w.weakness?.impactOnTeam && (
                  <div className="team-impact">
                    <h5>Team Impact</h5>
                    <p>{w.weakness.impactOnTeam}</p>
                  </div>
                )}
                {w.weakness?.urgency && (
                  <div className={`urgency urgency-${w.weakness.urgency}`}>
                    <strong>Urgency: {w.weakness.urgency.toUpperCase()}</strong>
                  </div>
                )}
                <div className="reasoning">{w.reasoning}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Recommendations</h3>
      {recommendations.length === 0 ? (
        <div className="muted">None.</div>
      ) : (
        <ul className="list">
          {recommendations.map((r: any, i: number) => (
            <li className="item rec" key={i}>
              <div className="rec-header">
                <strong>{r.playerInfo.name}</strong> ({r.playerInfo.position} - {r.playerInfo.role})
                {r.playerInfo.capHit && typeof r.playerInfo.capHit === 'number' && (
                  <span className="salary"> — ${r.playerInfo.capHit.toFixed(1)}M</span>
                )}
              </div>
              {r.suggestionType === 'reassign' ? (
                <div className="reassign">
                  <span className="action">Reassign:</span> {r.reasoning}
                </div>
              ) : (
                <div className="replace">
                  <span className="action">Replace:</span> {r.reasoning}
                  {r.replacementOptions && r.replacementOptions.length > 0 ? (
                    <ReplacementDropdown replacementOptions={r.replacementOptions} />
                  ) : r.replacement ? (
                    <div className="candidate">
                      → <strong className="candidate-name">{r.replacement.name}</strong> ({r.replacement.teamAbbrev})
                      {r.replacement.capHit && typeof r.replacement.capHit === 'number' && (
                        <span className="salary"> — ${r.replacement.capHit.toFixed(1)}M</span>
                      )}
                    </div>
                  ) : (
                    <div className="no-candidate">{r.note}</div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .benchmark-summary {
          background: #f8f9fa;
          border: 2px solid #007bff;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .summary-stat {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 15px;
        }

        .summary-stat .negative {
          color: #dc3545;
        }

        .summary-stat .positive {
          color: #28a745;
        }

        .breakdown {
          display: flex;
          gap: 12px;
          justify-content: space-around;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #dee2e6;
        }

        .breakdown span {
          font-weight: 600;
          font-size: 14px;
        }

        .weakness-detail {
          margin-top: 8px;
          padding: 12px;
          background: #f8f9fa;
          border-left: 3px solid #e74c3c;
          font-size: 14px;
          border-radius: 4px;
          color: #212529;
        }

        .basic-weakness {
          margin-bottom: 12px;
          color: #212529;
        }
        
        .detailed-analysis, .team-impact {
          background: #fff;
          padding: 10px;
          margin: 8px 0;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        
        .detailed-analysis h5, .team-impact h5 {
          margin: 0 0 6px 0;
          color: #212529;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .detailed-analysis p, .team-impact p {
          margin: 0;
          line-height: 1.4;
          color: #212529;
          font-weight: 500;
        }
        
        .urgency {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          margin: 8px 0;
        }
        
        .urgency-immediate {
          background: #dc3545;
          color: white;
        }
        
        .urgency-high {
          background: #fd7e14;
          color: white;
        }
        
        .urgency-medium {
          background: #ffc107;
          color: #212529;
        }
        
        .urgency-low {
          background: #28a745;
          color: white;
        }
        
        .context {
          font-style: italic;
          color: #212529;
          margin: 4px 0;
          font-weight: 500;
        }
        
        .reasoning {
          color: #212529;
          font-weight: 600;
        }

        /* All strong tags just inherit color from parent and add weight */
        strong {
          font-weight: 700;
        }
        
        .rec-header {
          font-size: 16px;
          margin-bottom: 8px;
        }

        .action {
          font-weight: bold;
          color: #007bff;
        }

        .candidate {
          margin-top: 6px;
          padding: 4px 8px;
          background: #d1ecf1;
          border-radius: 4px;
          color: #0c5460;
          border: 2px solid red;
        }

        .candidate-name {
          color: #ffffff;
          font-weight: 700;
        }
        
        .no-candidate {
          margin-top: 6px;
          font-style: italic;
          color: #212529;
          font-weight: 500;
        }
        
        .weakness-type {
          margin-top: 8px;
          font-size: 12px;
          color: #dc3545;
          font-weight: 500;
        }
        
        .item.weak {
          border-left: 4px solid #e74c3c;
          margin-bottom: 16px;
        }
        
        .item.rec {
          border-left: 4px solid #28a745;
          margin-bottom: 16px;
        }
        
        .salary {
          color: #28a745;
          font-weight: 600;
          font-size: 14px;
        }
        
        .replacement-dropdown {
          margin-top: 12px;
          padding: 12px;
          background: #e8f5e8;
          border-radius: 6px;
          border: 1px solid #28a745;
        }
        
        .dropdown-header {
          margin-bottom: 10px;
        }
        
        .dropdown-header label {
          display: block;
          font-weight: 600;
          color: #155724;
          margin-bottom: 6px;
          font-size: 13px;
        }
        
        .replacement-select {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #28a745;
          border-radius: 4px;
          background: white;
          font-size: 13px;
          color: black !important;
        }
        
        .selected-replacement {
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #c3e6cb;
        }
        
        .replacement-header {
          font-weight: 600;
          color: #155724;
          margin-bottom: 8px;
        }
        
        .replacement-analysis {
          font-size: 14px;
          line-height: 1.6;
          color: #212529;
          font-weight: 500;
          white-space: pre-line;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        
        .replacement-analysis strong {
          font-weight: 700;
          color: #0056b3;
        }
        
        .replacement-analysis h1,
        .replacement-analysis h2,
        .replacement-analysis h3,
        .replacement-analysis h4,
        .replacement-analysis h5,
        .replacement-analysis h6 {
          margin: 12px 0 6px 0;
          font-weight: 700;
          color: #0056b3;
        }
        
        /* Emoji and section headers */
        .replacement-analysis h2 {
          font-size: 16px;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 4px;
        }
        
        .replacement-analysis h3 {
          font-size: 15px;
          color: #2c5530;
        }
        
        /* Metrics formatting */
        .replacement-analysis code {
          background: #f8f9fa;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: inherit;
        }
        
        /* Lists and indentation */
        .replacement-analysis ul {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .replacement-analysis li {
          margin: 4px 0;
        }
        
        .no-replacements {
          margin-top: 8px;
          padding: 8px;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
