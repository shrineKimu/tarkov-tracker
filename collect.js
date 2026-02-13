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
            const listFile = `list-${mode}.json`;
            const dataFile = `data-${mode}.json`;

            // 1. スペックリスト作成 (画像はURLのまま)
            const specList = items.map(i => {
                const slots = (i.width || 1) * (i.height || 1);
                
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
                    img: i.image512pxLink, // URLを直接保持
                    props: i.properties || {}
                };
            });

            // 2. 価格履歴の更新
            let historyData = {};
            if (fs.existsSync(dataFile)) {
                try {
                    const raw = fs.readFileSync(dataFile, 'utf8');
                    historyData = JSON.parse(raw).data || {};
                } catch (e) {
                    historyData = {};
                }
            }

            items.filter(i => i.lastLowPrice > 0).forEach(i => {
                if (!historyData[i.id]) {
                    historyData[i.id] = { n: i.name, h: [] };
                }
                historyData[i.id].cp = i.lastLowPrice;
                historyData[i.id].h.push({ t: timestamp, p: i.lastLowPrice });

                // 7日分（15分×672回）
                if (historyData[i.id].h.length > 672) {
                    historyData[i.id].h = historyData[i.id].h.slice(-672);
                }
            });

            fs.writeFileSync(listFile, JSON.stringify({ time: timestamp, items: specList }));
            fs.writeFileSync(dataFile, JSON.stringify({ time: timestamp, data: historyData }));
        };

        updateStorage('pvp', result.data.pvp);
        updateStorage('pve', result.data.pve);

        console.log(`[${new Date().toLocaleTimeString()}] 収集完了 (画像URL参照方式)`);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

collect();
