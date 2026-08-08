const STORAGE_KEY = "myReadingCorner.v1";

const MONTHS = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];

const STATUS_LABELS = {
  reading:"Okuyorum",
  finished:"Okudum",
  tbr:"Okuyacağım",
  paused:"Ara verdim",
  dnf:"Yarım bıraktım"
};

let state = loadState();
let currentRoute = location.hash || "#home";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importInput").addEventListener("change", importData);

  window.addEventListener("hashchange", render);
  render();
});

function defaultState(){
  return {
    books: [],
    tracker: {},
    monthReviews: {},
    bestBook: { winnerId:null, nominees:[] }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return {...defaultState(), ...JSON.parse(raw)};
  }catch{
    return defaultState();
  }
}

function saveState(message){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if(message) toast(message);
}

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function esc(value=""){
  return String(value)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function render(){
  currentRoute = location.hash || "#home";
  const app = document.getElementById("app");
  const route = currentRoute.slice(1);

  document.querySelectorAll(".nav a").forEach(a => {
    const base = route.startsWith("book/") ? "library" : route;
    a.classList.toggle("active", a.dataset.route === base);
  });

  document.getElementById("sidebar").classList.remove("open");

  if(route.startsWith("book/")){
    const id = route.split("/")[1];
    setTitle("Book Review");
    renderBookDetail(app,id);
    return;
  }

  switch(route){
    case "home": setTitle("My Reading Corner"); renderHome(app); break;
    case "library": setTitle("My Library"); renderLibrary(app); break;
    case "bookshelf": setTitle("Bookshelf"); renderBookshelf(app); break;
    case "tracker": setTitle("Monthly Tracker"); renderTracker(app); break;
    case "month-review": setTitle("Month Review"); renderMonthReview(app); break;
    case "best-book": setTitle("Best Book"); renderBestBook(app); break;
    case "add-book": setTitle("Add Book"); renderAddBook(app); break;
    default: location.hash = "#home";
  }
}

function setTitle(t){ document.getElementById("pageTitle").textContent = t; }

function stats(){
  const finished = state.books.filter(b=>b.status==="finished");
  const pages = finished.reduce((a,b)=>a+(Number(b.pages)||0),0);
  const rated = finished.filter(b=>Number(b.rating)>0);
  const avg = rated.length ? (rated.reduce((a,b)=>a+Number(b.rating),0)/rated.length).toFixed(1) : "0.0";
  const reading = state.books.filter(b=>b.status==="reading").length;
  return {finished:finished.length,pages,avg,reading};
}

function renderHome(app){
  const s = stats();
  const reading = state.books.filter(b=>b.status==="reading").slice(0,4);
  const recent = [...state.books].filter(b=>b.status==="finished").sort((a,b)=>(b.finishedDate||"").localeCompare(a.finishedDate||"")).slice(0,5);
  const goal = 30;
  const pct = Math.min(100, Math.round((s.finished/goal)*100));

  app.innerHTML = `
    <section class="hero">
      <p class="mini-label">your cozy little book world</p>
      <h2>Welcome to your<br/>reading corner ♡</h2>
      <p>Kitaplarını, günlük okuma alışkanlığını, aylık değerlendirmelerini ve yılın favorilerini tek bir yerde tut.</p>
      <div class="hero-actions">
        <a class="primary-btn" href="#add-book">＋ Yeni kitap ekle</a>
        <a class="soft-btn" href="#tracker">Bugünkü tracker</a>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat-card"><b>${s.finished}</b><span>Bu yıl okunan</span></div>
      <div class="stat-card"><b>${s.pages.toLocaleString("tr-TR")}</b><span>Toplam sayfa</span></div>
      <div class="stat-card"><b>${s.avg} ★</b><span>Ortalama puan</span></div>
      <div class="stat-card"><b>${s.reading}</b><span>Şu an okunuyor</span></div>
    </div>

    <section class="section-card">
      <div class="section-head">
        <div><p class="mini-label">2026 reading goal</p><h2>${s.finished} / ${goal} kitap</h2></div>
        <span class="tag">${pct}%</span>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
    </section>

    <section class="section-card">
      <div class="section-head"><h2>Currently Reading</h2><a class="soft-btn" href="#library">Tüm kitaplar</a></div>
      ${reading.length ? bookGridHTML(reading) : emptyHTML("📖","Henüz okuduğun bir kitap yok.","İlk kitabını ekleyip durumunu “Okuyorum” seçebilirsin.","#add-book")}
    </section>

    <section class="section-card">
      <div class="section-head"><h2>Recently Finished</h2><span class="mini-label">little victories</span></div>
      ${recent.length ? bookGridHTML(recent) : emptyHTML("✿","Henüz biten kitap yok.","Bitirdiğin kitaplar burada görünecek.","#add-book")}
    </section>
  `;
  bindBookCards(app);
}

function bookGridHTML(books){
  return `<div class="book-grid">${books.map(bookCardHTML).join("")}</div>`;
}

function bookCardHTML(b){
  const stars = Number(b.rating)>0 ? `${"★".repeat(Math.round(Number(b.rating)))} ${Number(b.rating).toFixed(1)}` : "Henüz puan yok";
  return `
    <article class="book-card" data-id="${b.id}">
      <button class="book-cover-wrap" data-action="open-book" aria-label="${esc(b.title)} detayını aç">
        ${b.cover ? `<img class="book-cover" src="${esc(b.cover)}" alt="${esc(b.title)} kapağı">` : ""}
        <span class="cover-placeholder">BOOK</span>
      </button>
      <div class="book-card-body">
        <div class="book-card-top">
          <span class="status-pill">${STATUS_LABELS[b.status]||"Kitap"}</span>
          <button class="heart-btn ${b.favorite?"active":""}" data-action="favorite" aria-label="Favori">${b.favorite?"♥":"♡"}</button>
        </div>
        <h3 class="book-title">${esc(b.title)}</h3>
        <p class="book-author">${esc(b.author||"")}</p>
        <div class="rating-line">${stars}</div>
      </div>
    </article>`;
}

function bindBookCards(scope=document){
  scope.querySelectorAll("[data-action='open-book']").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const card = btn.closest("[data-id]");
      location.hash = `#book/${card.dataset.id}`;
    });
  });
  scope.querySelectorAll("[data-action='favorite']").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.closest("[data-id]").dataset.id;
      const b = state.books.find(x=>x.id===id);
      if(b){ b.favorite = !b.favorite; saveState("Favoriler güncellendi"); render(); }
    });
  });
}

