// Simple runner for salary calculation
import { calculateAllPlayerSalaries } from './calculateSalaries.js';

console.log('Starting salary calculation...');

try {
  await calculateAllPlayerSalaries();
  console.log('✅ Salary calculation completed successfully');
} catch (error) {
  console.error('❌ Salary calculation failed:', error);
  process.exit(1);
}