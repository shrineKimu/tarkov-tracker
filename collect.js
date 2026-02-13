const fs = require('fs');

async function collect() {
    const query = JSON.stringify({
        query: `{
            pvp: items(lang: ja) { 
                id name shortName lastLowPrice width height weight image512pxLink
                category { name }
                sellFor { price vendor { name } }
                properties {
                    ... on ItemPropertiesAmmo { damage penetrationPower armorDamage }
                    ... on ItemPropertiesArmor { class durability }
                }
            }
            pve: items(lang: ja, gameMode: pve) { 
                id name shortName lastLowPrice width height weight image512pxLink
                category { name }
                sellFor { price vendor { name } }
                properties {
                    ... on ItemPropertiesAmmo { damage penetrationPower armorDamage }
                    ... on ItemPropertiesArmor { class durability }
                }
            }
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
            const listFile = `list-${mode}.json`;    // アイテム図鑑（詳細スペック）
            const dataFile = `data-${mode}.json`;    // 価格履歴（7日分）

            // --- 1. list-xxx.json の作成 (アイテムスペック) ---
            const specList = items.map(i => {
                const slots = (i.width || 1) * (i.height || 1);
                
                // 店売り最高値を計算
                let bestTrader = { price: 0, name: "" };
                if (i.sellFor && i.sellFor.length > 0) {
                    const best = i.sellFor.reduce((max, curr) => max.price > curr.price ? max : curr);
                    bestTrader = { price: best.price, name: best.vendor.name };
                }

                return {
                    id: i.id,
                    name: i.name,
                    shortName: i.shortName,
                    slots: slots,
                    weight: i.weight,
                    category: i.category?.name || "その他",
                    bestTraderPrice: bestTrader.price,
                    bestTraderName: bestTrader.name,
                    img: i.image512pxLink,
                    props: i.properties || {}
                };
            });

            // --- 2. data-xxx.json の作成 (価格推移) ---
            let historyData = {};
            // 既存の履歴があれば読み込む
            if (fs.existsSync(dataFile)) {
                try {
                    const raw = fs.readFileSync(dataFile, 'utf8');
                    historyData = JSON.parse(raw).data || {};
                } catch (e) {
                    historyData = {};
                }
            }

            items.filter(i => i.lastLowPrice > 0).forEach(i => {
                // 初めてのアイテムなら枠を作る
                if (!historyData[i.id]) {
                    historyData[i.id] = { n: i.name, h: [] };
                }
                
                // 現在の価格を追加 (t:時刻, p:価格)
                historyData[i.id].cp = i.lastLowPrice; // Current Price
                historyData[i.id].h.push({ t: timestamp, p: i.lastLowPrice });

                // 7日分（15分に1回なら最大672件）を保持
                if (historyData[i.id].h.length > 672) {
                    historyData[i.id].h = historyData[i.id].h.slice(-672);
                }
            });

            // ファイル書き出し
            fs.writeFileSync(listFile, JSON.stringify({ time: timestamp, items: specList }));
            fs.writeFileSync(dataFile, JSON.stringify({ time: timestamp, data: historyData }));
        };

        // PvPとPvEをそれぞれのファイルへ保存
        updateStorage('pvp', result.data.pvp);
        updateStorage('pve', result.data.pve);

        console.log(`[${new Date().toLocaleTimeString()}] 保存完了:`);
        console.log(` - list-pvp.json / data-pvp.json`);
        console.log(` - list-pve.json / data-pve.json`);
    } catch (e) {
        console.error("収集・保存エラー:", e);
        process.exit(1);
    }
}

collect();
