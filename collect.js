const fs = require('fs');

async function collect() {
    // PvPとPvEの両方の価格データを、日本語名付きで取得するクエリ
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
        
        // APIエラーやデータが空の場合のチェック
        if (!result.data || (!result.data.pvp && !result.data.pve)) {
            throw new Error("APIから有効なデータが返ってきませんでした");
        }

        const timestamp = new Date().toISOString();
        
        // 必要なデータ（価格が0より大きいもの）だけを抽出して保存
        const newData = { 
            time: timestamp, 
            pvp: result.data.pvp.filter(i => i.lastLowPrice > 0),
            pve: result.data.pve.filter(i => i.lastLowPrice > 0)
        };

        // 既存のデータを読み込む
        let history = [];
        if (fs.existsSync('data.json')) {
            try {
                const fileContent = fs.readFileSync('data.json', 'utf8');
                history = JSON.parse(fileContent);
            } catch (e) {
                console.log("既存のdata.jsonが壊れているため、新規作成します");
                history = [];
            }
        }

        // 新しいデータを追加
        history.push(newData);

        // 7日分（5分おきなら2016件）を超えたら古い順に削除
        const MAX_HISTORY = 2016;
        if (history.length > MAX_HISTORY) {
            history = history.slice(-MAX_HISTORY);
        }

        // ファイルに書き出し
        fs.writeFileSync('data.json', JSON.stringify(history, null, 2));
        console.log(`収集成功: ${timestamp} | PvP: ${newData.pvp.length}件 | PvE: ${newData.pve.length}件`);

    } catch (e) {
        console.error("収集失敗:", e.message);
        process.exit(1);
    }
}

collect();
