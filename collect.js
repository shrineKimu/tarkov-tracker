const fs = require('fs');

async function collect() {
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

        if (!result.data) throw new Error("API data missing");

        // PvPとPvEのデータを個別に処理する関数
        const updateStorage = (filename, items) => {
            let history = [];
            if (fs.existsSync(filename)) {
                try {
                    history = JSON.parse(fs.readFileSync(filename, 'utf8'));
                } catch (e) { history = []; }
            }

            // 新しいデータ（価格があるもののみ）を追加
            const filteredItems = items.filter(i => i.lastLowPrice > 0);
            history.push({ time: timestamp, items: filteredItems });

            // 7日分（2016件）を保持
            if (history.length > 2016) history = history.slice(-2016);

            fs.writeFileSync(filename, JSON.stringify(history, null, 2));
            return filteredItems.length;
        };

        // それぞれのファイルに保存
        const pvpCount = updateStorage('data-pvp.json', result.data.pvp);
        const pveCount = updateStorage('data-pve.json', result.data.pve);

        console.log(`保存完了: PvP(${pvpCount}件) / PvE(${pveCount}件)`);

    } catch (e) {
        console.error("エラー:", e.message);
        process.exit(1);
    }
}

collect();
