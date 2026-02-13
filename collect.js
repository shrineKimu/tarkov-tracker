const fs = require('fs');
const path = require('path');

async function collect() {
    const query = JSON.stringify({
        query: `{
            pvp: items(lang: ja) { id name lastLowPrice iconLink category { name } }
            pve: items(lang: ja, gameMode: pve) { id name lastLowPrice iconLink category { name } }
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

        const updateStorage = (mode, items) => {
            const historyFile = `data-${mode}.json`;
            const listFile = `list-${mode}.json`;
            
            // 1. 履歴データの更新
            let history = [];
            if (fs.existsSync(historyFile)) {
                try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (e) { history = []; }
            }
            const filtered = items.filter(i => i.lastLowPrice > 0);
            history.push({ time: timestamp, items: filtered });
            if (history.length > 2016) history = history.slice(-2016);
            fs.writeFileSync(historyFile, JSON.stringify(history)); // 履歴は圧縮して保存

            // 2. 表示用軽量リストの作成 (最新の1回分だけ)
            fs.writeFileSync(listFile, JSON.stringify({
                time: timestamp,
                items: filtered
            }));
        };

        updateStorage('pvp', result.data.pvp);
        updateStorage('pve', result.data.pve);

        console.log("収集とリスト作成が完了しました");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
collect();
