// 1. Inisialisasi Supabase Client
// GANTI TEKS DI BAWAH DENGAN URL DAN KEY DARI DASHBOARD SUPABASE ANDA
const SUPABASE_URL = 'https://xyzabcdefgh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1...'; 

// Menggunakan modul supabase dari CDN yang dipanggil di HTML
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utilitas untuk menampilkan pesan ke user
const uiStatus = document.getElementById('statusMessage');
function showStatus(pesan, isError = false) {
    uiStatus.textContent = pesan;
    uiStatus.className = isError ? 'error' : 'success';
}

// 2. Fungsi Login/Daftar (Wajib karena RLS)
async function loginAtauDaftar() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    showStatus("Memproses autentikasi...");

    try {
        // Coba login terlebih dahulu
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        // Jika gagal login karena user tidak ada, otomatis daftarkan
        if (error && error.message.includes("Invalid login credentials")) {
            showStatus("User tidak ditemukan, mendaftarkan akun baru...");
            const signUpResponse = await supabase.auth.signUp({ email, password });
            data = signUpResponse.data;
            error = signUpResponse.error;
        }

        if (error) throw error;

        // Jika berhasil
        showStatus("Berhasil login! Silakan unggah foto.");
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';

    } catch (err) {
        showStatus(`Gagal Autentikasi: ${err.message}`, true);
    }
}

// 3. Fungsi Utama: Proses Upload Gambar & Simpan Data
async function prosesUpload() {
    const fileInput = document.getElementById('imageInput');
    const captionInput = document.getElementById('captionInput').value;
    const btn = document.getElementById('uploadBtn');

    // Validasi input
    if (fileInput.files.length === 0) {
        return showStatus("Harap pilih gambar terlebih dahulu!", true);
    }

    const file = fileInput.files[0];
    const ekstensi = file.name.split('.').pop();
    // Membuat nama file acak agar tidak bentrok (misal: 169283746-gambar.jpg)
    const namaFileUnik = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ekstensi}`;

    try {
        btn.disabled = true; // Matikan tombol agar tidak di-klik ganda
        showStatus("Tahap 1: Mengunggah gambar ke server...");

        // Tahap 1: Unggah gambar ke Supabase Storage (Bucket: post_images)
        const { data: storageData, error: storageError } = await supabase
            .storage
            .from('post_images')
            .upload(`public/${namaFileUnik}`, file, {
                cacheControl: '3600',
                upsert: false // Jangan timpa file jika nama sama
            });

        if (storageError) throw storageError;

        showStatus("Tahap 2: Mendapatkan URL publik...");

        // Tahap 2: Dapatkan URL publik dari gambar yang baru diunggah
        const { data: publicUrlData } = supabase
            .storage
            .from('post_images')
            .getPublicUrl(`public/${namaFileUnik}`);
        
        const imageUrl = publicUrlData.publicUrl;

        showStatus("Tahap 3: Menyimpan ke database...");

        // Tahap 3: Ambil ID user yang sedang login, dan simpan ke database (tabel posts)
        const { data: userData } = await supabase.auth.getUser();
        
        const { error: dbError } = await supabase
            .from('posts')
            .insert([
                { 
                    user_id: userData.user.id, 
                    image_url: imageUrl, 
                    caption: captionInput 
                }
            ]);

        if (dbError) throw dbError;

        showStatus("Selesai! Postingan berhasil dipublikasikan.", false);
        
        // Bersihkan formulir
        fileInput.value = '';
        document.getElementById('captionInput').value = '';

    } catch (err) {
        console.error("Terjadi kesalahan:", err);
        showStatus(`Gagal: ${err.message}`, true);
    } finally {
        btn.disabled = false; // Nyalakan tombol kembali
    }
}
