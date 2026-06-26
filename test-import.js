const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'buku_test.xlsx');
const jsonDbPath = path.join(__dirname, 'database.json');

console.log('🔄 Memulai proses import data  baru...');

try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const dataBukuRaw = xlsx.utils.sheet_to_json(sheet);

    // Pemetaan data baru sesuai request atasan
    const dataBukuBersih = dataBukuRaw.map((buku, index) => {
        return {
            id: `BK-${Date.now()}-${index}`,
            judul: buku.judul || buku.Judul || '-',
            kategori: buku.kategori || buku.Kategori || 'Umum',
            nama_donatur: buku.nama_donatur || buku.Nama_Donatur || 'Hamba Allah',
            jumlah_buku: parseInt(buku.jumlah_buku || buku.Jumlah_Buku || 1), // Pastikan jadi angka
            rak: buku.rak || buku.Rak || buku.posisi_buku || '-',
            pengarang: buku.pengarang || buku.Pengarang || '-',
            penerbit: buku.penerbit || buku.Penerbit || '-',
            imported_at: new Date().toISOString()
        };
    });

    fs.writeFileSync(jsonDbPath, JSON.stringify(dataBukuBersih, null, 2), 'utf-8');
    console.log(`✅ Sukses! ${dataBukuBersih.length} data buku dengan format baru berhasil disimpan ke database.json.`);

} catch (error) {
    console.error('❌ Error:', error.message);
}