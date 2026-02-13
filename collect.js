const fs = require('fs');
const path = require('path');

async function collect() {
    const query = JSON.stringify({
        query: `{
            pvp: items(lang: ja) { id name lastLowPrice iconLink category { name } }
            pve: items(lang: ja, gameMode: pve) { id name lastLowPrice iconLink category { name } }
        }`
    });

    // 画像保存用のフォルダを作成
    const imgDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

    try {
        const response = await fetch('https://api.tarkov.dev/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: query,
        });
        const result = await response.json();
        const timestamp = new Date().toISOString();

        if (!result.data) throw new Error("API data missing");

        const updateStorage = async (filename, items) => {
            let history = [];
            if (fs.existsSync(filename)) {
                try { history = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (e) { history = []; }
            }

            const filteredItems = items.filter(i => i.lastLowPrice > 0);

            // 画像の保存処理
            for (const item of filteredItems) {
                const imgPath = path.join(imgDir, `${item.id}.png`);
                // まだ画像を持っていない場合のみダウンロード
                if (!fs.existsSync(imgPath) && item.iconLink) {
                    try {
                        const imgRes = await fetch(item.iconLink);
                        const buffer = await imgRes.arrayBuffer();
                        fs.writeFileSync(imgPath, Buffer.from(buffer));
                        console.log(`新着画像を保存: ${item.name}`);
                    } catch (e) { console.error(`画像保存失敗: ${item.id}`); }
                }
            }

            history.push({ time: timestamp, items: filteredItems });
            if (history.length > 2016) history = history.slice(-2016);
            fs.writeFileSync(filename, JSON.stringify(history, null, 2));
            return filteredItems.length;
        };

        await updateStorage('data-pvp.json', result.data.pvp);
        await updateStorage('data-pve.json', result.data.pve);

        console.log(`更新完了: ${timestamp}`);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
collect();
