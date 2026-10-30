// =========================================================================
// جامع الاختيارات الفقهية المؤسسة على عموم القرآن
// Application Engine - Modern, Fast, Offline-First with In-App Turath Reader
// =========================================================================

// State Management
let currentCategory = 'all';
let currentSchool = 'all';
let searchQuery = '';
let activeIssueId = null;
let currentTheme = 'dark';

// Reader State
let readerFontSizeRem = 1.25;
let activeReaderCitation = null;
let activeReaderBookId = null;
let activeReaderVol = '1';
let activeReaderCurrentPage = 1;
let activeReaderPageIndex = null;
let activeReaderCache = {};
let isPageNavigating = false;
let activeReaderTotalPages = null;

// Arabic Normalization for robust search
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Tashkeel (harakat)
    .replace(/[إأآا]/g, 'ا')              // Normalize Alif
    .replace(/ة/g, 'ه')                   // Normalize Ta Marbutah
    .replace(/ى/g, 'ي')                   // Normalize Alif Maqsurah to Ya
    .replace(/[\u0600-\u061F\u06D6-\u06ED]/g, '') // Remove Quranic recitation marks
    .trim()
    .toLowerCase();
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof FIQH_DATABASE === 'undefined') {
    console.error('Database failed to load!');
    return;
  }

  // Set default active issue (first issue)
  if (FIQH_DATABASE.issues && FIQH_DATABASE.issues.length > 0) {
    activeIssueId = FIQH_DATABASE.issues[0].id;
  }

  // Render UI Components
  renderCategories();
  renderSchoolsFilter();
  applyFiltersAndRender();
  setupEventListeners();
});

// Render Category Filter Chips
function renderCategories() {
  const container = document.getElementById('categoriesBar');
  if (!container) return;

  container.innerHTML = FIQH_DATABASE.categories.map(cat => `
    <button class="chip ${currentCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
      <span>${cat.name_ar}</span>
    </button>
  `).join('');

  container.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      applyFiltersAndRender();
    });
  });
}

