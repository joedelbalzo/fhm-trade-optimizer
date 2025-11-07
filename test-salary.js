console.log('Starting test...');

import('./server/src/scripts/calculateSalaries.js').then(async (module) => {
  console.log('Module loaded');
  await module.calculateAllPlayerSalaries();
  console.log('Done!');
}).catch(error => {
  console.error('Error:', error);
});