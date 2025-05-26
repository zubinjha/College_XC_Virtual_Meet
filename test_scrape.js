const readline = require('readline');
const { scrapeMeet } = require('./scraper/scrape');

async function main() {
  const url = 'https://www.tfrrs.org/results/xc/19080/FSU_Invite_Pre-Nats'; // You can change this or make it dynamic later
  const meet = await scrapeMeet(url);

  if (!meet) {
    console.error('❌ Failed to scrape meet.');
    return;
  }

  console.log(`\n🏁 Meet Name: ${meet.name}`);
  console.log(`📅 Meet Date: ${meet.date}\n`);

  const tableNames = Object.keys(meet.tables);
  if (tableNames.length === 0) {
    console.log('⚠️ No individual result tables found.');
    return;
  }

  console.log('📋 Available Individual Tables:');
  tableNames.forEach((name, i) => {
    console.log(`  [${i}] ${name}`);
  });

  const numRowsToDisplay = 300;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n👉 Enter the number of the table to view: ', (answer) => {
    const index = parseInt(answer, 10);
    if (isNaN(index) || index < 0 || index >= tableNames.length) {
      console.log('❌ Invalid selection.');
    } else {
      const selectedTableName = tableNames[index];
      const tableData = meet.tables[selectedTableName];

      console.log(`\n📄 ${selectedTableName} (${tableData.length} runners)\n`);

      const rowsToShow = Math.min(numRowsToDisplay, tableData.length);
      tableData.slice(0, rowsToShow).forEach((row, i) => {
        if (row.TIME != null && !isNaN(row.TIME)) {
            console.log(`#${i + 1}: ${row.PLACE}. ${row.NAME} (${row.TEAM}) — ${row.TIME.toFixed(3)}`);
        } else {
            console.log(`#${i + 1}: ${row.PLACE}. ${row.NAME} (${row.TEAM}) — ⛔ TIME MISSING`);
        }

      });

      if (tableData.length > rowsToShow) {
        console.log(`... (${tableData.length - rowsToShow} more rows hidden)\n`);
      }
    }

    rl.close();
  });
}

main();