function renderLibrary(app){
  app.innerHTML = `
    <section class="section-card">
      <div class="toolbar">
        <input id="searchBooks" placeholder="Kitap veya yazar ara…" />
        <select id="statusFilter">
          <option value="all">Tüm durumlar</option>
          <option value="reading">Okuyorum</option>
          <option value="finished">Okudum</option>
          <option value="tbr">Okuyacağım</option>
          <option value="paused">Ara verdim</option>
          <option value="dnf">Yarım bıraktım</option>
          <option value="favorite">Favoriler</option>
        </select>
        <select id="sortBooks">
          <option value="newest">En yeni eklenen</option>
          <option value="title">Kitap adına göre</option>
          <option value="rating">Puana göre</option>
        </select>
        <a class="primary-btn" href="#add-book">＋ Add Book</a>
      </div>
      <div id="libraryResults"></div>
    </section>`;
  const search = app.querySelector("#searchBooks");
  const status = app.querySelector("#statusFilter");
  const sort = app.querySelector("#sortBooks");

  function refresh(){
    const q = search.value.trim().toLowerCase();
    let books = state.books.filter(b=>{
      const matchQ = !q || `${b.title} ${b.author}`.toLowerCase().includes(q);
      const matchS = status.value==="all" || (status.value==="favorite" ? b.favorite : b.status===status.value);
      return matchQ && matchS;
    });
    if(sort.value==="title") books.sort((a,b)=>a.title.localeCompare(b.title,"tr"));
    if(sort.value==="rating") books.sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0));
    if(sort.value==="newest") books.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const out = app.querySelector("#libraryResults");
    out.innerHTML = books.length ? bookGridHTML(books) : emptyHTML("📚","Burada kitap yok.","Filtreyi değiştir veya yeni bir kitap ekle.","#add-book");
    bindBookCards(out);
  }
  [search,status,sort].forEach(el=>el.addEventListener("input",refresh));
  refresh();
}

