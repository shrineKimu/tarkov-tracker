const fs = require('fs');
const https = require('https');

// fetchの代わりにNode.js標準のhttpsモジュールを使用する関数
function post(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js/Tarkov-Tracker'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error("Invalid JSON response"));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

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
        const result = await post('https://api.tarkov.dev/graphql', query);
        const timestamp = new Date().toISOString();

        if (!result.data) {
            throw new Error(JSON.stringify(result.errors));
        }

        const updateStorage = (mode, items) => {
            const listFile = `list-${mode}.json`;
            const dataFile = `data-${mode}.json`;

            const specList = items.map(i => {
                const slots = (i.width || 1) * (i.height || 1);
                let bestTrader = { price: 0, name: "" };

                if (i.sellFor && i.sellFor.length > 0) {
                    // フリマを除外して、純粋なトレーダーだけを抽出
                    const traderPrices = i.sellFor.filter(s => 
                        s.vendor.name !== 'Marketplace' && 
                        s.vendor.name !== 'フリーマーケット'
                    );

                    if (traderPrices.length > 0) {
                        // トレーダーの中で一番高い価格を探す
                        const best = traderPrices.reduce((max, curr) => max.price > curr.price ? max : curr);
                        bestTrader = { price: best.price, name: best.vendor.name };
                    }
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

            let historyData = {};
            if (fs.existsSync(dataFile)) {
                try {
                    const raw = fs.readFileSync(dataFile, 'utf8');
                    historyData = JSON.parse(raw).data || {};
                } catch (e) { historyData = {}; }
            }

            items.filter(i => i.lastLowPrice > 0).forEach(i => {
                if (!historyData[i.id]) {
                    historyData[i.id] = { n: i.name, h: [] };
                }
                historyData[i.id].cp = i.lastLowPrice;
                historyData[i.id].h.push({ t: timestamp, p: i.lastLowPrice });
                if (historyData[i.id].h.length > 672) {
                    historyData[i.id].h = historyData[i.id].h.slice(-672);
                }
            });

            fs.writeFileSync(listFile, JSON.stringify({ time: timestamp, items: specList }));
            fs.writeFileSync(dataFile, JSON.stringify({ time: timestamp, data: historyData }));
        };

        updateStorage('pvp', result.data.pvp);
        updateStorage('pve', result.data.pve);
        console.log("Success: Data files updated.");

    } catch (e) {
        console.error("Collection Failed:", e.message);
        process.exit(1);
    }
}

collect();