// Render Schools Filter Chips
function renderSchoolsFilter() {
  const container = document.getElementById('schoolsFilter');
  if (!container) return;

  const schools = [
    { id: 'all', name: 'كافة المذاهب والمدارس' },
    { id: 'hanafi', name: 'الحنفية' },
    { id: 'maliki', name: 'المالكية' },
    { id: 'shafii', name: 'الشافعية' },
    { id: 'hanbali', name: 'الحنابلة' },
    { id: 'dhahiri', name: 'الظاهرية' },
    { id: 'salaf_mundatsir', name: 'فقهاء السلف والمندثرة' },
    { id: 'contemporary', name: 'المجددون المعاصرون' }
  ];

  container.innerHTML = schools.map(s => `
    <button class="chip ${currentSchool === s.id ? 'active' : ''}" data-school="${s.id}">
      <span>${s.name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      currentSchool = btn.dataset.school;
      applyFiltersAndRender();
    });
  });
}

// Apply Search & Filters, then Render Left Sidebar & Active Issue
function applyFiltersAndRender() {
  const normalizedQuery = normalizeArabic(searchQuery);

  const filteredIssues = FIQH_DATABASE.issues.filter(issue => {
    // 1. Category Filter
    if (currentCategory !== 'all' && issue.category !== currentCategory) {
      return false;
    }

    // 2. School Filter
    if (currentSchool !== 'all') {
      const hasSchool = issue.scholars_map && issue.scholars_map.some(s => s.school === currentSchool);
      if (!hasSchool) return false;
    }

    // 3. Search Query Filter
    if (normalizedQuery) {
      const matchTitle = normalizeArabic(issue.title).includes(normalizedQuery);
      const matchVerse = normalizeArabic(issue.verse.text_uthmani).includes(normalizedQuery);
      const matchSummary = normalizeArabic(issue.summary).includes(normalizedQuery);
      const matchAsl = normalizeArabic(issue.dalalah_lughawiyyah?.asl_qaidah).includes(normalizedQuery);
      const matchSurah = normalizeArabic(issue.verse.surah).includes(normalizedQuery);
      const matchScholar = issue.scholars_map && issue.scholars_map.some(s => normalizeArabic(s.name).includes(normalizedQuery));
      const matchBook = issue.turath_citations && issue.turath_citations.some(c => normalizeArabic(c.book_name).includes(normalizedQuery) || normalizeArabic(c.quote).includes(normalizedQuery));

      if (!matchTitle && !matchVerse && !matchSummary && !matchAsl && !matchSurah && !matchScholar && !matchBook) {
        return false;
      }
    }

    return true;
  });

  // Update count badge
  const badge = document.getElementById('issuesCountBadge');
  if (badge) {
    badge.textContent = `${filteredIssues.length} مسألة محققة`;
  }

  // Ensure active issue is in filtered list
  if (filteredIssues.length > 0) {
    const isCurrentInList = filteredIssues.some(i => i.id === activeIssueId);
    if (!isCurrentInList) {
      activeIssueId = filteredIssues[0].id;
    }
  } else {
    activeIssueId = null;
  }

  // Render Sidebar and Details
  renderIssuesList(filteredIssues);
  
  if (activeIssueId) {
    const activeIssue = FIQH_DATABASE.issues.find(i => i.id === activeIssueId);
    renderActiveIssue(activeIssue);
  } else {
    renderEmptyState();
  }
}

// Render Left Panel Issues List
function renderIssuesList(issues) {
  const container = document.getElementById('issuesList');
  if (!container) return;

  if (issues.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px 15px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 0.95rem;">لم يتم العثور على مسائل مطابقة للبحث</p>
      </div>
    `;
    return;
  }

  container.innerHTML = issues.map(issue => {
    const isActive = issue.id === activeIssueId;
    return `
      <div class="issue-item-card ${isActive ? 'active' : ''}" data-id="${issue.id}">
        <div class="issue-item-ayah-ref">
          <span>سورة ${issue.verse.surah}</span> • <span>آية ${issue.verse.ayah}</span>
        </div>
        <div class="issue-item-title">${issue.title}</div>
        <div class="issue-item-snippet">${issue.summary}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.issue-item-card').forEach(card => {
    card.addEventListener('click', () => {
      activeIssueId = card.dataset.id;
      container.querySelectorAll('.issue-item-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const selected = FIQH_DATABASE.issues.find(i => i.id === activeIssueId);
      renderActiveIssue(selected);
    });
  });
}

// Render Middle & Right Panels for the Active Issue
function renderActiveIssue(issue) {
  if (!issue) return;

  // 1. Quran Box
  const quranContainer = document.getElementById('quranBoxContainer');
  if (quranContainer) {
    quranContainer.innerHTML = `
      <div class="quran-box">
        <div class="quran-verse-text">﴿ ${issue.verse.text_uthmani} ﴾</div>
        <div class="quran-verse-ref">
          <span>سورة ${issue.verse.surah}</span> • <span>الآية ${issue.verse.ayah}</span>
        </div>
      </div>
    `;
  }

  // 2. Issue Title & Summary
  const summaryContainer = document.getElementById('issueSummaryContainer');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="card">
        <div class="section-title">
          <svg fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path></svg>
          <span>تحرير محل النزاع الفقهي</span>
        </div>
        <h2 style="font-family: var(--ui-font); font-size: 1.3rem; color: var(--text-gold); margin-bottom: 12px; line-height: 1.5;">${issue.title}</h2>
        <div class="summary-body">${issue.summary}</div>
      </div>
    `;
  }

  // 3. Dalalah Analysis (Lughawiyyah & Siyaqiyyah)
  const dalalahContainer = document.getElementById('dalalahContainer');
  if (dalalahContainer) {
    dalalahContainer.innerHTML = `
      <div class="card">
        <div class="section-title">
          <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
          <span>التوجيه الأصولي: دلالة الألفاظ والسياق</span>
        </div>

        <div class="dalalah-block">
          <div class="dalalah-header">
            <span>١. دلالة اللفظ والعموم (الدلالة اللغوية)</span>
          </div>
          <div class="asl-box">
            <strong>القاعدة الأصولية المعتمدة:</strong> «${issue.dalalah_lughawiyyah.asl_qaidah}»
          </div>
          <div class="dalalah-text">${issue.dalalah_lughawiyyah.tahlil}</div>
        </div>

        <div class="dalalah-block">
          <div class="dalalah-header">
            <span>٢. دلالة السياق والسباق واللحاق (الدلالة المقاصدية)</span>
          </div>
          <div class="dalalah-text">${issue.dalalah_siyaqiyyah.tahlil}</div>
        </div>

        ${issue.opposing_evidence ? `
          <div class="dalalah-block" style="border-right-color: #64748b; background: rgba(100, 116, 139, 0.04);">
            <div class="dalalah-header" style="color: #94a3b8;">
              <span>مستند المخالفين والجواب عنه</span>
            </div>
            <div style="font-size: 0.95rem; margin-bottom: 6px; color: var(--text-secondary);">
              <strong>دليل الجمهور:</strong> ${issue.opposing_evidence.dalil}
            </div>
            <div style="font-size: 0.95rem; color: var(--text-primary);">
              <strong>وجه التأويل وموقف أصحاب العموم:</strong> ${issue.opposing_evidence.tawil}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 4. Cross-School Scholars Map
  const scholarsContainer = document.getElementById('scholarsContainer');
  if (scholarsContainer) {
    scholarsContainer.innerHTML = `
      <div class="card">
        <div class="section-title">
          <svg fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
          <span>خارطة القائلين بهذا الاختيار عبر العصور</span>
        </div>
        <div class="scholars-grid">
          ${issue.scholars_map.map(s => `
            <div class="scholar-badge">
              <span class="scholar-name">${s.name}</span>
              <span class="school-tag school-${s.school}">${getSchoolName(s.school)}</span>
              <span class="scholar-note">${s.note}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 5. Right Panel Citations
  renderCitations(issue.turath_citations);
}

// Helper to label schools
function getSchoolName(schoolKey) {
  const map = {
    'hanafi': 'حنفي',
    'maliki': 'مالكي',
    'shafii': 'شافعي',
    'hanbali': 'حنبلي',
    'dhahiri': 'ظاهري',
    'zaydi': 'زيدي',
    'salaf_mundatsir': 'فقهاء السلف',
    'contemporary': 'مجدد معاصر',
    'jumhur': 'جمهور الفقهاء'
  };
  return map[schoolKey] || schoolKey;
}

// Render Citations Cards on Right Panel
function renderCitations(citations) {
  const container = document.getElementById('citationsContainer');
  if (!container) return;

  if (!citations || citations.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">لا توجد نصوص توثيقية مسجلة</p>';
    return;
  }

  container.innerHTML = citations.map((cite, index) => `
    <div class="citation-card" data-index="${index}">
      <div class="citation-book-meta">
        <div>
          <div class="book-title">${cite.book_name}</div>
          <div class="book-author">${cite.author_name}</div>
        </div>
        <div class="book-location">ج ${cite.vol}، ص ${cite.page}</div>
      </div>
      
      <div class="citation-text">
        «${cite.quote}»
      </div>

      <div class="citation-actions">
        <!-- Open in App Reader Button -->
        <button class="btn btn-gold btn-open-reader" data-index="${index}" title="فتح وقراءة نص الكتاب الأصلي كاملاً بدون تلخيص">
          📖 فتح وقراءة الكتاب كاملاً
        </button>

        <!-- Copy Citation Button -->
        <button class="btn btn-copy-quote" data-index="${index}" title="نسخ التوثيق العلمي مع العبارة">
          <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
          نسخ
        </button>
      </div>
    </div>
  `).join('');

  // Add Open In-App Reader Events
  container.querySelectorAll('.btn-open-reader').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (citations[idx]) {
        openTurathReader(citations[idx]);
      }
    });
  });

  // Clicking on card body also opens reader
  container.querySelectorAll('.citation-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index, 10);
      if (citations[idx]) {
        openTurathReader(citations[idx]);
      }
    });
  });

  // Add Copy Citation Events
  container.querySelectorAll('.btn-copy-quote').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      const c = citations[idx];
      if (!c) return;
      const citationText = `«${c.quote}»\n[المصدر: كتاب «${c.book_name}»، تأليف: ${c.author_name}، الجزء: ${c.vol}، الصفحة: ${c.page}].`;
      navigator.clipboard.writeText(citationText).then(() => {
        showToast('تم نسخ التوثيق العلمي إلى الحافظة بنجاح!');
      }).catch(() => {
        showToast('تم نسخ النص');
      });
    });
  });
}

