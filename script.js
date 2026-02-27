
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

    let currentImagesBase64 = [];
    let reportages = [];
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
        maxDim = maxDim || 1200;
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
            btn.addEventListener('click', function () {
                var docId = btn.getAttribute('data-id');
                if (confirm("Sei sicuro di voler eliminare questo reportage?")) {
                    window.db.collection("reportages").doc(docId).delete()
                        .catch(function (err) { console.error(err); });
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
    formAddReportage.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!currentImagesBase64.length) {
            alert("Seleziona almeno una foto prima di continuare.");
            return;
        }

        var btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';

        // Calcolo approssimativo della dimensione (Firestore ha limite 1MB per documento)
        var totalSize = JSON.stringify(currentImagesBase64).length;
        console.log("Dimensione stimata post:", Math.round(totalSize / 1024), "KB");

        if (totalSize > 950000) { // Un po' meno di 1MB per sicurezza
            alert("Errore: Il reportage \u00e8 troppo pesante (troppe foto o troppo grandi).\n\nProva a caricare meno foto o foto pi\u00f9 piccole.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
            return;
        }

        if (typeof firebase === 'undefined' || !window.db) {
            alert("Errore: Il database non \u00e8 inizializzato. Controlla la connessione.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
            return;
        }

        // Timeout di 15 secondi per evitare il caricamento infinito
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: Il database non risponde. Controlla le regole Firestore.")), 15000)
        );

        Promise.race([
            window.db.collection("reportages").add({
                images: currentImagesBase64,
                desc: document.getElementById('rep-desc').value,
                date: document.getElementById('rep-date').value,
                location: document.getElementById('rep-location').value,
                comments: [],
                timestamp: Date.now()
            }),
            timeoutPromise
        ]).then(function () {
            console.log("Salvataggio completato con successo.");
            closeModal();
            alert("Reportage pubblicato con successo!");
        }).catch(function (err) {
            console.error("Errore salvataggio Firestore:", err);
            var errorMsg = "Errore durante il salvataggio.";
            if (err.message.includes("Timeout")) {
                errorMsg = "Il salvataggio sta impiegando troppo tempo.\n\n1. Controlla la connessione internet.\n2. Verifica di aver pubblicato le REGOLE su Firebase (allow read, write: if true).\n3. Prova a caricare meno foto.";
            } else if (err.code === 'permission-denied') {
                errorMsg += "\n\nAssicurati di aver impostato le REGOLE di Firestore su 'true' nella console di Firebase.";
            } else {
                errorMsg += "\n\n" + err.message;
            }
            alert(errorMsg);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Aggiungi';
        });
    });

    // ─── START ───────────────────────────────────────────────────────────────
    loadReportages();
});

