import React, { useState, useEffect, useMemo } from 'react';
import { searchPlayers, getPositions, getTeams, getSimilarPlayers } from '../api';
import type { Player, PlayerSearchParams, Team } from '../types';

interface PlayerSearchProps {
  onPlayerSelect?: (player: Player) => void;
  onSimilarPlayersView?: (player: Player, similarPlayers: Array<Player & { similarity: number }>) => void;
}

export default function PlayerSearch({ onPlayerSelect, onSimilarPlayersView }: PlayerSearchProps) {
  const [searchParams, setSearchParams] = useState<PlayerSearchParams>({
    search: '',
    position: '',
    teamAbbr: '',
    league: '',
    sortBy: 'name',
    order: 'ASC',
    limit: 25,
    offset: 0
  });
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [positions, setPositions] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Load positions and teams on mount
  useEffect(() => {
    Promise.all([
      getPositions().catch(() => []),
      getTeams().catch(() => [])
    ]).then(([pos, teamList]) => {
      setPositions(pos);
      setTeams(teamList);
    });
  }, []);

  // Search when params change
  useEffect(() => {
    performSearch();
  }, [searchParams]);

  const performSearch = async () => {
    if (!searchParams.search && !searchParams.position && !searchParams.teamAbbr && !searchParams.league) {
      setPlayers([]);
      setPagination({ total: 0, pages: 0, limit: 25, offset: 0 });
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await searchPlayers(searchParams);
      setPlayers(response.players);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key: keyof PlayerSearchParams, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value,
      offset: key !== 'offset' ? 0 : value // Reset to first page unless explicitly changing page
    }));
  };

  const nextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      updateParam('offset', pagination.offset + pagination.limit);
    }
  };

  const prevPage = () => {
    if (pagination.offset > 0) {
      updateParam('offset', Math.max(0, pagination.offset - pagination.limit));
    }
  };

  const handleSimilarPlayers = async (player: Player) => {
    if (!player.playerId || !onSimilarPlayersView) return;
    
    try {
      const result = await getSimilarPlayers(player.playerId, true);
      onSimilarPlayersView(player, result.similarPlayers);
    } catch (err) {
      console.error('Failed to get similar players:', err);
    }
  };

  const formatPlayerName = (player: Player) => {
    return `${player.firstName} ${player.lastName}`;
  };

  const formatAge = (age?: number | null) => {
    if (age === null || age === undefined) return '—';
    return age.toString();
  };

  const formatRating = (ratings?: any) => {
    if (!ratings) return '—';
    const overall = Math.round((ratings.skating + ratings.shooting + ratings.playmaking + ratings.defending) / 4);
    return overall || '—';
  };

  return (
    <div className="player-search">
      <div className="search-filters">
        <div className="filter-row">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchParams.search || ''}
            onChange={(e) => updateParam('search', e.target.value)}
          />
          
          <select 
            value={searchParams.position || ''} 
            onChange={(e) => updateParam('position', e.target.value)}
          >
            <option value="">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          <select 
            value={searchParams.teamAbbr || ''} 
            onChange={(e) => updateParam('teamAbbr', e.target.value)}
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.abbr}>{team.abbr} — {team.name}</option>
            ))}
          </select>

          <select 
            value={searchParams.league || ''} 
            onChange={(e) => updateParam('league', e.target.value)}
          >
            <option value="">All Leagues</option>
            <option value="NHL">NHL</option>
            <option value="AHL">AHL</option>
          </select>
        </div>

        <div className="filter-row">
          <label>Sort by:</label>
          <select 
            value={searchParams.sortBy || 'name'} 
            onChange={(e) => updateParam('sortBy', e.target.value)}
          >
            <option value="name">Name</option>
            <option value="age">Age</option>
            <option value="position">Position</option>
            <option value="team">Team</option>
          </select>

          <select 
            value={searchParams.order || 'ASC'} 
            onChange={(e) => updateParam('order', e.target.value)}
          >
            <option value="ASC">Ascending</option>
            <option value="DESC">Descending</option>
          </select>

          <select 
            value={searchParams.limit || 25} 
            onChange={(e) => updateParam('limit', parseInt(e.target.value))}
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Searching...</div>}

      {players.length > 0 && (
        <>
          <div className="search-results">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Team</th>
                  <th>Age</th>
                  <th>Overall</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => (
                  <tr key={player.playerId || player.id}>
                    <td>{formatPlayerName(player)}</td>
                    <td>{player.position || '—'}</td>
                    <td>{player.team?.abbr || '—'}</td>
                    <td>{formatAge(player.age)}</td>
                    <td>{formatRating(player.ratings)}</td>
                    <td>
                      {onPlayerSelect && (
                        <button 
                          onClick={() => onPlayerSelect(player)}
                          className="select-btn"
                        >
                          Select
                        </button>
                      )}
                      {onSimilarPlayersView && (
                        <button 
                          onClick={() => handleSimilarPlayers(player)}
                          className="similar-btn"
                        >
                          Similar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="pagination-controls">
              <button onClick={prevPage} disabled={pagination.offset === 0}>
                Previous
              </button>
              <button onClick={nextPage} disabled={pagination.offset + pagination.limit >= pagination.total}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && players.length === 0 && searchParams.search && (
        <div className="no-results">No players found matching your criteria.</div>
      )}

      <style jsx>{`
        .player-search {
          margin: 20px 0;
        }

        .search-filters {
          margin-bottom: 20px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .filter-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-row:last-child {
          margin-bottom: 0;
        }

        input, select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        input[type="text"] {
          flex: 1;
          min-width: 200px;
        }

        .search-results table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }

        .search-results th,
        .search-results td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .search-results th {
          background: #f9f9f9;
          font-weight: 600;
        }

        .search-results tr:hover {
          background: #f9f9f9;
        }

        .select-btn, .similar-btn {
          padding: 6px 12px;
          margin-right: 8px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .select-btn:hover {
          background: #007bff;
          color: white;
        }

        .similar-btn:hover {
          background: #28a745;
          color: white;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
        }

        .pagination-controls {
          display: flex;
          gap: 10px;
        }

        .pagination button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination button:not(:disabled):hover {
          background: #f0f0f0;
        }

        .loading, .error, .no-results {
          text-align: center;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }

        .loading {
          background: #e3f2fd;
          color: #1565c0;
        }

        .error {
          background: #ffebee;
          color: #c62828;
        }

        .no-results {
          background: #f5f5f5;
          color: #666;
        }
      `}</style>
    </div>
  );
}