const fs = require('fs');
const path = require('path');

// 画像保存用フォルダの作成
const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir);
}

// 画像をダウンロードする関数
async function downloadImage(id, url) {
    const filePath = path.join(imgDir, `${id}.png`);
    
    // すでに画像が存在する場合はスキップ（効率化）
    if (fs.existsSync(filePath)) return;

    try {
        const res = await fetch(url);
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);
        console.log(`Downloaded: ${id}.png`);
    } catch (e) {
        console.error(`Failed to download ${id}:`, e.message);
    }
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
        const response = await fetch('https://api.tarkov.dev/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: query,
        });
        const result = await response.json();
        const timestamp = new Date().toISOString();

        const updateStorage = async (mode, items) => {
            const listFile = `list-${mode}.json`;
            const dataFile = `data-${mode}.json`;

            const specList = [];
            let historyData = {};

            if (fs.existsSync(dataFile)) {
                try {
                    historyData = JSON.parse(fs.readFileSync(dataFile, 'utf8')).data || {};
                } catch (e) { historyData = {}; }
            }

            for (const i of items) {
                const slots = (i.width || 1) * (i.height || 1);
                
                // --- 画像のダウンロード処理 ---
                if (i.image512pxLink) {
                    await downloadImage(i.id, i.image512pxLink);
                }

                let bestTrader = { price: 0, name: "" };
                if (i.sellFor && i.sellFor.length > 0) {
                    const best = i.sellFor.reduce((max, curr) => max.price > curr.price ? max : curr);
                    bestTrader = { price: best.price, name: best.vendor.name };
                }

                specList.push({
                    id: i.id,
                    name: i.name,
                    shortName: i.shortName,
                    slots: slots,
                    weight: i.weight,
                    category: i.category?.name || "その他",
                    bestTraderPrice: bestTrader.price,
                    bestTraderName: bestTrader.name,
                    img: `images/${i.id}.png`, // 自前のパスに変更
                    props: i.properties || {}
                });

                if (i.lastLowPrice > 0) {
                    if (!historyData[i.id]) historyData[i.id] = { n: i.name, h: [] };
                    historyData[i.id].cp = i.lastLowPrice;
                    historyData[i.id].h.push({ t: timestamp, p: i.lastLowPrice });
                    if (historyData[i.id].h.length > 672) historyData[i.id].h = historyData[i.id].h.slice(-672);
                }
            }

            fs.writeFileSync(listFile, JSON.stringify({ time: timestamp, items: specList }));
            fs.writeFileSync(dataFile, JSON.stringify({ time: timestamp, data: historyData }));
        };

        await updateStorage('pvp', result.data.pvp);
        await updateStorage('pve', result.data.pve);

        console.log(`[${new Date().toLocaleTimeString()}] 収集・画像保存完了`);
    } catch (e) {
        console.error("エラー:", e);
        process.exit(1);
    }
}

collect();
