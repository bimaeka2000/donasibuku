const express = require('express');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const multer = require('multer');

const app = express();
const PORT = 3000;

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

        // Buat 'Set' atau peta data unik dari data lama untuk pengecekan super cepat (I/O Efisien)
        // Kita gabungkan judul dan donatur sebagai key unik (huruf kecil semua agar akurat)
        const trackerDataLama = new Set(
            dataLama.map(buku => `${buku.judul.toLowerCase().trim()}_${buku.nama_donatur.toLowerCase().trim()}`)
        );

        let jumlahBukuBaru = 0;
        let jumlahBukuDiduplikat = 0;
        const dataBaruBersih = [];

        dataBukuRaw.forEach((buku, index) => {
            const judul = (buku.judul || buku.Judul || '-').trim();
            const donatur = (buku.nama_donatur || buku.Nama_Donatur || 'Hamba Allah').trim();

            // Kunci unik untuk baris dari excel saat ini
            const kunciUnik = `${judul.toLowerCase()}_${donatur.toLowerCase()}`;

            // JIKA SUDAH ADA DI DATABASE, MAKA DILEWATI (SKIP)
            if (trackerDataLama.has(kunciUnik)) {
                jumlahBukuDiduplikat++;
                return; // Skip ke baris excel berikutnya
            }

            // JIKA BELUM ADA, MASUKKAN SEBAGAI DATA BARU
            dataBaruBersih.push({
                id: `BK-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                judul: judul,
                kategori: buku.kategori || buku.Kategori || 'Umum',
                nama_donatur: donatur,
                jumlah_buku: parseInt(buku.jumlah_buku || buku.Jumlah_Buku || 1),
                rak: buku.rak || buku.Rak || '-',
                pengarang: buku.pengarang || buku.Pengarang || '-',
                penerbit: buku.penerbit || buku.Penerbit || '-'
            });

            // Masukkan juga ke tracker agar jika di dalam SATU FILE EXCEL YANG SAMA ada baris ganda, tidak ikut lolos
            trackerDataLama.add(kunciUnik);
            jumlahBukuBaru++;
        });

        // Gabungkan data lama dengan data baru yang lolos seleksi anti-duplikat
        const totalDataAkhir = [...dataLama, ...dataBaruBersih];

        // Simpan ke database JSON
        fs.writeFileSync(jsonDbPath, JSON.stringify(totalDataAkhir, null, 2), 'utf-8');
        fs.unlinkSync(req.file.path); // Hapus file temporary di folder uploads

        res.json({
            message: `Proses Selesai! Berhasil menambah ${jumlahBukuBaru} buku baru. (Menolak ${jumlahBukuDiduplikat} data duplikat)`,
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