import { connectDB } from './mongodb';
import Endpoint from '../models/Endpoint';

const DEFAULT_ENDPOINTS = [
  {
    path: 'validate',
    method: 'POST',
    description: 'Validasi identitas peserta asuransi berdasarkan nama, tanggal lahir, dan nama perusahaan',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      message: 'Validasi sukses.',
      data: {
        member_id: 747444,
        f_pol_trans_id: 19089,
        plan: '600',
      },
    },
  },
  {
    path: 'search_benefit_value',
    method: 'POST',
    description: 'Cari nominal plafon/limit benefit berdasarkan f_pol_trans_id, plan, dan keyword',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      data: [
        { benefit: 'Rawat Inap', limit: 500000000, keterangan: 'Per tahun per orang' },
        { benefit: 'Rawat Jalan', limit: 50000000, keterangan: 'Per tahun per orang' },
        { benefit: 'Persalinan', limit: 15000000, keterangan: 'Per persalinan' },
        { benefit: 'Kacamata', limit: 2000000, keterangan: 'Per 2 tahun' },
      ],
    },
  },
  {
    path: 'search_member',
    method: 'POST',
    description: 'Daftar anggota keluarga terdaftar berdasarkan f_pol_trans_id dan member_id',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      data: [
        { member_id: 747444, nama: 'IDA AYU PUTU SUANDEWI', hubungan: 'Karyawan', tgl_lahir: '1980-09-06' },
        { member_id: 747445, nama: 'I MADE SUANDEWA', hubungan: 'Pasangan', tgl_lahir: '1978-03-12' },
        { member_id: 747446, nama: 'NI PUTU SUANDEWI', hubungan: 'Anak', tgl_lahir: '2005-06-20' },
      ],
    },
  },
  {
    path: 'search_member_benefits',
    method: 'POST',
    description: 'Matriks kategori benefit aktif berdasarkan f_pol_trans_id dan member_id',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      data: {
        rawat_inap: true,
        rawat_jalan: true,
        persalinan: true,
        gigi: false,
        mata: true,
        jiwa: false,
        kecelakaan: true,
        kritis: false,
      },
    },
  },
  {
    path: 'search_provider',
    method: 'POST',
    description: 'Cari rumah sakit/provider rekanan berdasarkan f_pol_trans_id dan keyword',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      data: [
        { nama_rs: 'RS Siloam Hospitals Bali', kota: 'Denpasar', tipe: 'Cashless', kelas: 'VIP' },
        { nama_rs: 'BIMC Hospital Nusa Dua', kota: 'Badung', tipe: 'Cashless', kelas: 'VIP' },
        { nama_rs: 'RS Kasih Ibu', kota: 'Denpasar', tipe: 'Cashless', kelas: 'Kelas 1' },
      ],
    },
  },
  {
    path: 'search_tc',
    method: 'POST',
    description: 'Cari klausul polis/T&C berdasarkan f_pol_trans_id dan keyword',
    statusCode: 200,
    isActive: true,
    responseBody: {
      status: true,
      data: [
        { klausul: 'Rawat inap cashless dapat dilakukan di RS rekanan dengan menunjukkan kartu peserta dan KTP.' },
        { klausul: 'Klaim reimbursement wajib diajukan maksimal 60 hari setelah tanggal perawatan.' },
        { klausul: 'Pre-existing condition tidak ditanggung dalam 12 bulan pertama kepesertaan.' },
        { klausul: 'Pelayanan gawat darurat di luar RS rekanan dapat di-reimburse sesuai plafon yang berlaku.' },
        { klausul: 'Peserta wajib melampirkan surat rujukan dokter untuk rawat inap non-darurat.' },
      ],
    },
  },
];

export async function seedDefaultEndpoints() {
  await connectDB();
  for (const ep of DEFAULT_ENDPOINTS) {
    await Endpoint.findOneAndUpdate(
      { path: ep.path },
      { $setOnInsert: ep },
      { upsert: true, new: true }
    );
  }
}