function renderAddBook(app){
  app.innerHTML = `
    <section class="section-card">
      <div class="section-head"><div><p class="mini-label">new memory</p><h2>Yeni kitap ekle</h2></div></div>
      <form id="bookForm">
        <div class="form-grid">
          ${formGroup("Kitap adı","title","text",true)}
          ${formGroup("Yazar","author","text",true)}
          ${formGroup("Kapak görseli URL","cover","url",false,'https://...')}
          ${formGroup("Tür","genre","text",false,"Roman, klasik, fantastik...")}
          ${formGroup("Sayfa sayısı","pages","number")}
          ${formGroup("Yayın yılı","publishYear","number")}
          <div class="form-group">
            <label>Durum</label>
            <select name="status">
              <option value="tbr">Okuyacağım</option>
              <option value="reading">Okuyorum</option>
              <option value="finished">Okudum</option>
              <option value="paused">Ara verdim</option>
              <option value="dnf">Yarım bıraktım</option>
            </select>
          </div>
          ${formGroup("Başlama tarihi","startDate","date")}
          ${formGroup("Bitirme tarihi","finishedDate","date")}
          ${formGroup("Genel puan (0-5)","rating","number",false,"4.5",'step="0.1" min="0" max="5"')}
          <div class="form-group full">
            <label>Kısa ilk not</label>
            <textarea name="review" placeholder="Bu kitap hakkında ilk düşüncen…"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="primary-btn" type="submit">Kitabı kaydet</button>
          <a class="soft-btn" href="#library">Vazgeç</a>
        </div>
      </form>
    </section>`;
  app.querySelector("#bookForm").addEventListener("submit", e=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const book = {
      id:uid(), createdAt:Date.now(),
      title:fd.get("title").trim(), author:fd.get("author").trim(),
      cover:fd.get("cover").trim(), genre:fd.get("genre").trim(),
      pages:Number(fd.get("pages"))||0, publishYear:fd.get("publishYear"),
      status:fd.get("status"), startDate:fd.get("startDate"), finishedDate:fd.get("finishedDate"),
      rating:Number(fd.get("rating"))||0, favorite:false, review:fd.get("review").trim(),
      ratings:{story:0,characters:0,writing:0,pacing:0,ending:0,emotion:0},
      favoriteCharacter:"",favoriteScene:"",disliked:"",reread:"",recommend:"",
      quotes:[], tags:[]
    };
    state.books.push(book); saveState("Kitap eklendi");
    location.hash = `#book/${book.id}`;
  });
}

function formGroup(label,name,type="text",required=false,placeholder="",extra=""){
  return `<div class="form-group"><label>${label}</label><input name="${name}" type="${type}" ${required?"required":""} placeholder="${placeholder}" ${extra}></div>`;
}

