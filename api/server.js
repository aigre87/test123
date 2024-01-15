const express = require('express')
const app = express()
const port = process.env.PORT || 1338
const path = require("path");
const axios = require('axios');

app.use(express.static('dist'))

app.get('/data', async function(req, res){
    const data = await start();
    res.json(data);
});

app.get('*', function(req, res){
    res.sendFile('dist/404.html', {root: path.join(__dirname)});
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

async function pars(dex) {
    let pools = {};

    if (dex === 'axly.io') {
        let url = "https://backend.axly.io/v1/farm";
        let result = await axios.get(url).then(res => res.data);

        for (let item of result) {
            let poolId = item["poolId"];
            let poolName = item["name"];
            let poolLiquidity = item["tvl"];
            let poolMaxAPR = Math.max(...item["leverageApy"].flatMap(apy => apy["leverages"].map(leverage => leverage["total"])));

            pools[poolId] = {
                "id": poolId,
                "dex": dex,
                "poolName": poolName,
                "poolLiquidity": parseFloat(poolLiquidity),
                "poolMaxAPR": parseFloat(poolMaxAPR),
                "link": `https://app.axly.io/add-to-farm?address=${poolId}`
            };
        }
    } else if (dex === 'swop.fi') {
        let url = "https://backend.swop.fi/pools/";
        let result = await axios.get(url).then(res => res.data.pools);

        let pools = {};
        for (let item of result) {
            let poolId = item["id"];
            let poolName = item["name"];
            let poolLiquidity = item["liquidity"];
            let poolMaxAPR = item["week"]["current"]["totalApr"]["max"];

            pools[poolId] = {
                "id": poolId,
                "dex": dex,
                "poolName": poolName,
                "poolLiquidity": parseFloat(poolLiquidity),
                "poolMaxAPR": parseFloat(poolMaxAPR),
                "link": `https://swop.fi/pool?address=${poolId}`
            };
        }

        return pools;
    } else if (dex === 'WX') {
        let url = "https://wx.network/api/v1/liquidity_pools/stats";
        let result = await axios.get(url).then(res => res.data.items);

        let pools = {};
        for (let item of result) {
            let poolId = item["address"];
            let amount_asset_id = item["amount_asset_id"];
            let price_asset_id = item["price_asset_id"];
            let poolName = "-";
            let poolLiquidity = parseFloat(item["pool_lp_balance"]) * parseFloat(item["rate_lp_usd"]);
            let poolMaxAPR = parseFloat(item["base_apys"][0]["base_apy"]) + parseFloat(item["reward_apy_max"]);

            pools[poolId] = {
                "id": poolId,
                "dex": dex,
                "poolName": poolName,
                "poolLiquidity": poolLiquidity,
                "poolMaxAPR": poolMaxAPR,
                "amount_asset_id": amount_asset_id,
                "price_asset_id": price_asset_id,
                "link": "-"
            };
        }

        return pools;
    } else if (dex === 'puzzle') {
        let url = "https://puzzle-js-back.herokuapp.com/api/v1/pools";
        let result = await axios.get(url).then(res => res.data);

        let pools = {};
        for (let item of result) {
            let poolId = item["contractAddress"];

            pools[poolId] = {
                "id": poolId,
                "dex": dex,
                "poolName": item["title"],
                "domain": item["domain"],
                "poolLiquidity": parseFloat(item["statistics"]["liquidity"]),
                "poolMaxAPR": parseFloat(item["statistics"]["apy"]),
                "link": `https://puzzleswap.org/pools/${item["domain"]}/invest`
            };
        }

        return pools;
    }

    return pools;
}

async function getAssetName(assetId) {
    let url = `https://wx.network/api/v1/assets?ids=${assetId}`;
    let response = await axios.get(url);
    let data = response.data;
    let assetName = data['data'][0]['data']['ticker'];
    if (!assetName) {
        assetName = data['data'][0]['data']['name'];
    }
    return assetName;
}

async function print(pool) {
    switch(pool.dex) {
        case 'WX':
            const amount_asset = await getAssetName(pool.amount_asset_id)
            const price_asset = await getAssetName(pool.price_asset_id)

            return {
                // ...pool,
                dex: pool.dex,
                poolName: `${amount_asset} / ${price_asset}`,
                link: `https://wx.network/liquiditypools/pools/${amount_asset}_${price_asset}`,
                poolLiquidity: Math.round(pool.poolLiquidity),
                poolMaxAPR: Math.round(pool.poolMaxAPR),
            }
        case 'puzzle':
            return {
                // ...pool,
                dex: pool.dex,
                poolName: pool.poolName,
                link: pool.link,
                poolLiquidity: Math.round(pool.poolLiquidity),
                poolMaxAPR: Math.round(pool.poolMaxAPR),
            }
        case 'swop.fi':
            return {
                // ...pool,
                dex: pool.dex,
                poolName: pool.poolName,
                link: pool.link,
                poolLiquidity: Math.round(pool.poolLiquidity),
                poolMaxAPR: Math.round(pool.poolMaxAPR),
            }
        case 'axly.io':
            return {
                // ...pool,
                dex: pool.dex,
                poolName: pool.poolName,
                link: pool.link,
                poolLiquidity: Math.round(pool.poolLiquidity),
                poolMaxAPR: Math.round(pool.poolMaxAPR),
            }
        default:
        return pool;
    }
}

async function start(dex) {

    // ['puzzle', 'swop.fi', 'axly.io', 'WX']
    const pools = await Promise.all(['WX', 'puzzle', 'swop.fi', 'axly.io'].map(async (name) => {
        return await pars(name).catch((error) => {
            console.log(`Pool ${name} return with error`);
            console.error(error)
            return [];
        });
    })).catch((error) => {
        console.log(`All pools return with error`);
        console.error(error)
        return [];
    }).then((dexes) => {
        return dexes.reduce((accumulator, currentValue) => {
            return accumulator.concat(Object.values(currentValue));
        }, []).sort((a, b) => {
            return b.poolMaxAPR - a.poolMaxAPR
        }).filter((item, index) => {
            return index < 20
        })
    })

    return await Promise.all(pools.map(async (pool) => {
        return await print(pool)
          .catch((error) => {
            console.log(`Print pool ${name.poolName} return with error`);
            console.error(error)
            return pool;
        })
    })).catch((error) => {
        console.log(`Printing pools return with error`);
        console.error(error)
        return [];
    })
}