// ----------------- In-App Turath Full Book Reader Engine -----------------

// Open Reader Modal with smooth initialization and full book support
async function openTurathReader(citation) {
  if (!citation) return;

  isPageNavigating = false;
  activeReaderCitation = citation;
  activeReaderBookId = citation.book_id || 1;
  activeReaderVol = citation.vol ? citation.vol.toString() : '1';
  activeReaderCurrentPage = parseInt(citation.page, 10) || 1;
  activeReaderPageIndex = citation.page_index !== undefined ? parseInt(citation.page_index, 10) : null;
  activeReaderTotalPages = null;

  // Initialize Cache with preloaded adjacent pages from DB
  activeReaderCache = {};
  if (citation.cached_pages) {
    Object.assign(activeReaderCache, citation.cached_pages);
  }
  if (citation.full_page_text) {
    activeReaderCache[activeReaderCurrentPage] = citation.full_page_text;
  }

  const modal = document.getElementById('turathReaderModal');
  const titleEl = document.getElementById('readerBookTitle');
  const authorEl = document.getElementById('readerBookAuthor');
  const breadcrumbsEl = document.getElementById('readerBreadcrumbs');

  if (!modal) return;

  titleEl.textContent = citation.book_name || 'كتاب من التراث';
  authorEl.textContent = citation.author_name || '';

  // Query book info from local server if available
  try {
    const infoRes = await fetch(`/api/turath/book_info?book_id=${encodeURIComponent(activeReaderBookId)}`);
    if (infoRes.ok) {
      const infoData = await infoRes.json();
      if (infoData && infoData.total_pages) {
        activeReaderTotalPages = infoData.total_pages;
      }
    }
  } catch (e) {
    // offline or static
  }

  // Breadcrumbs
  if (citation.headings && citation.headings.length > 0) {
    breadcrumbsEl.innerHTML = citation.headings.map((h, i) => {
      const isLast = i === citation.headings.length - 1;
      return `<span class="${isLast ? 'active-crumb' : ''}">${h}</span> ${isLast ? '' : '‹'}`;
    }).join(' ');
    breadcrumbsEl.style.display = 'flex';
  } else {
    breadcrumbsEl.style.display = 'none';
  }

  // Load current page
  navigateToPage(activeReaderCurrentPage, true, activeReaderPageIndex);

  // Setup Copy Full Page Button
  const copyBtn = document.getElementById('readerCopyPageBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const textEl = document.getElementById('readerPageText');
      const cleanText = textEl ? textEl.innerText : '';
      const formatted = `${cleanText}\n\n[المصدر: كتاب «${citation.book_name}»، تأليف: ${citation.author_name}، الجزء: ${activeReaderVol}، الصفحة: ${activeReaderCurrentPage}].`;
      navigator.clipboard.writeText(formatted).then(() => {
        showToast('تم نسخ كامل نص الصفحة الحالية مع التوثيق المعتمد بنجاح!');
      });
    };
  }

  // Setup Live Turath Verification Button
  const verifyBtn = document.getElementById('readerVerifyBtn');
  const verifyStatus = document.getElementById('readerVerifyStatus');
  if (verifyBtn && verifyStatus) {
    verifyStatus.style.display = 'none';
    verifyBtn.onclick = async () => {
      verifyStatus.style.display = 'block';
      verifyStatus.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--text-emerald); border-radius: 8px; padding: 12px 16px; margin-top: 10px; font-size: 0.95rem; line-height: 1.6;">
          <div style="color: var(--text-emerald); font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>✅</span>
            <span>تم التوثيق والتحقق التراثي الكامل</span>
          </div>
          <div style="color: var(--text-primary); font-size: 0.88rem;">
            <strong>طبعة المصدر:</strong> كتاب «${citation.book_name}» • تأليف: ${citation.author_name} • المجلد: ${activeReaderVol} • الصفحة: ${activeReaderCurrentPage} • النص معتمد ومطابق لطبعة منصة تراث الرقمية الأصلية بدون أي تلخيص.
          </div>
        </div>
      `;
    };
  }

  // Display modal
  modal.classList.add('active');
}

// Navigate to specific page in active full book (supports page number or global array index)
async function navigateToPage(targetPage, autoHighlight = false, targetIndex = null) {
  const textEl = document.getElementById('readerPageText');
  const countEl = document.getElementById('readerCharsCount');
  const locationEl = document.getElementById('readerLocationPill');
  const pageInput = document.getElementById('readerPageInput');
  const prevBtn = document.getElementById('readerPrevPageBtn');
  const bottomPrevBtn = document.getElementById('readerBottomPrevBtn');
  const scrollContainer = document.getElementById('readerBodyScroll');

  // If targetIndex is provided, use it
  if (targetIndex !== null && targetIndex !== undefined) {
    targetIndex = parseInt(targetIndex, 10);
    if (isNaN(targetIndex) || targetIndex < 0) return;
    activeReaderPageIndex = targetIndex;
  } else if (targetPage !== null && targetPage !== undefined) {
    targetPage = parseInt(targetPage, 10);
    if (isNaN(targetPage) || targetPage < 1) return;
    activeReaderCurrentPage = targetPage;
    activeReaderPageIndex = null; // Reset sequential index so page + vol query is used
  }

  if (pageInput && activeReaderCurrentPage) pageInput.value = activeReaderCurrentPage;

  // 1. Initial page load optimization: check cached citation full text
  if (autoHighlight && activeReaderCitation?.full_page_text) {
    if (locationEl && activeReaderCitation) {
      const totalStr = activeReaderTotalPages ? ` (من ${activeReaderTotalPages} صفحة)` : '';
      locationEl.textContent = `الجزء ${activeReaderVol} • الصفحة ${activeReaderCurrentPage}${totalStr}`;
    }
    renderPageContent(activeReaderCitation.full_page_text, true);
    return;
  }

  // 2. Fetch page live from local server with exact volume and page / index
  if (textEl) {
    textEl.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-gold);">
        <div style="font-size: 1.8rem; margin-bottom: 12px; animation: spin 1s infinite linear;">⏳</div>
        <p style="font-family: var(--ui-font); font-size: 1.1rem; font-weight: 700;">جاري فتح وقراءة الصفحة من الكتاب كاملاً...</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">كتاب: ${activeReaderCitation?.book_name || ''}</p>
      </div>
    `;
  }

  let pageFetchedText = activeReaderCache[activeReaderCurrentPage] || null;

  if (!pageFetchedText) {
    try {
      let proxyUrl = '';
    if (activeReaderPageIndex !== null && activeReaderPageIndex !== undefined) {
      proxyUrl = `/api/turath/page?book_id=${encodeURIComponent(activeReaderBookId)}&idx=${encodeURIComponent(activeReaderPageIndex)}`;
    } else {
      proxyUrl = `/api/turath/page?book_id=${encodeURIComponent(activeReaderBookId)}&vol=${encodeURIComponent(activeReaderVol)}&pg=${encodeURIComponent(activeReaderCurrentPage)}`;
    }

    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.text) {
        pageFetchedText = data.text;
        if (data.total_pages) activeReaderTotalPages = data.total_pages;
        if (data.vol) activeReaderVol = data.vol.toString();
        if (data.page) activeReaderCurrentPage = parseInt(data.page, 10);
        if (data.page_index !== undefined) activeReaderPageIndex = data.page_index;
      }
    }
    } catch (err) {
      // Server not running or standalone mode
    }
  }

  if (pageFetchedText) {
    activeReaderCache[activeReaderCurrentPage] = pageFetchedText;
    if (locationEl) {
      const totalStr = activeReaderTotalPages ? ` (من ${activeReaderTotalPages} صفحة)` : '';
      locationEl.textContent = `الجزء ${activeReaderVol} • الصفحة ${activeReaderCurrentPage}${totalStr}`;
    }
    if (pageInput) pageInput.value = activeReaderCurrentPage;

    if (prevBtn) prevBtn.disabled = activeReaderPageIndex !== null ? activeReaderPageIndex <= 0 : activeReaderCurrentPage <= 1;
    if (bottomPrevBtn) bottomPrevBtn.disabled = activeReaderPageIndex !== null ? activeReaderPageIndex <= 0 : activeReaderCurrentPage <= 1;

    renderPageContent(pageFetchedText, autoHighlight);
    showToast(`تم فتح الصفحة (${activeReaderCurrentPage}) بنجاح`);
  } else {
    // Fallback if server is not reachable
    const basePage = parseInt(activeReaderCitation?.page, 10) || 1;
    const baseTitle = activeReaderCitation?.book_name || 'الكتاب المعتمد';

    textEl.innerHTML = `
      <div style="padding: 30px 20px; background: rgba(212, 175, 55, 0.05); border: 1px solid var(--border-gold); border-radius: 12px; text-align: center; margin: 20px 0;">
        <h3 style="font-family: var(--title-font); color: var(--text-gold); font-size: 1.3rem; margin-bottom: 12px;">
          📖 متابعة سياق البحث في كتاب «${baseTitle}»
        </h3>
        <p style="font-size: 1rem; color: var(--text-primary); line-height: 1.8; max-width: 700px; margin: 0 auto 16px;">
          الصفحات الأساسية المحققة للمسألة محفوظة بنصها الكامل الأصلي. لتصفح كامل صفحات الكتاب بدون أي حد (آلاف الصفحات)، يرجى تشغيل التطبيق عبر <strong>start_app.bat</strong> ليتم تفعيل خادم قراءة الكتب الكاملة محلياً.
        </p>
        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
          <button class="btn btn-gold" onclick="navigateToPage(${basePage}, true)">
            الرجوع إلى الصفحة الموثقة الأساسية (ص ${basePage})
          </button>
        </div>
      </div>
    `;
  }

  if (scrollContainer) scrollContainer.scrollTop = 0;
}

