const express = require('express');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const multer = require('multer');

const app = express();
const PORT = 5000;

const upload = multer({ dest: 'uploads/' });

// 1. Izinkan Express membaca folder 'public' untuk file HTML/CSS/JS
app.use(express.static(path.join(__dirname, 'public')));

// 2. API Endpoint untuk mengambil semua data buku dari database.json
app.get('/api/buku', (req, res) => {
    const jsonDbPath = path.join(__dirname, 'database.json');

    // Cek apakah file database.json ada
    if (!fs.existsSync(jsonDbPath)) {
        return res.status(404).json({ message: 'Database belum siap atau kosong.' });
    }

    // Baca file dan kirimkan datanya ke website
    const rawData = fs.readFileSync(jsonDbPath, 'utf-8');
    const dataBuku = JSON.parse(rawData);
    res.json(dataBuku);
});

app.get('/admin/import', (req, res) => {
    // Mengirim file import.html yang berada di folder utama
    res.sendFile(path.join(__dirname, 'import.html'));
});

app.post('/api/import', upload.single('fileBuku'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const dataBukuRaw = xlsx.utils.sheet_to_json(sheet);

        const jsonDbPath = path.join(__dirname, 'database.json');

        let dataLama = [];
        if (fs.existsSync(jsonDbPath)) {
            dataLama = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));
        }

        // Fungsi untuk format Title Case (seperti Aa)
        const formatTitleCase = (str) => {
            if (!str) return '-';
            return str.toString().trim().toLowerCase().split(/\s+/).map(word => {
                if (word.length === 0) return '';
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(' ');
        };

        // Gunakan Map untuk mengelompokkan data HANYA berdasarkan judul
        const mapDataBuku = new Map();
        
        // Masukkan data lama ke dalam Map
        dataLama.forEach(buku => {
            // Kita juga format judul lama agar seragam
            buku.judul = formatTitleCase(buku.judul);
            const kunciUnik = buku.judul.toLowerCase();
            mapDataBuku.set(kunciUnik, buku);
        });

        let jumlahBukuBaru = 0;
        let jumlahBukuDiupdate = 0;

        dataBukuRaw.forEach((buku, index) => {
            const judulRaw = (buku.judul || buku.Judul || '-');
            const judul = formatTitleCase(judulRaw);
            
            const donaturRaw = (buku.nama_donatur || buku.Nama_Donatur || 'Hamba Allah');
            const donatur = formatTitleCase(donaturRaw);
            
            const jumlahBukuImport = parseInt(buku.jumlah_buku || buku.Jumlah_Buku || 1);

            // Kunci unik hanya dari judul excel saat ini
            const kunciUnik = judul.toLowerCase();

            // JIKA SUDAH ADA DI DATABASE ATAU FILE EXCEL, TAMBAHKAN JUMLAHNYA
            if (mapDataBuku.has(kunciUnik)) {
                const bukuAda = mapDataBuku.get(kunciUnik);
                bukuAda.jumlah_buku = parseInt(bukuAda.jumlah_buku || 0) + jumlahBukuImport;
                jumlahBukuDiupdate++;
            } else {
                // JIKA BELUM ADA, MASUKKAN SEBAGAI DATA BARU
                const bukuBaru = {
                    id: `BK-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                    judul: judul,
                    kategori: formatTitleCase(buku.kategori || buku.Kategori || 'Umum'),
                    nama_donatur: donatur,
                    jumlah_buku: jumlahBukuImport,
                    rak: (buku.rak || buku.Rak || '-').toString().trim(),
                    pengarang: formatTitleCase(buku.pengarang || buku.Pengarang || '-'),
                    penerbit: formatTitleCase(buku.penerbit || buku.Penerbit || '-')
                };
                mapDataBuku.set(kunciUnik, bukuBaru);
                jumlahBukuBaru++;
            }
        });

        // Ambil semua data dari Map
        const totalDataAkhir = Array.from(mapDataBuku.values());

        // Simpan ke database JSON
        fs.writeFileSync(jsonDbPath, JSON.stringify(totalDataAkhir, null, 2), 'utf-8');
        fs.unlinkSync(req.file.path); // Hapus file temporary di folder uploads

        res.json({
            message: `Proses Selesai! Berhasil menambah ${jumlahBukuBaru} buku baru dan memperbarui jumlah ${jumlahBukuDiupdate} buku.`,
            total_koleksi: totalDataAkhir.length
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat import data.' });
    }
});
// 3. Jalankan server di port 3000
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📂 Akses website utama Anda di URL tersebut.`);
});