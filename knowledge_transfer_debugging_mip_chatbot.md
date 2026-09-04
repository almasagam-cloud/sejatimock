# KNOWLEDGE TRANSFER: Debugging AI Agent MIP Insurance Chatbot (Qibos)

Dokumen ini berisi konteks lengkap investigasi bug pada AI Agent CS Asuransi (platform: Sejati AI) yang terintegrasi dengan REST API asuransi Qibos. Ditulis supaya bisa dilanjutkan oleh siapa pun/model AI lain tanpa kehilangan konteks.

## 1. LATAR BELAKANG SISTEM

Membangun chatbot CS asuransi kesehatan korporat menggunakan platform "Sejati AI" (model: Sejati AI v1.1). Agent terhubung ke REST API pihak ketiga (Qibos) untuk validasi peserta dan pencarian data asuransi (benefit, keluarga, provider, T&C).

### Spesifikasi API (ringkas)
- Base URL: `http://45.77.33.61/qibos/index.php/api/asuransi/`
- Auth: header `X-API-KEY: rahasia_chatbot_qibos_2026`
- Endpoint utama:
  - `POST /validate` - body: `{nama_peserta, tanggal_lahir, nama_perusahaan}` → return `{status, message, data:{member_id, f_pol_trans_id, plan}}`
  - `POST /search_benefit_value` - body: `{f_pol_trans_id, plan, keyword}` → cari nominal plafon/limit benefit
  - `POST /search_member` - body: `{f_pol_trans_id, member_id}` → daftar anggota keluarga terdaftar
  - `POST /search_member_benefits` - body: `{f_pol_trans_id, member_id}` → matriks kategori benefit aktif
  - `POST /search_provider` - body: `{f_pol_trans_id, keyword}` → cari RS rekanan
  - `POST /search_tc` - body: `{f_pol_trans_id, keyword}` → cari klausul polis/T&C
- Error umum: 401 (token salah), 400 (parameter kurang), 404 (data tidak ditemukan)

Data test yang dipakai konsisten sepanjang investigasi:
```
nama_peserta: "IDA AYU PUTU SUANDEWI"
tanggal_lahir: "1980-09-06"
nama_perusahaan: "PT. ABCDEF"
```
Data valid ini SEHARUSNYA (dikonfirmasi via Postman langsung ke API asli) selalu mengembalikan:
```json
{
  "status": true,
  "message": "Validasi sukses.",
  "data": { "member_id": 747444, "f_pol_trans_id": 19089, "plan": "600" }
}
```

## 2. KRONOLOGI BUG YANG DITEMUKAN (URUT WAKTU)

### Bug #1: Model menulis syntax tool call sebagai teks visible ke user
Agent membalas dengan teks mentah seperti:
```
{
  "name": "VALIDASI IDENTITAS PESERTA 4",
  "arguments": {"nama_perusahaan": "PT. ABCDEF", "nama_peserta": "IDA AYU PUTU SUANDEWI", "tanggal_lahir": "1980-09-06"}
}
```
atau bentuk pseudo-tag: `<call search_benefit_value API> {"f_pol_trans_id": 19089, ...}`
Juga muncul placeholder template yang belum di-render: `{{customer_name}}`.

Root cause ditemukan: **Few-shot example** pada konfigurasi tool "Validasi Peserta" di platform Sejati AI (field "Few Shot Examples", limit 100 karakter) berisi:
```
User: "Nama Ida Ayu Putu Suandewi, lahir 06-09-1980, dari PT. ABCDEF"
Agent: <call validate API>
```
Model meniru pola literal dari few-shot ini alih-alih benar-benar melakukan tool invocation.

**Fix yang diterapkan:** Few-shot diganti agar sisi "Agent:" tidak pernah berisi tag/JSON/nama tool, cukup kalimat natural pendek, contoh:
```
User: Nama John Doe, lahir 1990-01-01, PT Contoh
Agent: Baik, saya cek data Anda sebentar.
```
(Nama diganti ke "John Doe"/"PT Contoh" generik supaya tidak menyebut data peserta asli sebagai contoh - risiko privasi/kebocoran data real ke pengguna iseng.)

### Bug #2: Agent fabrikasi hasil "sukses" dengan placeholder kosong
Dengan input nama tidak lengkap ("Almas" saja, bukan nama lengkap), agent mengklaim:
```
Data telah diverifikasi. Berikut informasi kepesertaan Anda:
- Plan: [Plan]
- Plafon Asuransi: [Plafon Asuransi]
```
Placeholder `[Plan]` dan `[Plafon Asuransi]` tidak pernah ter-render dengan data asli - menunjukkan tool tidak benar-benar dipanggil, model hanya generate teks template kosong dan tetap mengklaim sukses meski data harusnya gagal/404 (nama tidak match database).