function renderBookDetail(app,id){
  const b = state.books.find(x=>x.id===id);
  if(!b){
    app.innerHTML = emptyHTML("📕","Kitap bulunamadı.","Kitaplık sayfasına dönebilirsin.","#library");
    return;
  }
  const R = b.ratings || {};
  app.innerHTML = `
    <div class="detail-layout">
      <aside class="detail-cover">
        ${b.cover ? `<img src="${esc(b.cover)}" alt="${esc(b.title)} kapağı">` : `<div class="no-cover">BOOK</div>`}
        <div class="badge-row">
          <span class="tag">${STATUS_LABELS[b.status]||""}</span>
          ${b.genre?`<span class="tag">${esc(b.genre)}</span>`:""}
          ${b.favorite?`<span class="tag">♥ favorite</span>`:""}
        </div>
        <button class="soft-btn" id="toggleFav">${b.favorite?"♥ Favorilerden çıkar":"♡ Favorilere ekle"}</button>
      </aside>

      <div class="detail-content">
        <p class="mini-label">book review page</p>
        <h2>${esc(b.title)}</h2>
        <p class="detail-meta">${esc(b.author||"")} ${b.pages?`• ${b.pages} sayfa`:""} ${b.publishYear?`• ${esc(b.publishYear)}`:""}</p>

        <section class="section-card">
          <div class="section-head"><h3>My Rating</h3><span class="tag">${Number(b.rating||0).toFixed(1)} / 5</span></div>
          <div class="score-grid">
            ${scoreCard("Konu",R.story)}
            ${scoreCard("Karakterler",R.characters)}
            ${scoreCard("Yazım dili",R.writing)}
            ${scoreCard("Akıcılık",R.pacing)}
            ${scoreCard("Final",R.ending)}
            ${scoreCard("Hissettirdikleri",R.emotion)}
          </div>
        </section>

        <section class="section-card">
          <div class="section-head"><h3>Değerlendirme</h3><button class="soft-btn" id="editBookBtn">Düzenle</button></div>
          <p class="muted">${b.review?esc(b.review):"Henüz yorum eklenmedi."}</p>
          <div class="review-grid">
            <div class="review-prompt"><label>En sevdiğim karakter</label><div>${esc(b.favoriteCharacter||"—")}</div></div>
            <div class="review-prompt"><label>En sevdiğim sahne / bölüm</label><div>${esc(b.favoriteScene||"—")}</div></div>
            <div class="review-prompt"><label>Sevmediğim kısım</label><div>${esc(b.disliked||"—")}</div></div>
            <div class="review-prompt"><label>Tekrar okur muyum?</label><div>${esc(b.reread||"—")}</div></div>
          </div>
        </section>

        <section class="section-card">
          <div class="section-head"><h3>Favorite Quotes</h3><button class="soft-btn" id="addQuoteBtn">＋ Alıntı ekle</button></div>
          <div id="quotesBox">
            ${(b.quotes||[]).length ? b.quotes.map(q=>`<blockquote class="quote-card">“${esc(q.text)}” ${q.page?`<span class="small muted">— s. ${esc(q.page)}</span>`:""}</blockquote>`).join("") : `<p class="muted">Henüz alıntı eklenmedi.</p>`}
          </div>
        </section>

        <div class="form-actions">
          <a class="soft-btn" href="#library">← Kitaplığa dön</a>
          <button class="danger-btn" id="deleteBookBtn">Kitabı sil</button>
        </div>
      </div>
    </div>
  `;

  app.querySelector("#toggleFav").onclick=()=>{b.favorite=!b.favorite;saveState("Favoriler güncellendi");render()};
  app.querySelector("#deleteBookBtn").onclick=()=>{
    if(confirm(`“${b.title}” silinsin mi?`)){
      state.books=state.books.filter(x=>x.id!==b.id);
      state.bestBook.nominees=state.bestBook.nominees.filter(x=>x!==b.id);
      if(state.bestBook.winnerId===b.id) state.bestBook.winnerId=null;
      saveState("Kitap silindi"); location.hash="#library";
    }
  };
  app.querySelector("#addQuoteBtn").onclick=()=>{
    const text=prompt("Alıntıyı yaz:");
    if(!text) return;
    const page=prompt("Sayfa numarası (isteğe bağlı):")||"";
    b.quotes=b.quotes||[]; b.quotes.push({text,page}); saveState("Alıntı eklendi");render();
  };
  app.querySelector("#editBookBtn").onclick=()=>renderBookEdit(app,b);
}

function scoreCard(label,value){
  const v=Number(value)||0;
  return `<div class="score-card"><span>${label}</span><b>${v.toFixed(1)} / 5</b></div>`;
}

