// Cup Winner Analysis Routes
import { Router } from 'express';
import { analyzeCupWinnerDNA, getChampionshipDNA } from '../services/cupWinnerAnalysis.js';
import { analyzeDynastyPotential } from '../services/dynastyAnalysis.js';
import { analyzeInjuryRisk } from '../services/injuryRiskAnalysis.js';
import { analyzeTradeDeadline } from '../services/tradeDeadlineAnalysis.js';
import { analyzeLineChemistry } from '../services/lineChemistryAnalysis.js';

const router = Router();

// GET /api/analyze/cup-winner/:teamAbbrev - Analyze team vs historical Cup winners
router.get('/api/analyze/cup-winner/:teamAbbrev', async (req, res) => {
  try {
    const { teamAbbrev } = req.params;
    
    if (!teamAbbrev) {
      return res.status(400).json({ 
        error: 'Team abbreviation is required' 
      });
    }

    const analysis = await analyzeCupWinnerDNA(teamAbbrev.toUpperCase());
    
    res.json({
      team: teamAbbrev.toUpperCase(),
      analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cup winner analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze championship potential',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/championship-dna - Get championship team construction requirements
router.get('/api/championship-dna', (req, res) => {
  try {
    const dna = getChampionshipDNA();
    
    res.json({
      championshipRequirements: dna,
      description: 'Patterns derived from Stanley Cup winners 2005-2024 (salary cap era)',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Championship DNA error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve championship requirements' 
    });
  }
});

// GET /api/analyze/dynasty/:teamAbbrev - Dynasty mode analysis with prospects and future projections
router.get('/api/analyze/dynasty/:teamAbbrev', async (req, res) => {
  try {
    const { teamAbbrev } = req.params;
    
    if (!teamAbbrev) {
      return res.status(400).json({ 
        error: 'Team abbreviation is required' 
      });
    }

    const dynastyProfile = await analyzeDynastyPotential(teamAbbrev.toUpperCase());
    
    res.json({
      team: teamAbbrev.toUpperCase(),
      dynastyProfile,
      description: 'Long-term team building analysis with prospect valuation and future cap projections',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Dynasty analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze dynasty potential',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/analyze/injury-risk/:teamAbbrev - Injury risk assessment with backup plans
router.get('/api/analyze/injury-risk/:teamAbbrev', async (req, res) => {
  try {
    const { teamAbbrev } = req.params;
    
    if (!teamAbbrev) {
      return res.status(400).json({ 
        error: 'Team abbreviation is required' 
      });
    }

    const injuryRiskProfile = await analyzeInjuryRisk(teamAbbrev.toUpperCase());
    
    res.json({
      team: teamAbbrev.toUpperCase(),
      injuryRiskProfile,
      description: 'Comprehensive injury risk assessment with positional backup plans',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Injury risk analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze injury risk',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/analyze/trade-deadline/:teamAbbrev - Trade deadline rental vs long-term analysis
router.get('/api/analyze/trade-deadline/:teamAbbrev', async (req, res) => {
  try {
    const { teamAbbrev } = req.params;
    
    if (!teamAbbrev) {
      return res.status(400).json({ 
        error: 'Team abbreviation is required' 
      });
    }

    const tradeDeadlineProfile = await analyzeTradeDeadline(teamAbbrev.toUpperCase());
    
    res.json({
      team: teamAbbrev.toUpperCase(),
      tradeDeadlineProfile,
      description: 'Trade deadline strategy with rental vs long-term value analysis',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Trade deadline analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze trade deadline options',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/analyze/line-chemistry/:teamAbbrev - Advanced line chemistry analysis
router.get('/api/analyze/line-chemistry/:teamAbbrev', async (req, res) => {
  try {
    const { teamAbbrev } = req.params;
    
    if (!teamAbbrev) {
      return res.status(400).json({ 
        error: 'Team abbreviation is required' 
      });
    }

    const lineChemistryProfile = await analyzeLineChemistry(teamAbbrev.toUpperCase());
    
    res.json({
      team: teamAbbrev.toUpperCase(),
      lineChemistryProfile,
      description: 'Advanced line chemistry analysis using historical performance data',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Line chemistry analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze line chemistry',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;