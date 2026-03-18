// ═══════════════════════════════════════════════════
// CONFIGURAZIONE FIREBASE — non modificare
// ═══════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyAlMRkoZGtHbm7fEX4a9V33nlMTZv-oY5s",
  authDomain:        "fotoblog-7fa65.firebaseapp.com",
  projectId:         "fotoblog-7fa65",
  storageBucket:     "fotoblog-7fa65.appspot.com",
  messagingSenderId: "882034034731",
  appId:             "1:882034034731:web:f48fb5f8e3b6ceedf4026e"
};

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
  }
} catch (e) { console.error("Firebase Init Error:", e); }

// ═══════════════════════════════════════════════════
// COSTANTI
// ═══════════════════════════════════════════════════
const ACCESS_KEY = "89Bf760rT$%";

// ═══════════════════════════════════════════════════
// STATO GLOBALE
// ═══════════════════════════════════════════════════
let isAdmin               = false;
let reportages            = [];
let currentImagesBase64   = [];
let lbImages              = [];   // immagini nel lightbox corrente
let lbIndex               = 0;   // indice foto corrente nel lightbox
let activePhotoIndex      = {};   // { repId: index } foto principale selezionata

// ═══════════════════════════════════════════════════
// DOM READY
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Elementi UI
  const btnManage      = document.getElementById('btn-manage');
  const btnAddRep      = document.getElementById('btn-add-reportage');
  const modalManage    = document.getElementById('modal-manage');
  const modalAdd       = document.getElementById('modal-add-reportage');
  const modalLightbox  = document.getElementById('modal-lightbox');
  const closeManage    = document.getElementById('close-manage');
  const closeAdd       = document.getElementById('close-add');
  const closeLightbox  = document.getElementById('close-lightbox');
  const prevLightbox   = document.getElementById('prev-lightbox');
  const nextLightbox   = document.getElementById('next-lightbox');
  const keyInput       = document.getElementById('key-input');
  const btnSubmitKey   = document.getElementById('btn-manage-submit');
  const formAdd        = document.getElementById('form-add-reportage');
  const imagesInput    = document.getElementById('rep-images');
  const imagePreview   = document.getElementById('image-preview');
  const repContainer   = document.getElementById('reportage-container');
  const postCount      = document.getElementById('post-count');
  const lightboxImg    = document.getElementById('lightbox-img');
  const lightboxMeta   = document.getElementById('lightbox-meta');
  const lightboxWhy    = document.getElementById('lightbox-why-text');
  const lightboxIndex  = document.getElementById('lightbox-index');

  // ── Ripristino sessione admin ──
  try {
    isAdmin = localStorage.getItem('blog_admin_access') === 'true';
  } catch (e) {}
  updateAdminUI();

  // ══════════════════════════════
  // ADMIN LOGIN / LOGOUT
  // ══════════════════════════════
  btnManage.addEventListener('click', () => {
    if (isAdmin) {
      if (confirm('Uscire dalla modalità gestione?')) {
        isAdmin = false;
        try { localStorage.removeItem('blog_admin_access'); } catch (e) {}
        updateAdminUI();
        renderReportages();
      }
    } else {
      openModal(modalManage);
      keyInput.focus();
    }
  });

  closeManage.addEventListener('click', () => closeModal(modalManage));
  btnSubmitKey.addEventListener('click', tryLogin);
  keyInput.addEventListener('keypress', e => { if (e.key === 'Enter') tryLogin(); });

  function tryLogin() {
    if (keyInput.value === ACCESS_KEY) {
      isAdmin = true;
      try { localStorage.setItem('blog_admin_access', 'true'); } catch (e) {}
      closeModal(modalManage);
      keyInput.value = '';
      updateAdminUI();
      renderReportages();
    } else {
      keyInput.style.borderColor = '#884444';
      setTimeout(() => { keyInput.style.borderColor = ''; }, 1000);
    }
  }

  function updateAdminUI() {
    btnAddRep.classList.toggle('hidden', !isAdmin);
    btnManage.classList.toggle('is-admin', isAdmin);
  }

  // ══════════════════════════════
  // MODALE AGGIUNGI REPORTAGE
  // ══════════════════════════════
  btnAddRep.addEventListener('click', () => {
    openModal(modalAdd);
    // data di default = oggi
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rep-date').value = today;
  });

  closeAdd.addEventListener('click', () => {
    closeModal(modalAdd);
    resetForm();
  });

  // Anteprima immagini
  imagesInput.addEventListener('change', async function () {
    imagePreview.innerHTML = '<span>Elaborazione immagini...</span>';
    currentImagesBase64 = [];
    for (const file of Array.from(this.files)) {
      const b64 = await fileToBase64(file);
      const compressed = await shrinkImage(b64, 0.72, 1400);
      currentImagesBase64.push(compressed);
    }
    imagePreview.innerHTML = currentImagesBase64
      .map(b => `<img src="${b}" alt="">`)
      .join('');
  });

  // Submit nuovo reportage
  formAdd.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentImagesBase64.length) return;

    const btn = document.getElementById('btn-submit-rep');
    btn.disabled = true;

    try {
      const timestamp = Date.now();

      // Crea il documento principale del reportage
      const repRef = await window.db.collection('reportages').add({
        desc:      document.getElementById('rep-desc').value.trim(),
        why:       document.getElementById('rep-why').value.trim(),
        date:      document.getElementById('rep-date').value,
        location:  document.getElementById('rep-location').value.trim(),
        meta:      document.getElementById('rep-meta').value.trim(),
        comments:  [],
        timestamp: timestamp
      });

      // Carica le foto una alla volta
      for (let i = 0; i < currentImagesBase64.length; i++) {
        const pct = Math.round(((i + 1) / currentImagesBase64.length) * 100);
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i + 1}/${currentImagesBase64.length} (${pct}%)`;
        await window.db.collection('photos').add({
          reportageId: repRef.id,
          base64:      currentImagesBase64[i],
          index:       i,
          timestamp:   timestamp
        });
      }

      closeModal(modalAdd);
      resetForm();
    } catch (err) {
      console.error('Errore salvataggio:', err);
      alert('Errore durante il caricamento. Riprova.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Pubblica';
    }
  });

  // ══════════════════════════════
  // CARICAMENTO REPORTAGE
  // ══════════════════════════════
  function loadReportages() {
    if (!window.db) return;

    window.db.collection('reportages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        reportages = [];

        snap.forEach(doc => {
          const rep = { id: doc.id, images: [], ...doc.data() };
          reportages.push(rep);

          // Carica le foto di questo reportage
          window.db.collection('photos')
            .where('reportageId', '==', doc.id)
            .get()
            .then(photoSnap => {
              const photos = [];
              photoSnap.forEach(pDoc => photos.push(pDoc.data()));
              photos.sort((a, b) => (a.index || 0) - (b.index || 0));
              rep.images = photos.map(p => p.base64);
              renderReportages();
              // Backup locale
              try { localStorage.setItem('local_backup_reportages', JSON.stringify(reportages)); } catch (e) {}
            });
        });

        renderReportages();
      });
  }

  // ══════════════════════════════
  // RENDER REPORTAGE
  // ══════════════════════════════
  function renderReportages() {
    if (!reportages.length) {
      repContainer.innerHTML = '<div class="empty-state">Nessun reportage pubblicato</div>';
      postCount.textContent = '0';
      return;
    }

    postCount.textContent = reportages.length + (reportages.length === 1 ? ' storia' : ' storie');
    repContainer.innerHTML = '';

    reportages.forEach(rep => {
      const activeIdx = activePhotoIndex[rep.id] || 0;
      const hasImages = rep.images && rep.images.length > 0;

      // Foto principale
      const mainSrc = hasImages ? rep.images[activeIdx] : '';
      const mainImgHtml = hasImages
        ? `<img src="${mainSrc}" alt="Foto principale">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:10px;letter-spacing:0.2em;color:var(--text3);text-transform:uppercase;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;color:var(--gold)"></i>Caricamento foto...</div>`;

      // Miniature
      const thumbsHtml = hasImages && rep.images.length > 1
        ? `<div class="rep-thumbnails" id="thumbs-${rep.id}">
            ${rep.images.map((img, i) => `
              <div class="rep-thumb ${i === activeIdx ? 'active' : ''}"
                   onclick="switchRepPhoto('${rep.id}', ${i})"
                   style="pointer-events:all;cursor:pointer;">
                <img src="${img}" alt="Miniatura ${i+1}">
              </div>`).join('')}
           </div>`
        : '';

      const counterHtml = hasImages && rep.images.length > 1
        ? `<div class="rep-photo-counter">${activeIdx + 1} / ${rep.images.length}</div>`
        : '';

      // Perché ho scattato
      const whyHtml = rep.why
        ? `<div class="rep-why-block">
             <p class="rep-why-label">Perché ho scattato questa foto</p>
             <p class="rep-why-text">${escHtml(rep.why)}</p>
           </div>`
        : '';

      // Dati tecnici
      const metaHtml = rep.meta
        ? `<span class="rep-photo-meta">© ${rep.date?.slice(0,4) || '2024'} ◦ ${escHtml(rep.meta)}</span>`
        : `<span class="rep-photo-meta">© ${rep.date?.slice(0,4) || '2024'}</span>`;

      // Commenti
      const commentsHtml = (rep.comments || [])
        .map(c => `<div class="comment-item">
          <b>${escHtml(c.name)}</b>
          <span>${escHtml(c.text)}</span>
        </div>`).join('');

      // Bottone elimina
      const deleteBtn = isAdmin
        ? `<button class="btn-delete" onclick="deleteReportage('${rep.id}')">
             <i class="fas fa-trash"></i> Elimina reportage
           </button>`
        : '';

      const article = document.createElement('article');
      article.className = 'reportage-post';
      article.id = 'rep-' + rep.id;
      article.innerHTML = `
        ${deleteBtn}
        <div class="rep-gallery">
          <div class="rep-main-photo" id="mainphoto-${rep.id}"
               onclick="openLightboxFor('${rep.id}')"
               style="pointer-events:all;cursor:pointer;">
            ${mainImgHtml}
            <div class="photo-overlay"></div>
            <span class="rep-zoom-hint">+ Ingrandisci</span>
            ${metaHtml}
          </div>
          ${thumbsHtml}
          ${counterHtml}
        </div>
        <div class="rep-body">
          <p class="rep-tag">${escHtml(rep.location)} ◦ ${formatDate(rep.date)}</p>
          <p class="rep-desc">${escHtml(rep.desc)}</p>
          ${whyHtml}
          <div class="rep-location-date">
            <span><i class="fas fa-map-marker-alt"></i>${escHtml(rep.location)}</span>
            <span><i class="fas fa-calendar-alt"></i>${formatDate(rep.date)}</span>
          </div>
        </div>
        <div class="rep-comments">
          <p class="rep-comments-title">Commenti</p>
          <div class="comments-list" id="comments-${rep.id}">${commentsHtml}</div>
          <form class="comment-form" data-id="${rep.id}" onsubmit="addComment(event, '${rep.id}')">
            <input type="text" name="name" placeholder="Il tuo nome" required>
            <textarea name="text" rows="2" placeholder="Scrivi un commento..." required></textarea>
            <button type="submit">Invia commento</button>
          </form>
        </div>`;

      repContainer.appendChild(article);
    });
  }

  // ══════════════════════════════
  // LIGHTBOX
  // ══════════════════════════════
  window.openLightboxFor = function(repId) {
    const rep = reportages.find(r => r.id === repId);
    if (!rep || !rep.images?.length) return;
    lbImages = rep.images.map(img => ({
      src:  img,
      meta: rep.meta ? `${rep.location} ◦ ${formatDate(rep.date)} ◦ ${rep.meta}` : `${rep.location} ◦ ${formatDate(rep.date)}`,
      why:  rep.why || ''
    }));
    lbIndex = activePhotoIndex[repId] || 0;
    renderLightbox();
    openModal(modalLightbox);
  };

  function renderLightbox() {
    const item = lbImages[lbIndex];
    lightboxImg.src        = item.src;
    lightboxMeta.textContent  = item.meta;
    lightboxWhy.textContent   = item.why;
    lightboxIndex.textContent = (lbIndex + 1) + ' / ' + lbImages.length;
    prevLightbox.style.display = lbImages.length > 1 ? '' : 'none';
    nextLightbox.style.display = lbImages.length > 1 ? '' : 'none';
  }

  prevLightbox.addEventListener('click', e => {
    e.stopPropagation();
    lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length;
    renderLightbox();
  });

  nextLightbox.addEventListener('click', e => {
    e.stopPropagation();
    lbIndex = (lbIndex + 1) % lbImages.length;
    renderLightbox();
  });

  closeLightbox.addEventListener('click', () => closeModal(modalLightbox));
  modalLightbox.addEventListener('click', e => {
    if (e.target === modalLightbox) closeModal(modalLightbox);
  });

  // ══════════════════════════════
  // CAMBIO FOTO (miniature)
  // ══════════════════════════════
  window.switchRepPhoto = function(repId, photoIdx) {
    const rep = reportages.find(r => r.id === repId);
    if (!rep || !rep.images) return;
    activePhotoIndex[repId] = photoIdx;

    // Aggiorna foto principale
    const mainPhotoDiv = document.getElementById('mainphoto-' + repId);
    if (mainPhotoDiv) {
      const img = mainPhotoDiv.querySelector('img');
      if (img) img.src = rep.images[photoIdx];
    }

    // Aggiorna miniature active
    const thumbsDiv = document.getElementById('thumbs-' + repId);
    if (thumbsDiv) {
      thumbsDiv.querySelectorAll('.rep-thumb').forEach((t, i) => {
        t.classList.toggle('active', i === photoIdx);
      });
    }

    // Aggiorna contatore
    const article = document.getElementById('rep-' + repId);
    if (article) {
      const counter = article.querySelector('.rep-photo-counter');
      if (counter) counter.textContent = (photoIdx + 1) + ' / ' + rep.images.length;
    }
  };

  // ══════════════════════════════
  // COMMENTI
  // ══════════════════════════════
  window.addComment = function(e, repId) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('[name="name"]').value.trim();
    const text = form.querySelector('[name="text"]').value.trim();
    if (!name || !text) return;

    const rep = reportages.find(r => r.id === repId);
    if (!rep || !window.db) return;

    const updated = (rep.comments || []).concat([{ name, text }]);
    window.db.collection('reportages').doc(repId).update({ comments: updated })
      .then(() => { form.reset(); });
  };

  // ══════════════════════════════
  // ELIMINA REPORTAGE
  // ══════════════════════════════
  window.deleteReportage = async function(repId) {
    if (!confirm('Eliminare definitivamente questo reportage e tutte le sue foto?')) return;
    try {
      const photoSnap = await window.db.collection('photos').where('reportageId', '==', repId).get();
      const batch = window.db.batch();
      photoSnap.forEach(pDoc => batch.delete(pDoc.ref));
      await batch.commit();
      await window.db.collection('reportages').doc(repId).delete();
    } catch (err) {
      console.error('Errore eliminazione:', err);
      alert('Errore durante l\'eliminazione.');
    }
  };

  // ══════════════════════════════
  // KEYBOARD NAVIGATION
  // ══════════════════════════════
  document.addEventListener('keydown', e => {
    if (modalLightbox.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') nextLightbox.click();
    if (e.key === 'ArrowLeft')  prevLightbox.click();
    if (e.key === 'Escape')     closeModal(modalLightbox);
  });

  // ══════════════════════════════
  // PROTEZIONE IMMAGINI
  // ══════════════════════════════
  document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
  document.addEventListener('dragstart',   e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
  // Blocca Ctrl+S, Ctrl+U, Ctrl+Shift+I (devtools), F12
  document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) { e.preventDefault(); return; }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) e.preventDefault();
  });
  // Blocca long-press su mobile (iOS/Android)
  document.addEventListener('touchstart', e => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  }, { passive: false });
  // Blocca print screen indirettamente disattivando la visibilità in print
  const printStyle = document.createElement('style');
  printStyle.textContent = '@media print { img { display: none !important; } }';
  document.head.appendChild(printStyle);

  // ══════════════════════════════
  // AVVIO
  // ══════════════════════════════
  loadReportages();

  // ══════════════════════════════
  // UTILITY
  // ══════════════════════════════
  function openModal(el)  { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(el) { el.classList.add('hidden');    document.body.style.overflow = '';       }

  function resetForm() {
    document.getElementById('form-add-reportage').reset();
    imagePreview.innerHTML = '<span>Nessuna foto selezionata</span>';
    currentImagesBase64 = [];
  }

  function fileToBase64(file) {
    return new Promise(res => {
      const rd = new FileReader();
      rd.onload = e => res(e.target.result);
      rd.readAsDataURL(file);
    });
  }

  function shrinkImage(base64, quality, maxDim) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h > maxDim)     { w = Math.round(w * maxDim / h); h = maxDim; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
  }

}); // fine DOMContentLoaded