function renderBookEdit(app,b){
  const R=b.ratings||{};
  app.innerHTML=`
  <section class="section-card">
    <div class="section-head"><div><p class="mini-label">edit review</p><h2>${esc(b.title)}</h2></div></div>
    <form id="editBookForm">
      <div class="form-grid">
        ${editInput("Kitap adı","title",b.title,true)}
        ${editInput("Yazar","author",b.author,true)}
        ${editInput("Kapak URL","cover",b.cover)}
        ${editInput("Tür","genre",b.genre)}
        ${editInput("Sayfa sayısı","pages",b.pages,"", "number")}
        ${editInput("Genel puan","rating",b.rating,"","number",'step="0.1" min="0" max="5"')}
        <div class="form-group"><label>Durum</label><select name="status">${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${b.status===k?"selected":""}>${v}</option>`).join("")}</select></div>
        ${editInput("Başlama tarihi","startDate",b.startDate,"","date")}
        ${editInput("Bitirme tarihi","finishedDate",b.finishedDate,"","date")}
        ${ratingInput("Konu","story",R.story)}
        ${ratingInput("Karakterler","characters",R.characters)}
        ${ratingInput("Yazım dili","writing",R.writing)}
        ${ratingInput("Akıcılık","pacing",R.pacing)}
        ${ratingInput("Final","ending",R.ending)}
        ${ratingInput("Hissettirdikleri","emotion",R.emotion)}
        <div class="form-group full"><label>Genel yorumum</label><textarea name="review">${esc(b.review||"")}</textarea></div>
        <div class="form-group"><label>En sevdiğim karakter</label><input name="favoriteCharacter" value="${esc(b.favoriteCharacter||"")}"></div>
        <div class="form-group"><label>En sevdiğim sahne / bölüm</label><input name="favoriteScene" value="${esc(b.favoriteScene||"")}"></div>
        <div class="form-group"><label>Sevmediğim kısım</label><input name="disliked" value="${esc(b.disliked||"")}"></div>
        <div class="form-group"><label>Tekrar okur muyum?</label><input name="reread" value="${esc(b.reread||"")}" placeholder="Evet / Hayır / Belki"></div>
      </div>
      <div class="form-actions"><button class="primary-btn">Kaydet</button><button type="button" class="soft-btn" id="cancelEdit">Vazgeç</button></div>
    </form>
  </section>`;
  app.querySelector("#cancelEdit").onclick=()=>renderBookDetail(app,b.id);
  app.querySelector("#editBookForm").onsubmit=e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    ["title","author","cover","genre","status","startDate","finishedDate","review","favoriteCharacter","favoriteScene","disliked","reread"].forEach(k=>b[k]=fd.get(k));
    b.pages=Number(fd.get("pages"))||0; b.rating=Number(fd.get("rating"))||0;
    b.ratings={story:+fd.get("story")||0,characters:+fd.get("characters")||0,writing:+fd.get("writing")||0,pacing:+fd.get("pacing")||0,ending:+fd.get("ending")||0,emotion:+fd.get("emotion")||0};
    saveState("Kitap güncellendi"); render();
  };
}
function editInput(label,name,value="",required=false,type="text",extra=""){
  return `<div class="form-group"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value??"")}" ${required?"required":""} ${extra}></div>`;
}
function ratingInput(label,name,value){
  return `<div class="form-group"><label>${label} (0-5)</label><input name="${name}" type="number" value="${Number(value)||0}" step="0.1" min="0" max="5"></div>`;
}

function renderBookshelf(app){
  const books=state.books;
  const rows=[[],[],[]];
  books.forEach((b,i)=>rows[i%3].push(b));
  app.innerHTML=`
    <section class="section-card">
      <div class="section-head"><div><p class="mini-label">visual shelf</p><h2>My Bookshelf</h2></div><span class="tag">${books.length} kitap</span></div>
      ${books.length?`
        <div class="shelf">
          ${rows.map((row,idx)=>`<div class="shelf-row">${row.map(b=>`<button class="spine" data-id="${b.id}" title="${esc(b.title)}">${esc(b.title)}</button>`).join("")}${row.length===0?`<span class="muted small">Bu rafta henüz kitap yok.</span>`:""}</div>`).join("")}
        </div>`:emptyHTML("▤","Kitaplık henüz boş.","Kitap eklediğinde burada raflara dizilecek.","#add-book")}
    </section>`;
  app.querySelectorAll(".spine").forEach(el=>el.onclick=()=>location.hash=`#book/${el.dataset.id}`);
}

