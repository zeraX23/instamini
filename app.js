// 1. Inisialisasi Kredensial
const SUPABASE_URL = 'https://ofmnqhaazuxygixnqvwy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbW5xaGFhenV4eWdpeG5xdnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQ3MDgsImV4cCI6MjEwMjY0MDcwOH0.DDRceiPhOBMr4IbY-ifJ7Erh3G03bERKVgjVyXM70Fs';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Deklarasi Elemen DOM
const uiStatus = document.getElementById('statusMessage');
const loginBtn = document.getElementById('loginBtn');
const uploadBtn = document.getElementById('uploadBtn');

// Fungsi Utilitas Penampil Status
function showStatus(pesan, tipe = 'info') {
    uiStatus.textContent = pesan;
    uiStatus.className = tipe;
}

// 3. Logika Autentikasi
async function loginAtauDaftar() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    
    // Validasi Input Kosong
    if (!email || !password) {
        return showStatus("Email dan password tidak boleh kosong!", "error");
    }

    loginBtn.disabled = true;
    showStatus("Memproses...", "info");

    try {
        // Coba Login terlebih dahulu
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        // Jika gagal login, langsung coba daftarkan sebagai akun baru
        if (error) {
            showStatus("Mendaftarkan akun baru...", "info");
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
                email, 
                password 
            });
            
            if (signUpError) throw signUpError;
            
            // Peringatan jika fitur Confirm Email masih aktif di Supabase
            if (signUpData.user && !signUpData.session) {
                return showStatus("Pendaftaran berhasil! Cek email Anda untuk konfirmasi.", "info");
            }
        }

        // Sukses
        showStatus("Berhasil masuk! Silakan pilih foto.", "success");
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';

    } catch (err) {
        showStatus(`Gagal: ${err.message}`, "error");
    } finally {
        loginBtn.disabled = false;
    }
}

// 4. Logika Pemrosesan & Unggah Data
async function prosesUpload() {
    const fileInput = document.getElementById('imageInput');
    const captionInput = document.getElementById('captionInput').value.trim();

    // Validasi File
    if (fileInput.files.length === 0) {
        return showStatus("Harap pilih gambar terlebih dahulu!", "error");
    }

    const file = fileInput.files[0];
    const ekstensi = file.name.split('.').pop().toLowerCase();
    const namaFileUnik = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ekstensi}`;

    uploadBtn.disabled = true;

    try {
        showStatus("Mengunggah gambar ke server...", "info");

        // Proses Unggah ke Bucket Supabase
        const { error: storageError } = await supabase
            .storage
            .from('post_images')
            .upload(`public/${namaFileUnik}`, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) throw storageError;

        showStatus("Menyimpan data postingan...", "info");

        // Ambil URL Publik
        const { data: publicUrlData } = supabase
            .storage
            .from('post_images')
            .getPublicUrl(`public/${namaFileUnik}`);
        
        const imageUrl = publicUrlData.publicUrl;
        
        // Ambil ID User yang sedang aktif
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        // Injeksi Baris Data Baru ke Tabel 'posts'
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

        // Bersihkan Formulir jika sukses
        showStatus("Selesai! Postingan berhasil dipublikasikan.", "success");
        fileInput.value = '';
        document.getElementById('captionInput').value = '';

    } catch (err) {
        console.error("Terjadi kesalahan sistem:", err);
        showStatus(`Gagal: ${err.message}`, "error");
    } finally {
        uploadBtn.disabled = false;
    }
}
