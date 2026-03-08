const firebaseConfig = {
    apiKey: "AIzaSyAlMRkoZGtHbm7fEX4a9V33nlMTZv-oY5s",
    authDomain: "fotoblog-7fa65.firebaseapp.com",
    projectId: "fotoblog-7fa65",
    storageBucket: "fotoblog-7fa65.firebasestorage.app",
    messagingSenderId: "882034034731",
    appId: "1:882034034731:web:f48fb5f8e3b6ceedf4026e"
};

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        window.storage = firebase.storage();
        console.log("Firebase inizializzato correttamente.");
    } else {
        console.warn("Firebase SDK non caricato. Controllo connessione internet o protocollo file://");
    }
} catch (e) {
    console.error("Errore inizializzazione Firebase:", e);
}

// ─── CODICE DI ACCESSO ──────────────────────────────────────────────────────────
const ACCESS_KEY = "89Bf760rT$%";

// ─── AVVIO ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    const reportageContainer = document.getElementById('reportage-container');
    const btnAddReportage = document.getElementById('btn-add-reportage');
    const modalAdd = document.getElementById('modal-add-reportage');
    const btnCloseModal = document.querySelector('.close-modal');
    const formAddReportage = document.getElementById('form-add-reportage');
    const imagesInput = document.getElementById('rep-images');
    const imagePreview = document.getElementById('image-preview');
    const btnManage = document.getElementById('btn-manage');
    const modalManage = document.getElementById('modal-manage');
    const closeAdminModalBtn = document.querySelector('.close-admin-modal');
    const keyInput = document.getElementById('key-input');
    const btnManageSubmit = document.getElementById('btn-manage-submit');
    const modalLightbox = document.getElementById('modal-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeLightboxBtn = document.querySelector('.close-lightbox');
    const prevLightboxBtn = document.querySelector('.prev-lightbox');
    const nextLightboxBtn = document.querySelector('.next-lightbox');

    let currentImagesBase64 = [];
    let reportages = [];
    let currentLightboxImages = [];
    let currentLightboxIndex = 0;
    let isAdmin = false;

    // --- FALLBACK LOCALE ---
    try {
        isAdmin = localStorage.getItem('blog_admin_access') === 'true';
        const backup = localStorage.getItem('local_backup_reportages');
        if (backup) {
            reportages = JSON.parse(backup);
        }
    } catch (e) {
        console.warn("localStorage non accessibile.");
    }

    // ─── AUTENTICAZIONE ──────────────────────────────────────────────────────
    function updateAdminUI() {
        if (isAdmin) {
            btnAddReportage.classList.remove('hidden');
            btnManage.style.color = 'var(--accent)';
        } else {
            btnAddReportage.classList.add('hidden');
            btnManage.style.color = '#ccc';
        }
    }

    function openAdminModal() {
        modalManage.classList.remove('hidden');
        modalManage.classList.add('active');
        keyInput.value = '';
        setTimeout(() => keyInput.focus(), 100);
    }

    function closeAdminModal() {
        modalManage.classList.remove('active');
        modalManage.classList.add('hidden');
    }

    btnManage.addEventListener('click', () => {
        if (isAdmin) {
            if (confirm("Vuoi uscire dalla modalità amministratore?")) {
                isAdmin = false;
                localStorage.removeItem('blog_admin_access');
                updateAdminUI();
                renderReportages();
            }
        } else {
            openAdminModal();
        }
    });

    closeAdminModalBtn.addEventListener('click', closeAdminModal);
    modalManage.addEventListener('click', e => { if (e.target === modalManage) closeAdminModal(); });

    function tryLogin() {
        if (keyInput.value === ACCESS_KEY) {
            isAdmin = true;
            localStorage.setItem('blog_admin_access', 'true');
            closeAdminModal();
            updateAdminUI();
            renderReportages();
        } else {
            keyInput.style.border = '2px solid #cc0000';
            setTimeout(() => { keyInput.style.border = '1px solid #ccc'; }, 2000);
        }
    }

    btnManageSubmit.addEventListener('click', tryLogin);
    keyInput.addEventListener('keypress', e => { if (e.key === 'Enter') tryLogin(); });

    updateAdminUI();

    // ─── COMPRESSIONE IMMAGINE ───────────────────────────────────────────────
    function shrinkImage(base64Str, quality, maxDim) {
        quality = quality || 0.7;
        maxDim = maxDim || 4000;
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var width = img.width;
                var height = img.height;
                if (width > height && width > maxDim) {
                    height = Math.round(height * maxDim / width);
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round(width * maxDim / height);
                    height = maxDim;
                }
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64Str;
        });
    }

    function loadReportages() {
        if (typeof firebase === 'undefined' || !window.db) return;
        window.db.collection("reportages")
            .orderBy("timestamp", "desc")
            .onSnapshot(function (snapshot) {
                reportages = [];
                snapshot.forEach(function (docSnap) {
                    reportages.push(Object.assign({ id: docSnap.id }, docSnap.data()));
                });
                try {
                    localStorage.setItem('local_backup_reportages', JSON.stringify(reportages));
                } catch (e) { }
                renderReportages();
            });
    }

    // ─── RENDERING ──────────────────────────────────────────────────────────
    function renderReportages() {
        reportageContainer.innerHTML = '';
        if (reportages.length === 0) {
            reportageContainer.innerHTML = '<div class="glass-panel" style="text-align:center;padding:40px;"><p>Nessun reportage.</p></div>';
            return;
        }

        reportages.forEach(function (rep) {
            var article = document.createElement('article');
            article.className = 'glass-panel reportage-post';

            var commentsHtml = (rep.comments || []).map(c =>
                `<div class="comment-item"><div class="comment-author">${c.name}</div><div class="comment-text">${c.text}</div></div>`
            ).join('') || '<p style="color:#666;font-size:0.9rem">Nessun commento.</p>';

            var formattedDate = rep.date ? new Date(rep.date).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

            var imagesHtml = (rep.images || []).map(img =>
                `<img src="${img}" alt="Foto" draggable="false">`
            ).join('');

            var deleteBtn = isAdmin ? `<button class="btn-delete" data-id="${rep.id}"><i class="fas fa-trash"></i> Elimina</button>` : '';

            article.innerHTML = `
                ${deleteBtn}
                <div class="reportage-images">${imagesHtml}</div>
                <div class="reportage-content">
                    <p class="reportage-desc">${rep.desc.replace(/\n/g, '<br>')}</p>
                    <p class="reportage-meta"><i class="fas fa-calendar-alt"></i> ${formattedDate} | <i class="fas fa-map-marker-alt"></i> ${rep.location}</p>
                </div>
                <div class="comments-section">
                    <h5>Commenti</h5>
                    <div class="comments-list">${commentsHtml}</div>
                    <form class="comment-form" data-id="${rep.id}">
                        <input type="text" name="name" placeholder="Nome" required>
                        <textarea name="text" placeholder="Commento..." required></textarea>
                        <button type="submit">Invia</button>
                    </form>
                </div>`;
            reportageContainer.appendChild(article);
        });

        attachCommentListeners();
        if (isAdmin) attachDeleteListeners();
    }

    function attachCommentListeners() {
        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const docId = form.getAttribute('data-id');
                const name = form.querySelector('[name="name"]').value;
                const text = form.querySelector('[name="text"]').value;
                const rep = reportages.find(r => r.id === docId);
                if (rep) {
                    const newComments = (rep.comments || []).concat([{ name, text }]);
                    window.db.collection("reportages").doc(docId).update({ comments: newComments });
                }
            });
        });
    }

    function attachDeleteListeners() {
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.getAttribute('data-id');
                if (confirm("Eliminare?")) {
                    const rep = reportages.find(r => r.id === docId);
                    if (rep && rep.images) {
                        for (let url of rep.images) {
                            if (url.includes('firebasestorage')) {
                                try { await window.storage.refFromURL(url).delete(); } catch (e) { }
                            }
                        }
                    }
                    await window.db.collection("reportages").doc(docId).delete();
                }
            });
        });
    }

    // ─── MODALE AGGIUNGI ─────────────────────────────────────────────────────
    btnAddReportage.addEventListener('click', () => {
        modalAdd.classList.remove('hidden');
        modalAdd.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    function closeModal() {
        modalAdd.classList.remove('active');
        modalAdd.classList.add('hidden');
        document.body.style.overflow = 'auto';
        formAddReportage.reset();
        imagePreview.innerHTML = '<span>Nessuna foto selezionata</span>';
        currentImagesBase64 = [];
    }

    btnCloseModal.addEventListener('click', closeModal);
    modalAdd.addEventListener('click', e => { if (e.target === modalAdd) closeModal(); });

    // ─── LIGHTBOX ────────────────────────────────────────────────────────────
    reportageContainer.addEventListener('click', e => {
        const targetImg = e.target.closest('.reportage-images img');
        if (targetImg) {
            const container = targetImg.closest('.reportage-images');
            currentLightboxImages = Array.from(container.querySelectorAll('img')).map(img => img.src);
            currentLightboxIndex = currentLightboxImages.indexOf(targetImg.src);
            showLightboxImage();
            modalLightbox.classList.remove('hidden');
            modalLightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });

    function showLightboxImage() {
        lightboxImg.src = currentLightboxImages[currentLightboxIndex];
    }

    function nextImage() {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
        showLightboxImage();
    }

    function prevImage() {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
        showLightboxImage();
    }

    function closeLightbox() {
        modalLightbox.classList.remove('active');
        modalLightbox.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    closeLightboxBtn.addEventListener('click', closeLightbox);
    nextLightboxBtn.addEventListener('click', e => { e.stopPropagation(); nextImage(); });
    prevLightboxBtn.addEventListener('click', e => { e.stopPropagation(); prevImage(); });

    document.addEventListener('keydown', e => {
        if (!modalLightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'Escape') closeLightbox();
    });

    // ─── ANTEPRIMA ───────────────────────────────────────────────────────────
    imagesInput.addEventListener('change', async function () {
        imagePreview.innerHTML = '<span>Elaborazione...</span>';
        currentImagesBase64 = [];
        const files = Array.from(this.files);
        if (!files.length) { imagePreview.innerHTML = '<span>Nessuna foto</span>'; return; }

        for (let file of files) {
            const reader = new FileReader();
            const compressed = await new Promise(resolve => {
                reader.onload = e => shrinkImage(e.target.result).then(resolve);
                reader.readAsDataURL(file);
            });
            currentImagesBase64.push(compressed);
        }

        imagePreview.innerHTML = '';
        currentImagesBase64.forEach(base64 => {
            const img = document.createElement('img');
            img.src = base64;
            imagePreview.appendChild(img);
        });
    });

    // ─── SALVA (CON PROGRESSO) ────────────────────────────────────────────────
    formAddReportage.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!currentImagesBase64.length) { alert("Seleziona foto."); return; }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Avvio...';

        try {
            const timestamp = Date.now();
            const reportageId = `rep_${timestamp}`;
            const uploadedUrls = [];

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout globale (5 min)")), 300000)
            );

            const uploadWithProgress = (base64Str, imageRef, index) => {
                return new Promise(async (resolve, reject) => {
                    try {
                        const response = await fetch(base64Str);
                        const blob = await response.blob();
                        const uploadTask = imageRef.put(blob);
                        uploadTask.on('state_changed',
                            (snap) => {
                                const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> FOTO ${index + 1}: ${prog}%`;
                            },
                            reject,
                            async () => resolve(await uploadTask.snapshot.ref.getDownloadURL())
                        );
                    } catch (err) { reject(err); }
                });
            };

            const uploadPromise = async () => {
                for (let i = 0; i < currentImagesBase64.length; i++) {
                    const imageRef = window.storage.ref(`reportages/${reportageId}/img_${i}.jpg`);
                    const singleTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout foto " + (i + 1))), 90000));
                    uploadedUrls.push(await Promise.race([uploadWithProgress(currentImagesBase64[i], imageRef, i), singleTimeout]));
                }
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio dati...';
                await window.db.collection("reportages").add({
                    images: uploadedUrls,
                    desc: document.getElementById('rep-desc').value,
                    date: document.getElementById('rep-date').value,
                    location: document.getElementById('rep-location').value,
                    comments: [],
                    timestamp: timestamp
                });
            };

            await Promise.race([uploadPromise(), timeoutPromise]);
            closeModal();
            alert("Pubblicato!");
        } catch (err) {
            console.error(err);
            alert("Errore: " + (err.message || "Caricamento fallito."));
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
        }
    });

    // ─── PROTEZIONE ──────────────────────────────────────────────────────────
    document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 's' || e.key === 'u')) e.preventDefault();
    });

    loadReportages();
});