function renderTracker(app){
  const now=new Date();
  const selectedKey=state.uiTrackerMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [year,month]=selectedKey.split("-").map(Number);
  const days=new Date(year,month,0).getDate();
  const keyPrefix=`${year}-${String(month).padStart(2,"0")}`;
  const monthData=state.tracker[keyPrefix]||{};
  const totalPages=Object.values(monthData).reduce((a,d)=>a+(Number(d.pages)||0),0);
  const readingDays=Object.values(monthData).filter(d=>Number(d.pages)>0).length;

  app.innerHTML=`
    <section class="section-card">
      <div class="tracker-head">
        <div><p class="mini-label">daily reading journal</p><h2>${MONTHS[month-1]} ${year}</h2></div>
        <div class="month-select">
          <label>Ay</label>
          <input type="month" id="trackerMonth" value="${selectedKey}" class="field">
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><b>${readingDays}</b><span>Okunan gün</span></div>
        <div class="stat-card"><b>${totalPages}</b><span>Toplam sayfa</span></div>
        <div class="stat-card"><b>${days}</b><span>Ayın günü</span></div>
        <div class="stat-card"><b>${readingDays?Math.round(totalPages/readingDays):0}</b><span>Günlük ortalama</span></div>
      </div>
      <div class="tracker-grid">
        ${Array.from({length:days},(_,i)=>{
          const d=i+1; const data=monthData[d]||{};
          return `<div class="day-card" data-day="${d}">
            <div class="day-num">${d}</div>
            <input type="number" min="0" data-field="pages" placeholder="sayfa" value="${data.pages||""}">
            <textarea data-field="note" placeholder="mini not…">${esc(data.note||"")}</textarea>
            <span class="day-total">${data.pages?`${data.pages} sayfa okundu`:"henüz kayıt yok"}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="tracker-legend">
        <span><i class="legend-dot" style="background:#fffaf6"></i> sakin gün</span>
        <span><i class="legend-dot" style="background:#f7e3e8"></i> pembe gün</span>
        <span><i class="legend-dot" style="background:#edf0df"></i> yeşil gün</span>
      </div>
    </section>`;

  app.querySelector("#trackerMonth").addEventListener("change",e=>{state.uiTrackerMonth=e.target.value;saveState();render()});
  app.querySelectorAll(".day-card input,.day-card textarea").forEach(el=>{
    el.addEventListener("change",()=>{
      const card=el.closest(".day-card"),day=card.dataset.day;
      state.tracker[keyPrefix]=state.tracker[keyPrefix]||{};
      const rec=state.tracker[keyPrefix][day]||{pages:0,note:""};
      rec[el.dataset.field]=el.dataset.field==="pages"?(Number(el.value)||0):el.value;
      state.tracker[keyPrefix][day]=rec; saveState("Tracker kaydedildi"); render();
    });
  });
}

function renderMonthReview(app){
  const now=new Date();
  const selectedKey=state.uiReviewMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [year,month]=selectedKey.split("-").map(Number);
  const review=state.monthReviews[selectedKey]||{};
  const monthBooks=state.books.filter(b=>b.status==="finished" && b.finishedDate?.startsWith(selectedKey));
  const pages=monthBooks.reduce((a,b)=>a+(Number(b.pages)||0),0);

  app.innerHTML=`
    <section class="section-card">
      <div class="tracker-head">
        <div><p class="mini-label">end of month</p><h2>${MONTHS[month-1]} ${year} Review</h2></div>
        <input type="month" id="reviewMonth" value="${selectedKey}" class="field">
      </div>

      <div class="stat-grid">
        <div class="stat-card"><b>${monthBooks.length}</b><span>Bitirilen kitap</span></div>
        <div class="stat-card"><b>${pages}</b><span>Toplam sayfa</span></div>
        <div class="stat-card"><b>${bestRated(monthBooks)?.rating||"—"}</b><span>En yüksek puan</span></div>
        <div class="stat-card"><b>${bestRated(monthBooks)?esc(bestRated(monthBooks).title).slice(0,16):"—"}</b><span>Ayın yıldızı</span></div>
      </div>

      <form id="monthReviewForm" class="review-grid">
        ${reviewArea("Ayın en sevdiğim kitabı","bestBook",review.bestBook)}
        ${reviewArea("En sevdiğim karakter","bestCharacter",review.bestCharacter)}
        ${reviewArea("Ayın favori alıntısı","quote",review.quote)}
        ${reviewArea("En çok etkileyen kitap","impact",review.impact)}
        ${reviewArea("Hayal kırıklığı","disappointment",review.disappointment)}
        ${reviewArea("Bu ayın okuma ruh hali","mood",review.mood)}
        ${reviewArea("Gelecek ay okumak istediklerim","nextMonth",review.nextMonth)}
        ${reviewArea("Ayın genel notu","summary",review.summary)}
        <div class="form-actions" style="grid-column:1/-1"><button class="primary-btn">Ay sonu değerlendirmesini kaydet</button></div>
      </form>

      <section style="margin-top:24px">
        <div class="section-head"><h3>Bu ay bitenler</h3><span class="tag">${monthBooks.length} kitap</span></div>
        ${monthBooks.length?bookGridHTML(monthBooks):`<p class="muted">Bu aya ait bitiş tarihi olan kitap bulunamadı.</p>`}
      </section>
    </section>`;

  app.querySelector("#reviewMonth").addEventListener("change",e=>{state.uiReviewMonth=e.target.value;saveState();render()});
  app.querySelector("#monthReviewForm").addEventListener("submit",e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    state.monthReviews[selectedKey]=Object.fromEntries(fd.entries()); saveState("Ay sonu değerlendirmesi kaydedildi");
  });
  bindBookCards(app);
}
function reviewArea(label,name,value=""){
  return `<div class="review-prompt"><label>${label}</label><textarea name="${name}" placeholder="buraya yaz…">${esc(value||"")}</textarea></div>`;
}
function bestRated(books){
  return [...books].sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0))[0];
}

function renderBestBook(app){
  const finished=state.books.filter(b=>b.status==="finished");
  const nominees=state.bestBook.nominees.map(id=>state.books.find(b=>b.id===id)).filter(Boolean);
  const winner=state.books.find(b=>b.id===state.bestBook.winnerId);

  app.innerHTML=`
    <section class="section-card">
      <div class="section-head">
        <div><p class="mini-label">battle of books</p><h2>Best Book of the Year</h2></div>
        ${winner?`<span class="tag">winner: ${esc(winner.title)}</span>`:""}
      </div>
      <p class="muted">Bitirdiğin kitaplardan adaylarını seç. Yıl sonunda içlerinden birini yılın kitabı yap.</p>

      <div class="toolbar">
        <select id="nomineeSelect">
          <option value="">Aday kitap seç…</option>
          ${finished.filter(b=>!state.bestBook.nominees.includes(b.id)).map(b=>`<option value="${b.id}">${esc(b.title)} — ${esc(b.author||"")}</option>`).join("")}
        </select>
        <button class="primary-btn" id="addNominee">Aday ekle</button>
      </div>

      ${nominees.length?`
      <div class="battle-grid">
        ${nominees.map(b=>`
          <article class="nominee" data-id="${b.id}">
            ${state.bestBook.winnerId===b.id?`<span class="winner-ribbon">BEST BOOK</span>`:""}
            ${b.cover?`<img src="${esc(b.cover)}" alt="${esc(b.title)}">`:`<div class="nominee-placeholder">BOOK</div>`}
            <h4>${esc(b.title)}</h4>
            <p class="small muted">${esc(b.author||"")} • ${Number(b.rating||0).toFixed(1)} ★</p>
            <div class="form-actions" style="justify-content:center">
              <button class="soft-btn" data-action="winner">Kazanan yap</button>
              <button class="icon-btn" data-action="remove">×</button>
            </div>
          </article>`).join("")}
      </div>
      <div class="bracket">
        <h3>Final board</h3>
        <div class="bracket-flow">
          ${nominees.map((b,i)=>`${i?`<span class="arrow">→</span>`:""}<span class="bracket-chip">${esc(b.title)}</span>`).join("")}
          ${winner?`<span class="arrow">→</span><span class="bracket-chip">♡ ${esc(winner.title)} ♡</span>`:""}
        </div>
      </div>`:
      emptyHTML("♡","Henüz aday yok.","Bitirdiğin kitaplardan yılın favorilerini buraya ekle.","#library")}
    </section>`;

  const select=app.querySelector("#nomineeSelect");
  app.querySelector("#addNominee").onclick=()=>{
    if(!select.value) return toast("Önce bir kitap seç");
    state.bestBook.nominees.push(select.value); saveState("Aday eklendi"); render();
  };
  app.querySelectorAll("[data-action='winner']").forEach(btn=>btn.onclick=()=>{
    state.bestBook.winnerId=btn.closest("[data-id]").dataset.id; saveState("Yılın kitabı seçildi ♡");render();
  });
  app.querySelectorAll("[data-action='remove']").forEach(btn=>btn.onclick=()=>{
    const id=btn.closest("[data-id]").dataset.id;
    state.bestBook.nominees=state.bestBook.nominees.filter(x=>x!==id);
    if(state.bestBook.winnerId===id) state.bestBook.winnerId=null;
    saveState("Aday çıkarıldı");render();
  });
}

function emptyHTML(icon,title,text,href){
  return `<div class="empty"><div class="big">${icon}</div><h3>${title}</h3><p>${text}</p>${href?`<a class="primary-btn" href="${href}">Devam et</a>`:""}</div>`;
}

function toast(msg){
  let t=document.querySelector(".toast");
  if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
  t.textContent=msg;t.classList.add("show");
  clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),1800);
}

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download="my-reading-corner-backup.json";a.click();URL.revokeObjectURL(url);
  toast("Yedek dosyası hazır");
}

function importData(e){
  const file=e.target.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      if(!parsed.books || !Array.isArray(parsed.books)) throw new Error();
      state={...defaultState(),...parsed}; saveState("Yedek yüklendi");render();
    }catch{alert("Bu dosya geçerli bir My Reading Corner yedeği değil.");}
  };
  reader.readAsText(file); e.target.value="";
}
