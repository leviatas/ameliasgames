const { listVisits } = require('../visits-db');

const limit = Number(process.argv[2]) || 50;
const visits = listVisits(limit);

if (visits.length === 0) {
  console.log('No hay visitas registradas todavía.');
  process.exit(0);
}

for (const v of visits) {
  console.log(`${v.created_at}  ${v.ip}  [${v.device}]  ${v.user_agent}`);
}
console.log(`\nTotal mostrado: ${visits.length}`);
