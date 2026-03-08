const firebaseConfig = {
    apiKey: "AIzaSyAlMRkoZGtHbm7fEX4a9V33nlMTZv-oY5s",
    authDomain: "fotoblog-7fa65.firebaseapp.com",
    projectId: "fotoblog-7fa65",
    storageBucket: "fotoblog-7fa65.appspot.com",
    messagingSenderId: "882034034731",
    appId: "1:882034034731:web:f48fb5f8e3b6ceedf4026e"
};

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        console.log("Firestore Pronto (Strada C - Illimitata).");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}

const ACCESS_KEY = "89Bf760rT$%";

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
        if (backup) { reportages = JSON.parse(backup); }
    } catch (e) { }

    function updateAdminUI() {
        if (isAdmin) {
            btnAddReportage.classList.remove('hidden');
            btnManage.style.color = 'var(--accent)';
        } else {
            btnAddReportage.classList.add('hidden');
            btnManage.style.color = '#ccc';
        }
    }

    btnManage.addEventListener('click', () => {
        if (isAdmin) {
            if (confirm("Uscire da admin?")) {
                isAdmin = false;
                localStorage.removeItem('blog_admin_access');
                updateAdminUI();
                renderReportages();
            }
        } else {
            modalManage.classList.remove('hidden');
            modalManage.classList.add('active');
            keyInput.focus();
        }
    });

    closeAdminModalBtn.addEventListener('click', () => {
        modalManage.classList.remove('active');
        modalManage.classList.add('hidden');
    });

    function tryLogin() {
        if (keyInput.value === ACCESS_KEY) {
            isAdmin = true;
            localStorage.setItem('blog_admin_access', 'true');
            modalManage.classList.add('hidden');
            updateAdminUI();
            renderReportages();
        } else {
            alert("Codice errato.");
        }
    }

    btnManageSubmit.addEventListener('click', tryLogin);
    keyInput.addEventListener('keypress', e => { if (e.key === 'Enter') tryLogin(); });

    updateAdminUI();

    function shrinkImage(base64Str, quality, maxDim) {
        quality = quality || 0.7; // Qualità superiore per Strada C
        maxDim = maxDim || 1400;  // 1400px (ogni foto ha il suo documento da 1MB dedicato)
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > h && w > maxDim) { h *= maxDim / w; w = maxDim; }
                else if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64Str;
        });
    }

    // ─── CARICAMENTO REPORTAGE (STRUTTURA FRAMMENTATA) ──────────────────────────
    function loadReportages() {
        if (typeof firebase === 'undefined' || !window.db) return;

        window.db.collection("reportages").orderBy("timestamp", "desc").onSnapshot(snap => {
            reportages = [];
            snap.forEach(doc => {
                const repData = Object.assign({ id: doc.id, images: [] }, doc.data());
                reportages.push(repData);

                // Carica le foto associate a questo reportage nella collezione "photos"
                window.db.collection("photos")
                    .where("reportageId", "==", doc.id)
                    .orderBy("index", "asc")
                    .get()
                    .then(photoSnap => {
                        const photos = [];
                        photoSnap.forEach(pDoc => photos.push(pDoc.data().base64));
                        repData.images = photos;
                        renderReportages(); // Aggiorna la vista quando le foto arrivano

                        // Backup locale aggiornato
                        localStorage.setItem('local_backup_reportages', JSON.stringify(reportages));
                    });
            });
            renderReportages();
        });
    }

    function renderReportages() {
        reportageContainer.innerHTML = '';
        if (reportages.length === 0) {
            reportageContainer.innerHTML = '<p style="text-align:center;padding:20px;">Nessun reportage.</p>';
            return;
        }
        reportages.forEach(rep => {
            const article = document.createElement('article');
            article.className = 'glass-panel reportage-post';

            // Gestione foto caricate asincronamente
            let imgHtml = '';
            if (rep.images && rep.images.length > 0) {
                imgHtml = rep.images.map(img => `<img src="${img}" alt="Foto" draggable="false">`).join('');
            } else {
                imgHtml = '<div class="loading-images"><i class="fas fa-spinner fa-spin"></i> Caricamento immagini...</div>';
            }

            const delBtn = isAdmin ? `<button class="btn-delete" data-id="${rep.id}"><i class="fas fa-trash"></i> Elimina</button>` : '';
            const comms = (rep.comments || []).map(c => `<div class="comment-item"><b>${c.name}</b>: ${c.text}</div>`).join('');

            article.innerHTML = `
                ${delBtn}
                <div class="reportage-images">${imgHtml}</div>
                <div class="reportage-content">
                    <p>${rep.desc.replace(/\n/g, '<br>')}</p>
                    <small>${rep.date} | ${rep.location}</small>
                </div>
                <div class="comments-section">
                    <h5>Commenti</h5>
                    <div class="comments-list">${comms}</div>
                    <form class="comment-form" data-id="${rep.id}">
                        <input type="text" name="name" placeholder="Nome" required>
                        <textarea name="text" placeholder="Commento..." required></textarea>
                        <button type="submit">Invia</button>
                    </form>
                </div>`;
            reportageContainer.appendChild(article);
        });

        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = form.getAttribute('data-id');
                const name = form.querySelector('[name="name"]').value;
                const text = form.querySelector('[name="text"]').value;
                const rep = reportages.find(r => r.id === id);
                if (rep) {
                    const updated = (rep.comments || []).concat([{ name, text }]);
                    window.db.collection("reportages").doc(id).update({ comments: updated });
                }
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (confirm("Attenzione: Questa azione eliminerà definitivamente il reportage e tutte le sue foto. Procedere?")) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminazione...';

                    try {
                        // 1. Trova ed elimina tutte le foto associate in "photos"
                        const photoSnap = await window.db.collection("photos").where("reportageId", "==", id).get();
                        const batch = window.db.batch();
                        photoSnap.forEach(pDoc => batch.delete(pDoc.ref));
                        await batch.commit();

                        // 2. Elimina il documento "madre" del reportage
                        await window.db.collection("reportages").doc(id).delete();
                    } catch (err) {
                        console.error("Errore eliminazione:", err);
                        alert("Errore durante l'eliminazione.");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash"></i> Elimina';
                    }
                }
            });
        });
    }

    btnAddReportage.addEventListener('click', () => {
        modalAdd.classList.remove('hidden');
        modalAdd.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    const closeAdd = () => {
        modalAdd.classList.remove('active');
        modalAdd.classList.add('hidden');
        document.body.style.overflow = 'auto';
        formAddReportage.reset();
        imagePreview.innerHTML = '';
        currentImagesBase64 = [];
    };

    btnCloseModal.addEventListener('click', closeAdd);

    imagesInput.addEventListener('change', async function () {
        imagePreview.innerHTML = '<span>Elaborazione immagini in corso...</span>';
        currentImagesBase64 = [];
        for (let file of Array.from(this.files)) {
            const base64 = await new Promise(res => {
                const rd = new FileReader();
                rd.onload = e => shrinkImage(e.target.result).then(res);
                rd.readAsDataURL(file);
            });
            currentImagesBase64.push(base64);
        }
        imagePreview.innerHTML = currentImagesBase64.map(b => `<img src="${b}">`).join('');
    });

    // ─── SALVA (STRUTTURA FRAMMENTATA - ILLIMITATA) ─────────────────────────────
    formAddReportage.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentImagesBase64.length) return alert("Scegli le foto.");
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparazione...';

        try {
            const timestamp = Date.now();

            // 1. Crea il documento principale del reportage
            const repRef = await window.db.collection("reportages").add({
                desc: document.getElementById('rep-desc').value,
                date: document.getElementById('rep-date').value,
                location: document.getElementById('rep-location').value,
                comments: [],
                timestamp: timestamp
            });

            const reportageId = repRef.id;

            // 2. Salva le foto una ad una come documenti separati
            for (let i = 0; i < currentImagesBase64.length; i++) {
                const prog = Math.round(((i + 1) / currentImagesBase64.length) * 100);
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> FOTO ${i + 1}/${currentImagesBase64.length} (${prog}%)`;

                await window.db.collection("photos").add({
                    reportageId: reportageId,
                    base64: currentImagesBase64[i],
                    index: i,
                    timestamp: timestamp
                });
            }

            closeAdd();
            alert("Reportage pubblicato con successo!");
        } catch (err) {
            console.error("Errore salvataggio Strada C:", err);
            alert("Errore durante il caricamento. Riprova con meno foto o controlla la connessione.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Pubblica';
        }
    });

    reportageContainer.addEventListener('click', e => {
        const img = e.target.closest('.reportage-images img');
        if (img) {
            currentLightboxImages = Array.from(img.closest('.reportage-images').querySelectorAll('img')).map(i => i.src);
            currentLightboxIndex = currentLightboxImages.indexOf(img.src);
            lightboxImg.src = currentLightboxImages[currentLightboxIndex];
            modalLightbox.classList.remove('hidden');
            modalLightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });

    const closeL = () => { modalLightbox.classList.remove('active'); modalLightbox.classList.add('hidden'); document.body.style.overflow = 'auto'; };
    closeLightboxBtn.addEventListener('click', closeL);
    nextLightboxBtn.addEventListener('click', e => { e.stopPropagation(); currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length; lightboxImg.src = currentLightboxImages[currentLightboxIndex]; });
    prevLightboxBtn.addEventListener('click', e => { e.stopPropagation(); currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length; lightboxImg.src = currentLightboxImages[currentLightboxIndex]; });

    document.addEventListener('keydown', e => {
        if (!modalLightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') nextLightboxBtn.click();
        if (e.key === 'ArrowLeft') prevLightboxBtn.click();
        if (e.key === 'Escape') closeL();
    });

    // Protezioni
    document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('keydown', e => { if (e.ctrlKey && (e.key === 's' || e.key === 'u')) e.preventDefault(); });

    loadReportages();
});
