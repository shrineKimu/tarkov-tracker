const fs = require('fs');

async function collect() {
    // PvPとPvEの両方のクエリを投げる
    const query = JSON.stringify({
        query: `{
            pvp: items(lang: ja) { id name lastLowPrice category { name } }
            pve: items(lang: ja, gameMode: pve) { id name lastLowPrice category { name } }
        }`
    });

    try {
        const response = await fetch('https://api.tarkov.dev/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: query,
        });
        const result = await response.json();
        const timestamp = new Date().toISOString();
        
        // PvPとPvEを分けて保存する
        const newData = { 
            time: timestamp, 
            pvp: result.data.pvp.filter(i => i.lastLowPrice > 0),
            pve: result.data.pve.filter(i => i.lastLowPrice > 0)
        };

        let history = [];
        if (fs.existsSync('data.json')) {
            history = JSON.parse(fs.readFileSync('data.json'));
        }
        history.push(newData);
        if (history.length > 2016) history.shift();

        fs.writeFileSync('data.json', JSON.stringify(history, null, 2));
        console.log("PvP/PvE両方の取得に成功しました");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
collect();