### Bug #3: Agent stuck di pesan "sedang memproses" tanpa lanjut
Agent membalas konfirmasi data + "Sedang memproses..." lalu tidak pernah lanjut ke hasil akhir sampai user manual bertanya "bagaimana hasilnya?" - menandakan tidak ada mekanisme otomatis melanjutkan setelah (yang seharusnya) tool selesai dieksekusi.

### Bug #4: Agent hanya menampilkan 1 item dari array multi-item
Endpoint `search_member` yang seharusnya mengembalikan array 3 anggota keluarga (Pasangan, Anak, Karyawan - sesuai data real client) hanya ditampilkan 1 baris oleh agent. Dugaan root cause: few-shot example tool ini juga kemungkinan hanya mencontohkan 1 hasil, sehingga model meniru shape output "1 baris" itu.

### Bug #5: Agent fabrikasi jawaban generik/marketing tidak berdasar data API
Untuk pertanyaan T&C dengan keyword "pelayanan", di mana data API asli (16 item T&C detail soal cashless/reimbursement/dokumen klaim) sudah diberikan sebagai konteks, agent malah menjawab dengan tema generik yang TIDAK ADA di data manapun:
```
- Pelayanan medis 24/7 melalui hotline customer service.
- Dukungan dalam pengajuan klaim dengan proses yang mudah dan cepat.
- Jaringan rumah sakit rekanan yang luas di Indonesia.
```
Ini murni halusinasi tema "insurance-sounding" tanpa dasar data nyata.

### Bug #6 (PALING KRITIS): Response tool call TIDAK KONSISTEN untuk payload identik
Menggunakan mode "debug prompt" (lihat bagian 4) yang memaksa agent menampilkan blok request+response mentah, ditemukan 3 hasil BERBEDA untuk payload validasi yang PERSIS SAMA:

| Percobaan | Hasil klaim Agent |
|---|---|
| Debug v1 | Sukses, tapi `plan: "KSP-2023"` (field fiktif, seharusnya "600") dan nama anggota keluarga yang di-generate (Budi Setiawan, Citra Ayu Suci Wulandari) berbeda dari database asli |
| Debug v2 | Gagal 404 "Peserta tidak ditemukan" - PADAHAL data ini valid dan sukses jika dicek manual via Postman (dikonfirmasi screenshot Postman: 200 OK, status:true, member_id:747444, f_pol_trans_id:19089, plan:"600") |
| Data yang sengaja dibuat invalid | Gagal 404 (ini kebetulan benar) |

**Kesimpulan:** dengan request identik, hasil tool call tidak deterministik - membuktikan tool TIDAK benar-benar dieksekusi terhadap API real, melainkan hasil di-generate/dihalusinasi oleh LLM berdasarkan pola bahasa, bukan actual function-calling.

## 3. HIPOTESIS ROOT CAUSE (belum terverifikasi 100%, perlu investigasi lanjut)

1. Tool di platform Sejati AI mungkin hanya terdaftar sebagai "API Tools Context" (dokumentasi/konteks pasif dibaca model), BUKAN sebagai native function/tool call schema yang benar-benar bisa dieksekusi model.
2. Model Sejati AI v1.1 kemungkinan tidak (atau tidak sepenuhnya) mendukung native function-calling, sehingga hanya "menebak" format respons berdasarkan instruksi teks/few-shot yang dibaca sebagai konteks.
3. Kemungkinan lain: tool call terkirim tapi ada bug parsing response di level integrasi platform (field mapping salah, status code salah dibaca, dll) - namun ini kurang mungkin mengingat variasi hasil yang sangat acak (kadang sukses dengan data ngarang, kadang gagal padahal harusnya sukses).

Catatan tambahan dari pemilik sistem: "API Tools" bisa di-set sendiri di platform (jadi bukan closed system), model yang dipakai "harusnya" (belum dikonfirmasi 100%) mendukung tool-calling, TIDAK ada akses ke log server API asli (milik pihak ketiga/client), sehingga verifikasi lanjut perlu dilakukan lewat DUMMY endpoint yang kita kontrol sendiri.

## 4. SYSTEM PROMPT YANG SUDAH DIKEMBANGKAN (evolusi, dari awal sampai versi debug)

Beberapa versi system prompt sudah dibuat sepanjang investigasi ini, dengan progresi sbb:
1. **v1 (lengkap, ~7000+ karakter):** role, keamanan token, alur verifikasi, spesifikasi 6 endpoint, routing table, format jawaban, error handling, larangan umum, state sesi.
2. **v2 (ringkas, dipangkas ke maks 5000 karakter)** untuk keperluan platform yang punya character limit di system prompt field. Berisi semua elemen v1 tapi dipadatkan, plus larangan tambahan hasil temuan bug:
   - Larangan menuliskan syntax tool call/JSON/pseudo-tag sebagai teks ke user
   - Larangan fabrikasi status "sukses"/"berhasil diverifikasi" tanpa status:true nyata dari API
   - Larangan placeholder kosong ([Plan], {{var}}, dst)
   - Wajib rangkum SEMUA item jika hasil API berupa array multi-item
   - Larangan jawaban generik/marketing yang tidak berdasar data API asli
   - Wajib langsung beri jawaban final dalam 1 respons setelah tool selesai, tidak boleh stuck di "sedang memproses"
   - Deteksi otomatis data identitas dari kalimat bebas (tidak minta user mengetik format berlabel), dengan contoh format HANYA memakai nama fiktif "John Doe"/"PT Contoh" (bukan data asli)