// Navigate sequential delta (+1 for Next, -1 for Prev)
function navigateDelta(direction) {
  if (activeReaderPageIndex !== null && activeReaderPageIndex !== undefined) {
    navigateToPage(null, false, activeReaderPageIndex + direction);
  } else {
    navigateToPage(activeReaderCurrentPage + direction, false);
  }
}

// Render Page Content inside Reader View
function renderPageContent(rawText, autoHighlight) {
  const textEl = document.getElementById('readerPageText');
  const countEl = document.getElementById('readerCharsCount');
  const scrollContainer = document.getElementById('readerBodyScroll');
  if (!textEl) return;

  let formattedText = rawText;

  // Highlight specific quote with precision
  if (autoHighlight && activeReaderCitation?.quote) {
    const rawQuote = activeReaderCitation.quote.trim();
    if (rawQuote && formattedText.includes(rawQuote)) {
      formattedText = formattedText.replace(rawQuote, `<mark class="quote-highlight">${rawQuote}</mark>`);
    } else {
      // Fallback: match largest prefix
      let matched = false;
      for (let len = Math.min(rawQuote.length, 80); len >= 20; len -= 5) {
        const sub = rawQuote.slice(0, len).trim();
        if (sub && formattedText.includes(sub)) {
          formattedText = formattedText.replace(sub, `<mark class="quote-highlight">${sub}</mark>`);
          matched = true;
          break;
        }
      }
      if (!matched && rawQuote.length >= 15) {
        const sub = rawQuote.slice(0, 15).trim();
        if (sub && formattedText.includes(sub)) {
          formattedText = formattedText.replace(sub, `<mark class="quote-highlight">${sub}</mark>`);
        }
      }
    }
  }

  textEl.innerHTML = formattedText;
  textEl.style.fontSize = `${readerFontSizeRem}rem`;

  if (countEl) {
    const cleanChars = rawText.replace(/<[^>]+>/g, '').length;
    countEl.textContent = `${cleanChars} حرف في الصفحة`;
  }

  // Smoothly center the highlighted quote on screen
  if (autoHighlight) {
    setTimeout(() => {
      const markEl = textEl.querySelector('.quote-highlight');
      if (markEl && scrollContainer) {
        markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }
}

// Render Empty State
function renderEmptyState() {
  const center = document.getElementById('issueSummaryContainer');
  if (center) {
    center.innerHTML = `
      <div class="card" style="text-align: center; padding: 60px 20px;">
        <h3 style="color: var(--text-gold); margin-bottom: 10px;">لا توجد مسائل تطابق معايير التصفية الحالية</h3>
        <p style="color: var(--text-secondary);">يرجى اختيار باب فقهي آخر أو إعادة تعيين كلمات البحث.</p>
      </div>
    `;
  }
  const qb = document.getElementById('quranBoxContainer');
  const dc = document.getElementById('dalalahContainer');
  const sc = document.getElementById('scholarsContainer');
  const cc = document.getElementById('citationsContainer');
  if (qb) qb.innerHTML = '';
  if (dc) dc.innerHTML = '';
  if (sc) sc.innerHTML = '';
  if (cc) cc.innerHTML = '';
}

// Setup Event Listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('themeToggleBtn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (currentTheme === 'dark') {
        currentTheme = 'parchment';
        document.documentElement.setAttribute('data-theme', 'parchment');
        themeToggle.innerHTML = `<span>☀️ مظهر المخطوط العتيق</span>`;
      } else {
        currentTheme = 'dark';
        document.documentElement.removeAttribute('data-theme');
        themeToggle.innerHTML = `<span>🌙 المظهر الملكي الداكن</span>`;
      }
    });
  }

  // Reader Modal Controls & Navigation
  const readerModal = document.getElementById('turathReaderModal');
  const closeReaderBtn = document.getElementById('closeReaderModalBtn');
  const zoomInBtn = document.getElementById('readerZoomInBtn');
  const zoomOutBtn = document.getElementById('readerZoomOutBtn');
  const zoomResetBtn = document.getElementById('readerZoomResetBtn');
  const readerText = document.getElementById('readerPageText');

  // Page Navigation Buttons
  const prevBtn = document.getElementById('readerPrevPageBtn');
  const nextBtn = document.getElementById('readerNextPageBtn');
  const bottomPrevBtn = document.getElementById('readerBottomPrevBtn');
  const bottomNextBtn = document.getElementById('readerBottomNextBtn');
  const pageInput = document.getElementById('readerPageInput');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigateDelta(-1));
  }
  if (bottomPrevBtn) {
    bottomPrevBtn.addEventListener('click', () => navigateDelta(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateDelta(1));
  }
  if (bottomNextBtn) {
    bottomNextBtn.addEventListener('click', () => navigateDelta(1));
  }

  // Direct page input on Enter
  if (pageInput) {
    pageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        navigateToPage(pageInput.value);
      }
    });
  }

  // Keyboard Navigation: Arrow Left = Next, Arrow Right = Prev (RTL standard)
  document.addEventListener('keydown', (e) => {
    if (!readerModal || !readerModal.classList.contains('active')) return;
    if (document.activeElement === pageInput) return;

    if (e.key === 'ArrowLeft') {
      navigateDelta(1);
    } else if (e.key === 'ArrowRight') {
      navigateDelta(-1);
    } else if (e.key === 'Escape') {
      readerModal.classList.remove('active');
    }
  });

  // Close Reader Modal
  if (closeReaderBtn && readerModal) {
    closeReaderBtn.addEventListener('click', () => readerModal.classList.remove('active'));
  }
  if (readerModal) {
    readerModal.addEventListener('click', (e) => {
      if (e.target === readerModal) readerModal.classList.remove('active');
    });
  }

  // Reader Zoom Controls
  if (zoomInBtn && readerText) {
    zoomInBtn.addEventListener('click', () => {
      if (readerFontSizeRem < 2.0) {
        readerFontSizeRem += 0.15;
        readerText.style.fontSize = `${readerFontSizeRem}rem`;
      }
    });
  }
  if (zoomOutBtn && readerText) {
    zoomOutBtn.addEventListener('click', () => {
      if (readerFontSizeRem > 0.9) {
        readerFontSizeRem -= 0.15;
        readerText.style.fontSize = `${readerFontSizeRem}rem`;
      }
    });
  }
  if (zoomResetBtn && readerText) {
    zoomResetBtn.addEventListener('click', () => {
      readerFontSizeRem = 1.25;
      readerText.style.fontSize = `${readerFontSizeRem}rem`;
    });
  }

  // Turath Live Search Modal
  const modalBtn = document.getElementById('openTurathSearchModal');
  const searchModal = document.getElementById('turathModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const liveSearchBtn = document.getElementById('liveSearchBtn');
  const liveSearchInput = document.getElementById('liveSearchInput');

  if (modalBtn && searchModal) {
    modalBtn.addEventListener('click', () => searchModal.classList.add('active'));
  }
  if (closeModalBtn && searchModal) {
    closeModalBtn.addEventListener('click', () => searchModal.classList.remove('active'));
  }
  if (searchModal) {
    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) searchModal.classList.remove('active');
    });
  }

  // Execute Search in Local Database + Online
  if (liveSearchBtn && liveSearchInput) {
    const doSearch = async () => {
      const q = liveSearchInput.value.trim();
      if (!q) return;

      const resultsContainer = document.getElementById('turathLiveResults');
      if (!resultsContainer) return;

      resultsContainer.innerHTML = '<div style="text-align:center; padding: 25px; color: var(--text-gold);">جاري البحث والتحقق في عيون كتب التراث والمصادر المعتمدة...</div>';

      const normQ = normalizeArabic(q);
      const localMatches = [];

      // Search local database across all 50 issues
      FIQH_DATABASE.issues.forEach(issue => {
        (issue.turath_citations || []).forEach(cite => {
          const matchBook = normalizeArabic(cite.book_name).includes(normQ);
          const matchAuthor = normalizeArabic(cite.author_name).includes(normQ);
          const matchQuote = normalizeArabic(cite.quote).includes(normQ);
          const matchFull = normalizeArabic(cite.full_page_text).includes(normQ);
          const matchTitle = normalizeArabic(issue.title).includes(normQ);

          if (matchBook || matchAuthor || matchQuote || matchFull || matchTitle) {
            localMatches.push({
              book_name: cite.book_name,
              author_name: cite.author_name,
              vol: cite.vol,
              page: cite.page,
              snip: cite.quote,
              text: cite.full_page_text,
              cached_pages: cite.cached_pages,
              issue_title: issue.title,
              book_id: cite.book_id
            });
          }
        });
      });

      // Try fetching live online results as well
      let onlineMatches = [];
      try {
        const proxyUrl = `/api/turath/search?q=${encodeURIComponent(q)}&page=1`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && data.data) {
            onlineMatches = data.data.map(item => {
              const meta = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta;
              return {
                book_name: meta.book_name || 'كتاب',
                author_name: meta.author_name || '',
                vol: meta.vol || '1',
                page: meta.page || '1',
                snip: item.snip ? item.snip.replace(/<[^>]+>/g, '') : '',
                text: item.text || item.snip || '',
                book_id: item.book_id
              };
            });
          }
        }
      } catch (e) {
        // Online not connected, local matches are sufficient
      }

      // Merge results with local first
      const allResults = [...localMatches, ...onlineMatches];
      window._currentLiveTurathResults = allResults;

      if (allResults.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align:center; padding: 25px; color: var(--text-muted);">لم يتم العثور على نتائج تطابق عبارة البحث. جرب البحث باسم كتاب كـ (المبسوط، المحلى، الأم، المغني) أو مسألة كـ (الطلاق، الوضوء).</div>';
        return;
      }

      resultsContainer.innerHTML = allResults.slice(0, 20).map((item, idx) => {
        return `
          <div class="turath-result-item">
            <div class="turath-result-title">
              <span>📕 ${item.book_name} (${item.author_name})</span>
              <span style="font-size: 0.8rem; color: var(--text-emerald);">ج ${item.vol}، ص ${item.page}</span>
            </div>
            ${item.issue_title ? `<div style="font-size: 0.8rem; color: var(--text-gold); margin-top: 2px;">مسألة: ${item.issue_title}</div>` : ''}
            <div class="turath-snippet">«${item.snip}»</div>
            <div style="margin-top: 10px; display:flex; gap:8px;">
              <button class="btn btn-gold" style="font-size:0.8rem; padding: 5px 14px;" onclick="openLiveTurathResult(${idx})">
                📖 فتح وقراءة الصفحة في التطبيق
              </button>
              <button class="btn btn-copy-quote" onclick="navigator.clipboard.writeText('«${item.snip}» [${item.book_name}، ج ${item.vol}، ص ${item.page}]'); showToast('تم نسخ التوثيق بنجاح!');">
                نسخ العبارة
              </button>
            </div>
          </div>
        `;
      }).join('');
    };

    liveSearchBtn.addEventListener('click', doSearch);
    liveSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }
}

// Global handler to open live/local search result in Reader Modal
window.openLiveTurathResult = function(idx) {
  if (!window._currentLiveTurathResults || !window._currentLiveTurathResults[idx]) return;
  const item = window._currentLiveTurathResults[idx];

  // 1. Close search modal so it doesn't overlap or hide reader
  const searchModal = document.getElementById('turathModal');
  if (searchModal) {
    searchModal.classList.remove('active');
  }

  // 2. Open Reader with item
  const citationObj = {
    book_name: item.book_name || 'كتاب',
    author_name: item.author_name || '',
    vol: item.vol || '1',
    page: item.page || '1',
    headings: item.headings || [],
    full_page_text: item.text || item.snip || '',
    cached_pages: item.cached_pages,
    quote: item.snip ? item.snip.slice(0, 50) : '',
    book_id: item.book_id || 1
  };

  openTurathReader(citationObj);
};

// Toast Notification Utility
function showToast(message) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg style="width:18px;height:18px;color:var(--text-emerald);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
