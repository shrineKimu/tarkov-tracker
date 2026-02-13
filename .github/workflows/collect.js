const fs = require('fs');

async function collect() {
    const query = JSON.stringify({
        query: `{ items(lang: ja) { id name lastLowPrice iconLink category { name } } }`
    });

    try {
        const response = await fetch('https://api.tarkov.dev/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: query,
        });
        const result = await response.json();
        const timestamp = new Date().toISOString();
        const newData = { time: timestamp, items: result.data.items.filter(i => i.lastLowPrice > 0) };

        let history = [];
        if (fs.existsSync('data.json')) {
            history = JSON.parse(fs.readFileSync('data.json'));
        }
        history.push(newData);
        if (history.length > 2016) history.shift();

        fs.writeFileSync('data.json', JSON.stringify(history, null, 2));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
collect();
