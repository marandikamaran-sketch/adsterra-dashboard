const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// DATABASE PENGGUNA (Tambahkan domainId jika Anda tahu ID-nya dari Adsterra, biarkan null jika ingin auto-detect)
const usersDB = {
    "admin_ch7": { password: "ch7123", domain: "ch7news-update.blogspot.com", domainId:1896921 },
    "admin_hese": { password: "hese123", domain: "heseasupan.blogspot.com", domainId:2871927 },
    "admin_mgr": { password: "mgr123", domain: "mgronlinelive.blogspot.com", domainId:1885291 },
    "admin_sprite": { password: "sprite123", domain: "spritebababi.blogspot.com", domainId:1909856 }
};

// ISIKAN TOKEN API ADSTERRA ANDA DI SINI
const ADSTERRA_API_KEY = "c8933ebcd563ae33757957c7d39a8c42";
const BASE_URL = "https://api3.adsterratools.com/publisher";

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB[username];

    if (user && user.password === password) {
        res.json({ success: true, domain: user.domain, token: username });
    } else {
        res.status(401).json({ success: false, message: "Username atau password salah" });
    }
});

app.get('/api/stats', async (req, res) => {
    const userToken = req.headers['authorization'];
    const user = usersDB[userToken];

    if (!user) {
        return res.status(403).json({ error: "Akses ditolak" });
    }

    // Ambil tanggal dari kueri URL jika ada, jika tidak pakai hari ini
    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.start_date || today;
    const finishDate = req.query.finish_date || today;

    try {
        const headers = {
            'X-API-Key': ADSTERRA_API_KEY,
            'Accept': 'application/json'
        };

        let targetDomainId = user.domainId;

        // Jika domainId tidak di-hardcode di usersDB, cari otomatis
        if (!targetDomainId) {
            const domainsRes = await axios.get(`${BASE_URL}/domains.json`, { headers });
            const domainList = domainsRes.data.items || domainsRes.data || [];

            const targetDomainObj = domainList.find(d => {
                const dName = d.domain || d.name || d.domain_name || "";
                return dName.toLowerCase().includes(user.domain.toLowerCase());
            });

            if (!targetDomainObj) {
                return res.json([{ domain: user.domain, impressions: 0, clicks: 0, ctr: "0%", cpm: 0, revenue: 0 }]);
            }
            targetDomainId = targetDomainObj.id;
        }

        // Ambil data statistik sesuai tanggal yang dipilih pengguna
        const statsRes = await axios.get(`${BASE_URL}/stats.json`, {
            headers,
            params: {
                start_date: startDate,
                finish_date: finishDate,
                group_by: 'domain'
            }
        });

        const rawItems = statsRes.data.items || statsRes.data || [];

        let filteredStats = rawItems
            .filter(item => String(item.domain) === String(targetDomainId))
            .map(item => ({
                domain: user.domain,
                impressions: item.impression || item.impressions || 0,
                clicks: item.clicks || 0,
                ctr: item.ctr || 0,
                cpm: item.cpm || 0,
                revenue: item.revenue || 0
            }));

        // Jika tidak ada data di tanggal yang dipilih, berikan nilai 0
        if (filteredStats.length === 0) {
            filteredStats = [{
                domain: user.domain,
                impressions: 0,
                clicks: 0,
                ctr: "0%",
                cpm: 0,
                revenue: 0
            }];
        }

        res.json(filteredStats);

    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                error: `Adsterra Error: ${JSON.stringify(error.response.data)}`
            });
        }
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});