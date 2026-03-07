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
// Per cambiare il codice: sostituisci "89Bf760rT$%" con la tua scelta
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
    let currentLightboxImages = []; // Lista immagini del reportage aperto
    let currentLightboxIndex = 0;   // Indice immagine corrente
    let isAdmin = false;

    // --- FALLBACK LOCALE ---
    try {
        isAdmin = localStorage.getItem('blog_admin_access') === 'true';
        const backup = localStorage.getItem('local_backup_reportages');
        if (backup) {
            reportages = JSON.parse(backup);
            console.log("Dati locali caricati come backup.");
        }
    } catch (e) {
        console.warn("localStorage non accessibile.");
    }

    console.log("Script Avviato. Stato Admin:", isAdmin);

    // ─── AUTENTICAZIONE ──────────────────────────────────────────────────────

    function updateAdminUI() {
        if (isAdmin) {
            btnAddReportage.classList.remove('hidden');
            btnManage.style.color = 'var(--accent)';
            btnManage.title = "Pannello attivo — clicca per uscire";
        } else {
            btnAddReportage.classList.add('hidden');
            btnManage.style.color = '#ccc';
            btnManage.title = "Gestione";
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
            keyInput.value = '';
            keyInput.placeholder = 'Codice errato, riprova...';
            setTimeout(() => {
                keyInput.style.border = '1px solid #ccc';
                keyInput.placeholder = 'Inserisci il codice';
            }, 2000);
        }
    }

    btnManageSubmit.addEventListener('click', tryLogin);
    keyInput.addEventListener('keypress', e => { if (e.key === 'Enter') tryLogin(); });

    updateAdminUI();

    // ─── COMPRESSIONE IMMAGINE ───────────────────────────────────────────────
    function shrinkImage(base64Str, quality, maxDim) {
        quality = quality || 0.6;
        maxDim = maxDim || 1000;
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
        if (typeof firebase === 'undefined' || !window.db) {
            reportageContainer.innerHTML =
                '<div class="glass-panel" style="text-align:center;padding:40px;">' +
                '<p style="color:#cc0000"><strong>Errore Caricamento SDK</strong><br>' +
                'Sembra che il browser stia bloccando i componenti necessari per il database.<br>' +
                'Prova a usare Chrome o Edge, oppure carica il sito online su Netlify.</p></div>';
            return;
        }

        window.db.collection("reportages")
            .orderBy("timestamp", "desc")
            .onSnapshot(function (snapshot) {
                reportages = [];
                snapshot.forEach(function (docSnap) {
                    reportages.push(Object.assign({ id: docSnap.id }, docSnap.data()));
                });

                // Salva copia locale per emergenza
                try {
                    localStorage.setItem('local_backup_reportages', JSON.stringify(reportages));
                } catch (e) { }

                renderReportages();
            }, function (err) {
                console.error("Errore Firestore:", err.code);
                var msg = "Errore di connessione al database.";
                if (err.code === 'permission-denied') {
                    msg = "\u26a0\ufe0f <strong>Firestore non ancora configurato.</strong><br>" +
                        "Vai su <a href='https://console.firebase.google.com' target='_blank'>console.firebase.google.com</a>" +
                        " \u2192 progetto <strong>fotoblog-7fa65</strong> \u2192 <strong>Firestore Database</strong> \u2192 tab <strong>Regole</strong><br>" +
                        "e imposta: <code>allow read, write: if true;</code> poi clicca <strong>Pubblica</strong>.";
                }
                reportageContainer.innerHTML =
                    '<div class="glass-panel" style="text-align:center;padding:40px;">' +
                    '<p style="color:#cc0000;line-height:2">' + msg + '</p></div>';
            });
    }

    // ─── RENDERING ──────────────────────────────────────────────────────────
    function renderReportages() {
        reportageContainer.innerHTML = '';
        if (reportages.length === 0) {
            reportageContainer.innerHTML =
                '<div class="glass-panel" style="text-align:center;padding:40px;">' +
                '<p>Non ci sono ancora reportage pubblicati.<br>' +
                '<small style="color:#999">Usa il lucchetto in fondo alla pagina per accedere e pubblicare.</small></p></div>';
            return;
        }

        reportages.forEach(function (rep) {
            var article = document.createElement('article');
            article.className = 'glass-panel reportage-post';
            article.id = 'rep-' + rep.id;

            var commentsHtml = '';
            if (rep.comments && rep.comments.length > 0) {
                rep.comments.forEach(function (c) {
                    commentsHtml += '<div class="comment-item">' +
                        '<div class="comment-author">' + c.name + '</div>' +
                        '<div class="comment-text">' + c.text + '</div></div>';
                });
            } else {
                commentsHtml = '<p style="color:#666;font-size:0.9rem;margin-bottom:10px">Nessun commento ancora. Sii il primo!</p>';
            }

            var formattedDate = '';
            if (rep.date) {
                formattedDate = new Date(rep.date).toLocaleDateString('it-IT', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            }

            var imagesHtml = '';
            if (rep.images && rep.images.length > 0) {
                rep.images.forEach(function (img) {
                    imagesHtml += '<img src="' + img + '" alt="Foto Reportage">';
                });
            }

            var deleteBtn = isAdmin
                ? '<div class="reportage-header-actions"><button class="btn-delete" data-id="' + rep.id + '"><i class="fas fa-trash"></i> Elimina reportage</button></div>'
                : '';

            article.innerHTML = deleteBtn +
                '<div class="reportage-images">' + imagesHtml + '</div>' +
                '<div class="reportage-content">' +
                '<p class="reportage-desc">' + rep.desc.replace(/\n/g, '<br>') + '</p>' +
                '<p class="reportage-meta">' +
                '<i class="fas fa-calendar-alt"></i> ' + formattedDate +
                '<span style="margin:0 10px">|</span>' +
                '<i class="fas fa-map-marker-alt"></i> ' + rep.location +
                '</p></div>' +
                '<div class="comments-section"><h5>Commenti</h5>' +
                '<div class="comments-list">' + commentsHtml + '</div>' +
                '<form class="comment-form" data-id="' + rep.id + '">' +
                '<input type="text" name="name" placeholder="Nome" required>' +
                '<input type="email" name="email" placeholder="Email" required>' +
                '<textarea name="text" placeholder="Scrivi un commento..." required></textarea>' +
                '<button type="submit">Aggiungi Commento</button>' +
                '</form></div>';

            reportageContainer.appendChild(article);
        });

        attachCommentListeners();
        if (isAdmin) attachDeleteListeners();
    }

    // ─── COMMENTI ────────────────────────────────────────────────────────────
    function attachCommentListeners() {
        document.querySelectorAll('.comment-form').forEach(function (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var btn = form.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.textContent = 'Invio...';

                var docId = form.getAttribute('data-id');
                var name = form.querySelector('[name="name"]').value;
                var text = form.querySelector('[name="text"]').value;

                var rep = reportages.find(function (r) { return r.id === docId; });
                if (rep) {
                    var newComments = (rep.comments || []).concat([{ name: name, text: text }]);
                    window.db.collection("reportages").doc(docId).update({ comments: newComments })
                        .then(function () {
                            btn.disabled = false;
                            btn.textContent = 'Aggiungi Commento';
                        })
                        .catch(function (err) {
                            console.error(err);
                            btn.disabled = false;
                            btn.textContent = 'Aggiungi Commento';
                        });
                }
            });
        });
    }

    // ─── ELIMINA ─────────────────────────────────────────────────────────────
    function attachDeleteListeners() {
        document.querySelectorAll('.btn-delete').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var docId = btn.getAttribute('data-id');
                if (confirm("Sei sicuro di voler eliminare questo reportage?")) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminazione...';
                    try {
                        // Trova il reportage per eliminare anche le immagini da Storage se possibile
                        var rep = reportages.find(r => r.id === docId);
                        if (rep && rep.images && rep.images.length > 0) {
                            for (let url of rep.images) {
                                if (typeof url === 'string' && url.includes('firebasestorage')) {
                                    try {
                                        var ref = window.storage.refFromURL(url);
                                        await ref.delete();
                                    } catch (err) {
                                        console.warn("Impossibile eliminare l'immagine da storage:", url, err);
                                    }
                                }
                            }
                        }
                        await window.db.collection("reportages").doc(docId).delete();
                    } catch (err) {
                        console.error("Errore durante l'eliminazione:", err);
                        alert("Errore durante l'eliminazione: " + err.message);
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash"></i> Elimina reportage';
                    }
                }
            });
        });
    }

    // ─── MODALE AGGIUNGI REPORTAGE ───────────────────────────────────────────
    btnAddReportage.addEventListener('click', function () {
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

        var btn = formAddReportage.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
    }

    btnCloseModal.addEventListener('click', closeModal);
    modalAdd.addEventListener('click', function (e) { if (e.target === modalAdd) closeModal(); });

    // ─── LOGICA LIGHTBOX (ZOOM CON NAVIGAZIONE) ──────────────────────────────
    reportageContainer.addEventListener('click', function (e) {
        if (e.target.tagName === 'IMG' && e.target.closest('.reportage-images')) {
            const container = e.target.closest('.reportage-images');
            currentLightboxImages = Array.from(container.querySelectorAll('img')).map(img => img.src);
            currentLightboxIndex = currentLightboxImages.indexOf(e.target.src);

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
    nextLightboxBtn.addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });
    prevLightboxBtn.addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });

    // Navigazione da tastiera
    document.addEventListener('keydown', function (e) {
        if (!modalLightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'Escape') closeLightbox();
    });

    modalLightbox.addEventListener('click', function (e) {
        if (e.target === modalLightbox || e.target.classList.contains('lightbox-container')) {
            closeLightbox();
        }
    });

    // ─── ANTEPRIMA FOTO ───────────────────────────────────────────────────────
    imagesInput.addEventListener('change', async function () {
        imagePreview.innerHTML = '<span>Elaborazione immagini in corso...</span>';
        currentImagesBase64 = [];
        var files = Array.from(this.files);
        if (!files.length) {
            imagePreview.innerHTML = '<span>Nessuna foto selezionata</span>';
            return;
        }

        // Elaborazione SEQUENZIALE per non bloccare il browser
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            const compressed = await new Promise(resolve => {
                reader.onload = e => shrinkImage(e.target.result).then(resolve);
                reader.readAsDataURL(file);
            });
            currentImagesBase64.push(compressed);
        }

        imagePreview.innerHTML = '';
        currentImagesBase64.forEach(base64 => {
            var img = document.createElement('img');
            img.src = base64;
            imagePreview.appendChild(img);
        });
    });

    // ─── SALVA REPORTAGE ─────────────────────────────────────────────────────
    formAddReportage.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!currentImagesBase64.length) {
            alert("Seleziona almeno una foto prima di continuare.");
            return;
        }

        var btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';

        if (typeof firebase === 'undefined' || !window.db || !window.storage) {
            alert("Errore: Il database non \u00e8 inizializzato. Controlla la connessione.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
            return;
        }

        try {
            // Data e identificativo cartella per Firebase Storage
            const timestamp = Date.now();
            const reportageId = `rep_${timestamp}`;
            const uploadedImageUrls = [];

            // Timeout complessivo per l'operazione (aumentato a 3 minuti = 180 secondi)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout: Il caricamento sta impiegando più di 3 minuti. La tua connessione potrebbe essere troppo lenta per questo numero di foto ad alta risoluzione, prova in due tranche.")), 180000)
            );

            // Funzione di utilità per caricare una singola immagine con ricaricamento (retry)
            const uploadWithRetry = async (base64Str, imageRef, index, retries = 2) => {
                for (let i = 0; i <= retries; i++) {
                    try {
                        // 1. Convertiamo la stringa Base64 in un "Blob" (un vero file temporaneo)
                        // Questo è molto più leggero per la memoria del browser
                        const response = await fetch(base64Str);
                        const blob = await response.blob();

                        console.log(`[Upload Foto ${index + 1}] Tentativo ${i + 1}/${retries + 1} - Invio file binario...`);

                        // 2. Usiamo il metodo .put() che è il più solido per caricare file
                        const snapshot = await imageRef.put(blob);

                        console.log(`[Upload Foto ${index + 1}] Caricamento completato. Recupero link...`);
                        const downloadURL = await snapshot.ref.getDownloadURL();
                        return downloadURL;
                    } catch (err) {
                        console.error(`[Upload Foto ${index + 1}] Errore al tentativo ${i + 1}:`, err);
                        if (i === retries) throw err;
                        // Attesa crescente tra i tentativi
                        await new Promise(r => setTimeout(r, 2000 + (i * 1000)));
                    }
                }
            };

            const uploadPromise = async () => {
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Caricamento di ${currentImagesBase64.length} foto in corso...`;

                // Carichiamo le foto 1 alla volta (sequenziale)
                for (let i = 0; i < currentImagesBase64.length; i++) {
                    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Caricamento foto ${i + 1} di ${currentImagesBase64.length}...`;

                    const imageRef = window.storage.ref(`reportages/${reportageId}/img_${i}.jpg`);
                    const downloadURL = await uploadWithRetry(currentImagesBase64[i], imageRef, i);
                    uploadedImageUrls.push(downloadURL);
                }

                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio dati reportage...';

                // 2. Salva il documento su Firestore
                await window.db.collection("reportages").add({
                    images: uploadedImageUrls,
                    desc: document.getElementById('rep-desc').value,
                    date: document.getElementById('rep-date').value,
                    location: document.getElementById('rep-location').value,
                    comments: [],
                    timestamp: timestamp
                });
            };

            await Promise.race([uploadPromise(), timeoutPromise]);

            console.log("Salvataggio completato con successo.");
            closeModal();
            alert("Reportage pubblicato con successo!");

        } catch (err) {
            console.error("Errore salvataggio:", err);
            var errorMsg = "Errore durante il salvataggio.";
            if (err.message.includes("Timeout")) {
                errorMsg = err.message;
            } else if (err.code === 'storage/unauthorized' || err.code === 'permission-denied') {
                errorMsg += "\n\nPermesso negato. Assicurati di aver impostato le REGOLE DI STORAGE (e Firestore) su 'allow read, write: if true;' nella console di Firebase come indicato nelle istruzioni.";
            } else {
                errorMsg += "\n\n" + (err.message || "Errore sconosciuto.");
            }
            alert(errorMsg);
        } finally {
            if (modalAdd.classList.contains('active')) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
            }
        }
    });

    // ─── PROTEZIONE IMMAGINI ────────────────────────────────────────────────
    // Impedisce il tasto destro sulle immagini (sia nei reportage che nel lightbox)
    document.addEventListener('contextmenu', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    // Blocca scorciatoie comuni per salvataggio o ispezione base
    document.addEventListener('keydown', function (e) {
        // Ctrl+S (Salva con nome)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
        }
        // Ctrl+U (Visualizza sorgente) - Deterrente minore
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
        }
    });

    // ─── START ───────────────────────────────────────────────────────────────
    loadReportages();
});