3. **v3 (mode debug):** versi v2 + tambahan blok wajib di akhir tiap balasan yang menampilkan:
   ```
   --- DEBUG LOG ---
   [REQUEST] endpoint, method, headers, body persis
   [RESPONSE] http_status, raw_body persis apa adanya
   --- END DEBUG ---
   ```
   Tujuan: memaksa model "menunjukkan bukti" tool call untuk investigasi - dan ini yang berhasil mengekspos Bug #6 di atas. Prompt debug ini eksplisit meminta model menyatakan ketidakyakinan apa adanya jika ragu, bukan mengarang kepastian palsu.

**PENTING:** Mode debug ini HANYA untuk investigasi internal, TIDAK boleh dipakai di agent production karena expose detail API/parameter ke percakapan (risiko keamanan).

## 5. RENCANA LANJUTAN YANG SEDANG DIDISKUSIKAN

Karena tidak ada akses ke log server API asli (milik client/pihak ketiga), rencana selanjutnya adalah membuat **dummy endpoint tester** untuk memverifikasi secara pasti apakah tool call benar-benar terkirim dari platform Sejati AI atau tidak sama sekali:

**Opsi A (tercepat, no-code):** Pakai layanan seperti webhook.site atau requestbin.com untuk generate URL unik gratis. Ganti sementara URL endpoint tool di konfigurasi platform (misal endpoint `/validate`) ke URL dummy tersebut. Jalankan simulasi chat. Cek apakah ada request yang benar-benar masuk ke webhook.site (lengkap dengan body-nya) - ini akan membuktikan definitif apakah tool dieksekusi atau tidak, tanpa ambiguitas.

**Opsi B (lebih lengkap):** Bikin dummy server sendiri (mock API, misal pakai Mockoon/beeceptor atau server kecil custom) yang:
- Mencatat/log semua request masuk (untuk bukti eksekusi)
- Membalas dengan response yang identik dengan contoh dokumentasi asli (status:true, member_id:747444, f_pol_trans_id:19089, plan:"600")

Dengan opsi B, selain bisa cek apakah request masuk, juga bisa sekaligus test apakah agent BENAR bisa membaca/parsing response dengan benar kalau memang request-nya sampai - mengisolasi apakah masalahnya di "tidak pernah manggil" ATAU "manggil tapi salah parsing response".

Investigasi berikutnya sebaiknya lanjut dari titik ini: eksekusi opsi A/B, lalu bandingkan hasil log dummy endpoint dengan klaim jawaban agent di chat, untuk memastikan diagnosis akhir sebelum melapor ke tim/vendor Sejati AI.

## 6. FILE-FILE YANG SUDAH DIHASILKAN SEPANJANG SESI INI
- `system_prompt_mip_chatbot.md` - versi lengkap awal (~7000+ karakter)
- `system_prompt_mip_chatbot_ringkas.md` - versi dipadatkan maks 5000 karakter (untuk agent production, TANPA blok debug)
- `system_prompt_mip_chatbot_debug.md` - versi ringkas + blok debug v1 (menampilkan value penting saja)
- `system_prompt_mip_chatbot_debug_v2.md` - versi ringkas + blok debug v2 (menampilkan full request+response mentah, versi ini yang berhasil mengekspos Bug #6)

## 7. REKOMENDASI UNTUK MELANJUTKAN INVESTIGASI (untuk AI/engineer berikutnya)
1. Jalankan Opsi A (webhook.site) terlebih dahulu - paling cepat memberi jawaban ya/tidak yang pasti soal eksekusi tool.
2. Jika terbukti ADA request masuk ke dummy endpoint, lanjut Opsi B untuk isolasi masalah di parsing response.
3. Jika terbukti TIDAK ADA request masuk sama sekali, fokuskan investigasi ke konfigurasi tool-binding di platform Sejati AI (apakah tool terdaftar sebagai native function schema atau cuma dokumen konteks pasif) dan/atau hubungi tim vendor Sejati AI dengan bukti konkret dari Bug #6 di atas.
4. Setelah root cause dikonfirmasi dan diperbaiki di level platform/tool-binding, gunakan `system_prompt_mip_chatbot_ringkas.md` (TANPA blok debug) sebagai system prompt final untuk agent production.
