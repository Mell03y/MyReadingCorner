import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://hdbevdqxewgjilaycgdt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BtS-a3q_GfOozAHsH0U3-g_jhDHpT8p";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const MONTHS = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];
const STATUS_LABELS = {
  reading:"Okuyorum", finished:"Okudum", tbr:"Okuyacağım", paused:"Ara verdim", dnf:"Yarım bıraktım"
};
const VALID_ROUTES = ["home","library","bookshelf","tracker","month-review","best-book","add-book"];

let currentUser = null;
let state = defaultState();
let currentRoute = "#home";
let authMode = "login";

function defaultState(){
  return {
    books: [],
    tracker: {},
    monthReviews: {},
    bestBook: { winnerId:null, nominees:[] },
    settings: { readingGoal:30 }
  };
}

function uuid(){
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    const v = c === "x" ? r : (r & 3) | 8;
    return v.toString(16);
  });
}

function esc(value=""){
  return String(value)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getRedirectUrl(){
  return `${window.location.origin}${window.location.pathname}`;
}

function setCloudBusy(isBusy, text="syncing"){
  const chip = document.getElementById("cloudChip");
  if (!chip) return;
  chip.textContent = isBusy ? `☁ ${text}…` : "☁ synced";
}

async function init(){
  bindGlobalUI();

  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    await enterApp();
  } else {
    renderAuth();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(async () => {
      const nextUser = session?.user || null;
      if (nextUser?.id === currentUser?.id) return;
      currentUser = nextUser;
      if (currentUser) await enterApp();
      else renderAuth();
    }, 0);
  });

  window.addEventListener("hashchange", () => {
    if (currentUser) render();
  });
}

function bindGlobalUI(){
  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    state = defaultState();
    renderAuth();
  });
}

async function enterApp(){
  document.body.classList.remove("auth-mode");
  document.getElementById("accountEmail").textContent = currentUser.email || "";
  document.getElementById("logoutBtn").style.display = "inline-flex";
  document.getElementById("exportBtn").style.display = "inline-flex";
  setCloudBusy(true,"loading");
  await loadCloudData();
  setCloudBusy(false);

  const rawHash = location.hash.slice(1);
  const valid = VALID_ROUTES.includes(rawHash) || rawHash.startsWith("book/");
  if (!valid) location.hash = "#home";
  else render();
}

function renderAuth(message="", isError=false){
  document.body.classList.add("auth-mode");
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("exportBtn").style.display = "none";
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="auth-shell">
      <section class="auth-art">
        <p class="mini-label">your cloud-synced reading journal</p>
        <h1>My Reading<br/>Corner ♡</h1>
        <p>Kitapların, kapakların, aylık tracker'ın ve yıl sonu favorilerin hesabına bağlı olarak bulutta saklanır.</p>
        <div class="auth-sticker">“A book is a dream you hold in your hands.” ✿</div>
      </section>
      <section class="auth-panel">
        <h2>${authMode === "login" ? "Tekrar hoş geldin" : "Kitaplığını oluştur"}</h2>
        <p>${authMode === "login" ? "Kitaplığına devam etmek için giriş yap." : "Ücretsiz hesabınla verilerini cihazlar arasında sakla."}</p>
        <div class="auth-tabs">
          <button class="auth-tab ${authMode==="login"?"active":""}" data-auth-tab="login">Giriş yap</button>
          <button class="auth-tab ${authMode==="signup"?"active":""}" data-auth-tab="signup">Kayıt ol</button>
        </div>
        <form class="auth-form" id="authForm">
          <label>E-posta
            <input type="email" name="email" required autocomplete="email" placeholder="mail@example.com">
          </label>
          <label>Şifre
            <input type="password" name="password" required minlength="6" autocomplete="${authMode==="login"?"current-password":"new-password"}" placeholder="en az 6 karakter">
          </label>
          <button class="primary-btn" type="submit">${authMode === "login" ? "Giriş yap" : "Hesap oluştur"}</button>
        </form>
        <div class="auth-message ${message?"show":""} ${isError?"error":""}" id="authMessage">${esc(message)}</div>
        <p class="auth-help">Kayıt olurken e-posta doğrulaması açıksa Supabase sana bir onay e-postası gönderir. Onaydan sonra bu sayfaya geri dönersin.</p>
      </section>
    </div>`;

  app.querySelectorAll("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => { authMode = btn.dataset.authTab; renderAuth(); });
  });
  app.querySelector("#authForm").addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(e){
  e.preventDefault();
  const button = e.currentTarget.querySelector("button[type='submit']");
  const fd = new FormData(e.currentTarget);
  const email = String(fd.get("email")||"").trim();
  const password = String(fd.get("password")||"");
  button.disabled = true;
  button.textContent = "Bekle…";

  if (authMode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: getRedirectUrl() }
    });
    if (error) return renderAuth(error.message,true);
    if (data.session) {
      currentUser = data.user;
      await enterApp();
    } else {
      renderAuth("Hesap oluşturuldu. E-postandaki doğrulama bağlantısına tıkla, sonra giriş yap.",false);
    }
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return renderAuth(error.message,true);
    currentUser = data.user;
    await enterApp();
  }
}

async function loadCloudData(){
  state = defaultState();
  const [{ data: books, error: booksError }, { data: journal, error: journalError }] = await Promise.all([
    supabase.from("books").select("*").order("created_at",{ascending:false}),
    supabase.from("reading_journal").select("*").eq("user_id",currentUser.id).maybeSingle()
  ]);

  if (booksError) {
    console.error(booksError);
    toast("Kitaplar yüklenemedi: " + booksError.message, true);
  } else {
    state.books = (books || []).map(fromDbBook);
  }

  if (journalError) {
    console.error(journalError);
    toast("Journal tablosu henüz hazır değil", true);
  } else if (journal) {
    state.tracker = journal.tracker || {};
    state.monthReviews = journal.month_reviews || {};
    state.bestBook = journal.best_book || {winnerId:null,nominees:[]};
    state.settings = {...state.settings,...(journal.settings||{})};
  } else {
    await saveJournal();
  }
}

function fromDbBook(r){
  return {
    id:r.id, createdAt:r.created_at, title:r.title||"", author:r.author||"", cover:r.cover_url||"", coverPath:r.cover_path||"",
    genre:r.genre||"", pages:Number(r.pages)||0, publishYear:r.publish_year||"", status:r.status||"tbr",
    startDate:r.start_date||"", finishedDate:r.finished_date||"", rating:Number(r.rating)||0, favorite:!!r.favorite,
    review:r.review||"", ratings:{
      story:Number(r.story_rating)||0, characters:Number(r.characters_rating)||0, writing:Number(r.writing_rating)||0,
      pacing:Number(r.pacing_rating)||0, ending:Number(r.ending_rating)||0, emotion:Number(r.emotion_rating)||0
    },
    favoriteCharacter:r.favorite_character||"", favoriteScene:r.favorite_scene||"", disliked:r.disliked||"",
    reread:r.reread||"", recommend:r.recommend||"", quotes:Array.isArray(r.quotes)?r.quotes:[], tags:Array.isArray(r.tags)?r.tags:[]
  };
}

function toDbBook(b){
  return {
    id:b.id, user_id:currentUser.id, title:b.title, author:b.author||null, genre:b.genre||null,
    pages:Number(b.pages)||0, publish_year:b.publishYear?Number(b.publishYear):null, status:b.status||"tbr",
    start_date:b.startDate||null, finished_date:b.finishedDate||null, rating:Number(b.rating)||0, favorite:!!b.favorite,
    review:b.review||null, story_rating:Number(b.ratings?.story)||0, characters_rating:Number(b.ratings?.characters)||0,
    writing_rating:Number(b.ratings?.writing)||0, pacing_rating:Number(b.ratings?.pacing)||0, ending_rating:Number(b.ratings?.ending)||0,
    emotion_rating:Number(b.ratings?.emotion)||0, favorite_character:b.favoriteCharacter||null, favorite_scene:b.favoriteScene||null,
    disliked:b.disliked||null, reread:b.reread||null, recommend:b.recommend||null, cover_url:b.cover||null,
    cover_path:b.coverPath||null, quotes:b.quotes||[], tags:b.tags||[], updated_at:new Date().toISOString()
  };
}

async function insertBook(book){
  setCloudBusy(true);
  const { data, error } = await supabase.from("books").insert(toDbBook(book)).select().single();
  setCloudBusy(false);
  if (error) throw error;
  return fromDbBook(data);
}

async function updateBook(book){
  setCloudBusy(true);
  const payload = toDbBook(book);
  delete payload.id;
  delete payload.user_id;
  const { data, error } = await supabase.from("books").update(payload).eq("id",book.id).select().single();
  setCloudBusy(false);
  if (error) throw error;
  const idx = state.books.findIndex(x=>x.id===book.id);
  if (idx>=0) state.books[idx] = fromDbBook(data);
  return state.books[idx];
}

async function saveJournal(message=""){
  if (!currentUser) return;
  setCloudBusy(true);
  const payload = {
    user_id:currentUser.id,
    tracker:state.tracker,
    month_reviews:state.monthReviews,
    best_book:state.bestBook,
    settings:state.settings,
    updated_at:new Date().toISOString()
  };
  const { error } = await supabase.from("reading_journal").upsert(payload,{onConflict:"user_id"});
  setCloudBusy(false);
  if (error) { toast("Kaydedilemedi: "+error.message,true); return false; }
  if (message) toast(message);
  return true;
}

async function uploadCover(file, bookId){
  if (!file) return {url:"",path:""};
  const allowed = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  if (!allowed[file.type]) throw new Error("Kapak JPG, PNG veya WEBP olmalı.");
  if (file.size > 5*1024*1024) throw new Error("Kapak en fazla 5 MB olabilir.");
  const path = `${currentUser.id}/${bookId}-${Date.now()}.${allowed[file.type]}`;
  const { error } = await supabase.storage.from("book-covers").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
  if (error) throw error;
  const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
  return {url:data.publicUrl,path};
}

async function removeCover(path){
  if (!path) return;
  const { error } = await supabase.storage.from("book-covers").remove([path]);
  if (error) console.warn("Kapak silinemedi",error);
}

function render(){
  if (!currentUser) return renderAuth();
  currentRoute = location.hash || "#home";
  const app = document.getElementById("app");
  const route = currentRoute.slice(1);

  document.querySelectorAll(".nav a").forEach(a => {
    const base = route.startsWith("book/") ? "library" : route;
    a.classList.toggle("active", a.dataset.route === base);
  });
  document.getElementById("sidebar").classList.remove("open");

  if(route.startsWith("book/")){
    setTitle("Book Review");
    renderBookDetail(app,route.split("/")[1]);
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
    default: location.hash="#home";
  }
}

function setTitle(t){ document.getElementById("pageTitle").textContent=t; }
function stats(){
  const finished=state.books.filter(b=>b.status==="finished");
  const pages=finished.reduce((a,b)=>a+(Number(b.pages)||0),0);
  const rated=finished.filter(b=>Number(b.rating)>0);
  const avg=rated.length?(rated.reduce((a,b)=>a+Number(b.rating),0)/rated.length).toFixed(1):"0.0";
  return {finished:finished.length,pages,avg,reading:state.books.filter(b=>b.status==="reading").length};
}

function renderHome(app){
  const s=stats(), year=new Date().getFullYear();
  const reading=state.books.filter(b=>b.status==="reading").slice(0,4);
  const recent=[...state.books].filter(b=>b.status==="finished").sort((a,b)=>(b.finishedDate||"").localeCompare(a.finishedDate||"")).slice(0,5);
  const goal=Number(state.settings.readingGoal)||30, pct=Math.min(100,Math.round((s.finished/goal)*100));
  app.innerHTML=`
    <section class="hero">
      <p class="mini-label">your cozy little book world</p>
      <h2>Welcome to your<br/>reading corner ♡</h2>
      <p>Kitapların artık hesabına bağlı. Kapaklar Storage'da, kitap bilgileri ve journal verileri veritabanında saklanıyor.</p>
      <div class="hero-actions"><a class="primary-btn" href="#add-book">＋ Yeni kitap ekle</a><a class="soft-btn" href="#tracker">Bugünkü tracker</a></div>
    </section>
    <div class="stat-grid">
      <div class="stat-card"><b>${s.finished}</b><span>${year} okunan</span></div>
      <div class="stat-card"><b>${s.pages.toLocaleString("tr-TR")}</b><span>Toplam sayfa</span></div>
      <div class="stat-card"><b>${s.avg} ★</b><span>Ortalama puan</span></div>
      <div class="stat-card"><b>${s.reading}</b><span>Şu an okunuyor</span></div>
    </div>
    <section class="section-card">
      <div class="section-head"><div><p class="mini-label">${year} reading goal</p><h2>${s.finished} / ${goal} kitap</h2></div><button class="soft-btn" id="goalBtn">Hedefi değiştir</button></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
    </section>
    <section class="section-card"><div class="section-head"><h2>Currently Reading</h2><a class="soft-btn" href="#library">Tüm kitaplar</a></div>${reading.length?bookGridHTML(reading):emptyHTML("📖","Henüz okuduğun bir kitap yok.","İlk kitabını ekleyip durumunu “Okuyorum” seçebilirsin.","#add-book")}</section>
    <section class="section-card"><div class="section-head"><h2>Recently Finished</h2><span class="mini-label">little victories</span></div>${recent.length?bookGridHTML(recent):emptyHTML("✿","Henüz biten kitap yok.","Bitirdiğin kitaplar burada görünecek.","#add-book")}</section>`;
  app.querySelector("#goalBtn").onclick=async()=>{
    const v=prompt("Yıllık kitap hedefin kaç?",goal);
    if(!v) return;
    const n=Math.max(1,Number(v)||goal); state.settings.readingGoal=n; await saveJournal("Okuma hedefi kaydedildi"); render();
  };
  bindBookCards(app);
}

function bookGridHTML(books){ return `<div class="book-grid">${books.map(bookCardHTML).join("")}</div>`; }
function bookCardHTML(b){
  const stars=Number(b.rating)>0?`${"★".repeat(Math.round(Number(b.rating)))} ${Number(b.rating).toFixed(1)}`:"Henüz puan yok";
  return `<article class="book-card" data-id="${b.id}">
    <button class="book-cover-wrap" data-action="open-book" aria-label="${esc(b.title)} detayını aç">
      ${b.cover?`<img class="book-cover" src="${esc(b.cover)}" alt="${esc(b.title)} kapağı">`:""}<span class="cover-placeholder">BOOK</span>
    </button>
    <div class="book-card-body"><div class="book-card-top"><span class="status-pill">${STATUS_LABELS[b.status]||"Kitap"}</span><button class="heart-btn ${b.favorite?"active":""}" data-action="favorite">${b.favorite?"♥":"♡"}</button></div><h3 class="book-title">${esc(b.title)}</h3><p class="book-author">${esc(b.author||"")}</p><div class="rating-line">${stars}</div></div>
  </article>`;
}
function bindBookCards(scope=document){
  scope.querySelectorAll("[data-action='open-book']").forEach(btn=>btn.addEventListener("click",()=>location.hash=`#book/${btn.closest("[data-id]").dataset.id}`));
  scope.querySelectorAll("[data-action='favorite']").forEach(btn=>btn.addEventListener("click",async()=>{
    const b=state.books.find(x=>x.id===btn.closest("[data-id]").dataset.id); if(!b)return;
    b.favorite=!b.favorite;
    try{await updateBook(b);toast("Favoriler güncellendi");render();}catch(e){b.favorite=!b.favorite;toast(e.message,true)}
  }));
}

function renderLibrary(app){
  app.innerHTML=`<section class="section-card"><div class="toolbar"><input id="searchBooks" placeholder="Kitap veya yazar ara…"><select id="statusFilter"><option value="all">Tüm durumlar</option><option value="reading">Okuyorum</option><option value="finished">Okudum</option><option value="tbr">Okuyacağım</option><option value="paused">Ara verdim</option><option value="dnf">Yarım bıraktım</option><option value="favorite">Favoriler</option></select><select id="sortBooks"><option value="newest">En yeni eklenen</option><option value="title">Kitap adına göre</option><option value="rating">Puana göre</option></select><a class="primary-btn" href="#add-book">＋ Add Book</a></div><div id="libraryResults"></div></section>`;
  const search=app.querySelector("#searchBooks"),status=app.querySelector("#statusFilter"),sort=app.querySelector("#sortBooks");
  function refresh(){
    const q=search.value.trim().toLowerCase(); let books=state.books.filter(b=>(!q||`${b.title} ${b.author}`.toLowerCase().includes(q))&&(status.value==="all"||(status.value==="favorite"?b.favorite:b.status===status.value)));
    if(sort.value==="title")books.sort((a,b)=>a.title.localeCompare(b.title,"tr"));
    if(sort.value==="rating")books.sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0));
    if(sort.value==="newest")books.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    const out=app.querySelector("#libraryResults"); out.innerHTML=books.length?bookGridHTML(books):emptyHTML("📚","Burada kitap yok.","Filtreyi değiştir veya yeni bir kitap ekle.","#add-book"); bindBookCards(out);
  }
  [search,status,sort].forEach(el=>el.addEventListener("input",refresh)); refresh();
}

function renderAddBook(app){
  app.innerHTML=`<section class="section-card"><div class="section-head"><div><p class="mini-label">new memory</p><h2>Yeni kitap ekle</h2></div></div>
  <form id="bookForm"><div class="form-grid">
    ${coverPickerHTML()}
    ${formGroup("Kitap adı","title","text",true)}${formGroup("Yazar","author","text",true)}${formGroup("Tür","genre","text",false,"Roman, klasik, fantastik...")}${formGroup("Sayfa sayısı","pages","number")}${formGroup("Yayın yılı","publishYear","number")}
    <div class="form-group"><label>Durum</label><select name="status"><option value="tbr">Okuyacağım</option><option value="reading">Okuyorum</option><option value="finished">Okudum</option><option value="paused">Ara verdim</option><option value="dnf">Yarım bıraktım</option></select></div>
    ${formGroup("Başlama tarihi","startDate","date")}${formGroup("Bitirme tarihi","finishedDate","date")}${formGroup("Genel puan (0-5)","rating","number",false,"4.5",'step="0.1" min="0" max="5"')}
    <div class="form-group full"><label>Kısa ilk not</label><textarea name="review" placeholder="Bu kitap hakkında ilk düşüncen…"></textarea></div>
  </div><div class="form-actions"><button class="primary-btn" type="submit" id="saveBookBtn">Kitabı buluta kaydet ♡</button><span class="save-status" id="saveStatus">☁ yükleniyor…</span><a class="soft-btn" href="#library">Vazgeç</a></div></form></section>`;
  bindCoverPreview(app);
  app.querySelector("#bookForm").addEventListener("submit",async e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget),btn=app.querySelector("#saveBookBtn"),statusEl=app.querySelector("#saveStatus");
    const bookId=uuid(), file=app.querySelector("#coverFile").files[0]; btn.disabled=true; statusEl.classList.add("show");
    let uploaded={url:"",path:""};
    try{
      if(file){statusEl.textContent="☁ kapak yükleniyor…";uploaded=await uploadCover(file,bookId)}
      statusEl.textContent="☁ kitap kaydediliyor…";
      const book={id:bookId,createdAt:new Date().toISOString(),title:String(fd.get("title")).trim(),author:String(fd.get("author")).trim(),cover:uploaded.url,coverPath:uploaded.path,genre:String(fd.get("genre")||"").trim(),pages:Number(fd.get("pages"))||0,publishYear:fd.get("publishYear"),status:fd.get("status"),startDate:fd.get("startDate"),finishedDate:fd.get("finishedDate"),rating:Number(fd.get("rating"))||0,favorite:false,review:String(fd.get("review")||"").trim(),ratings:{story:0,characters:0,writing:0,pacing:0,ending:0,emotion:0},favoriteCharacter:"",favoriteScene:"",disliked:"",reread:"",recommend:"",quotes:[],tags:[]};
      const saved=await insertBook(book); state.books.unshift(saved); toast("Kitap ve kapağı buluta kaydedildi ♡"); location.hash=`#book/${saved.id}`;
    }catch(err){ if(uploaded.path)await removeCover(uploaded.path); btn.disabled=false; statusEl.textContent="⚠ "+err.message; statusEl.classList.add("error"); toast(err.message,true); }
  });
}
function coverPickerHTML(current=""){
  return `<div class="cover-upload-card"><div class="cover-preview" id="coverPreview">${current?`<img src="${esc(current)}" alt="Mevcut kapak">`:`<span>BOOK<br/>COVER</span>`}</div><div class="cover-upload-copy"><h3>Kitap kapağı</h3><p>Bilgisayarından veya telefonundan JPG, PNG ya da WEBP kapak seç. En fazla 5 MB.</p><label class="file-picker">＋ Kapak seç<input type="file" id="coverFile" accept="image/jpeg,image/png,image/webp"></label><div class="upload-meta" id="coverMeta">${current?"Yeni bir dosya seçmezsen mevcut kapak kalır.":"Henüz kapak seçilmedi."}</div></div></div>`;
}
function bindCoverPreview(scope){
  const input=scope.querySelector("#coverFile"),preview=scope.querySelector("#coverPreview"),meta=scope.querySelector("#coverMeta"); if(!input)return;
  input.addEventListener("change",()=>{const file=input.files[0];if(!file)return; if(file.size>5*1024*1024){input.value="";return toast("Kapak en fazla 5 MB olabilir.",true)} const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${url}" alt="Kapak önizleme">`;meta.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`;});
}
function formGroup(label,name,type="text",required=false,placeholder="",extra=""){return `<div class="form-group"><label>${label}</label><input name="${name}" type="${type}" ${required?"required":""} placeholder="${placeholder}" ${extra}></div>`;}

function renderBookDetail(app,id){
  const b=state.books.find(x=>x.id===id); if(!b){app.innerHTML=emptyHTML("📕","Kitap bulunamadı.","Kitaplık sayfasına dönebilirsin.","#library");return}
  const R=b.ratings||{};
  app.innerHTML=`<div class="detail-layout"><aside class="detail-cover">${b.cover?`<img src="${esc(b.cover)}" alt="${esc(b.title)} kapağı">`:`<div class="no-cover">BOOK</div>`}<div class="badge-row"><span class="tag">${STATUS_LABELS[b.status]||""}</span>${b.genre?`<span class="tag">${esc(b.genre)}</span>`:""}${b.favorite?`<span class="tag">♥ favorite</span>`:""}</div><button class="soft-btn" id="toggleFav">${b.favorite?"♥ Favorilerden çıkar":"♡ Favorilere ekle"}</button></aside>
  <div class="detail-content"><p class="mini-label">book review page</p><h2>${esc(b.title)}</h2><p class="detail-meta">${esc(b.author||"")} ${b.pages?`• ${b.pages} sayfa`:""} ${b.publishYear?`• ${esc(b.publishYear)}`:""}</p>
  <section class="section-card"><div class="section-head"><h3>My Rating</h3><span class="tag">${Number(b.rating||0).toFixed(1)} / 5</span></div><div class="score-grid">${scoreCard("Konu",R.story)}${scoreCard("Karakterler",R.characters)}${scoreCard("Yazım dili",R.writing)}${scoreCard("Akıcılık",R.pacing)}${scoreCard("Final",R.ending)}${scoreCard("Hissettirdikleri",R.emotion)}</div></section>
  <section class="section-card"><div class="section-head"><h3>Değerlendirme</h3><button class="soft-btn" id="editBookBtn">Düzenle</button></div><p class="muted">${b.review?esc(b.review):"Henüz yorum eklenmedi."}</p><div class="review-grid"><div class="review-prompt"><label>En sevdiğim karakter</label><div>${esc(b.favoriteCharacter||"—")}</div></div><div class="review-prompt"><label>En sevdiğim sahne / bölüm</label><div>${esc(b.favoriteScene||"—")}</div></div><div class="review-prompt"><label>Sevmediğim kısım</label><div>${esc(b.disliked||"—")}</div></div><div class="review-prompt"><label>Tekrar okur muyum?</label><div>${esc(b.reread||"—")}</div></div></div></section>
  <section class="section-card"><div class="section-head"><h3>Favorite Quotes</h3><button class="soft-btn" id="addQuoteBtn">＋ Alıntı ekle</button></div>${(b.quotes||[]).length?b.quotes.map(q=>`<blockquote class="quote-card">“${esc(q.text)}” ${q.page?`<span class="small muted">— s. ${esc(q.page)}</span>`:""}</blockquote>`).join(""):`<p class="muted">Henüz alıntı eklenmedi.</p>`}</section>
  <div class="form-actions"><a class="soft-btn" href="#library">← Kitaplığa dön</a><button class="danger-btn" id="deleteBookBtn">Kitabı sil</button></div></div></div>`;
  app.querySelector("#toggleFav").onclick=async()=>{b.favorite=!b.favorite;try{await updateBook(b);toast("Favoriler güncellendi");render()}catch(e){b.favorite=!b.favorite;toast(e.message,true)}};
  app.querySelector("#addQuoteBtn").onclick=async()=>{const text=prompt("Alıntıyı yaz:");if(!text)return;const page=prompt("Sayfa numarası (isteğe bağlı):")||"";b.quotes=b.quotes||[];b.quotes.push({text,page});try{await updateBook(b);toast("Alıntı buluta kaydedildi");render()}catch(e){b.quotes.pop();toast(e.message,true)}};
  app.querySelector("#editBookBtn").onclick=()=>renderBookEdit(app,b);
  app.querySelector("#deleteBookBtn").onclick=async()=>{if(!confirm(`“${b.title}” silinsin mi?`))return;setCloudBusy(true);const {error}=await supabase.from("books").delete().eq("id",b.id);setCloudBusy(false);if(error)return toast(error.message,true);await removeCover(b.coverPath);state.books=state.books.filter(x=>x.id!==b.id);state.bestBook.nominees=state.bestBook.nominees.filter(x=>x!==b.id);if(state.bestBook.winnerId===b.id)state.bestBook.winnerId=null;await saveJournal();toast("Kitap silindi");location.hash="#library"};
}
function scoreCard(label,value){const v=Number(value)||0;return `<div class="score-card"><span>${label}</span><b>${v.toFixed(1)} / 5</b></div>`;}

function renderBookEdit(app,b){
  const R=b.ratings||{};
  app.innerHTML=`<section class="section-card"><div class="section-head"><div><p class="mini-label">edit review</p><h2>${esc(b.title)}</h2></div></div><form id="editBookForm"><div class="form-grid">${coverPickerHTML(b.cover)}${editInput("Kitap adı","title",b.title,true)}${editInput("Yazar","author",b.author,true)}${editInput("Tür","genre",b.genre)}${editInput("Sayfa sayısı","pages",b.pages,false,"number")}${editInput("Genel puan","rating",b.rating,false,"number",'step="0.1" min="0" max="5"')}<div class="form-group"><label>Durum</label><select name="status">${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${b.status===k?"selected":""}>${v}</option>`).join("")}</select></div>${editInput("Başlama tarihi","startDate",b.startDate,false,"date")}${editInput("Bitirme tarihi","finishedDate",b.finishedDate,false,"date")}${ratingInput("Konu","story",R.story)}${ratingInput("Karakterler","characters",R.characters)}${ratingInput("Yazım dili","writing",R.writing)}${ratingInput("Akıcılık","pacing",R.pacing)}${ratingInput("Final","ending",R.ending)}${ratingInput("Hissettirdikleri","emotion",R.emotion)}<div class="form-group full"><label>Genel yorumum</label><textarea name="review">${esc(b.review||"")}</textarea></div><div class="form-group"><label>En sevdiğim karakter</label><input name="favoriteCharacter" value="${esc(b.favoriteCharacter||"")}"></div><div class="form-group"><label>En sevdiğim sahne / bölüm</label><input name="favoriteScene" value="${esc(b.favoriteScene||"")}"></div><div class="form-group"><label>Sevmediğim kısım</label><input name="disliked" value="${esc(b.disliked||"")}"></div><div class="form-group"><label>Tekrar okur muyum?</label><input name="reread" value="${esc(b.reread||"")}" placeholder="Evet / Hayır / Belki"></div></div><div class="form-actions"><button class="primary-btn" id="editSaveBtn">Kaydet</button><span class="save-status" id="saveStatus">☁ kaydediliyor…</span><button type="button" class="soft-btn" id="cancelEdit">Vazgeç</button></div></form></section>`;
  bindCoverPreview(app); app.querySelector("#cancelEdit").onclick=()=>renderBookDetail(app,b.id);
  app.querySelector("#editBookForm").onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget),file=app.querySelector("#coverFile").files[0],btn=app.querySelector("#editSaveBtn"),statusEl=app.querySelector("#saveStatus");btn.disabled=true;statusEl.classList.add("show");
    const oldCover={url:b.cover,path:b.coverPath};let newCover=null;
    try{
      if(file){statusEl.textContent="☁ yeni kapak yükleniyor…";newCover=await uploadCover(file,b.id);b.cover=newCover.url;b.coverPath=newCover.path}
      ["title","author","genre","status","startDate","finishedDate","review","favoriteCharacter","favoriteScene","disliked","reread"].forEach(k=>b[k]=String(fd.get(k)||""));b.pages=Number(fd.get("pages"))||0;b.rating=Number(fd.get("rating"))||0;b.ratings={story:+fd.get("story")||0,characters:+fd.get("characters")||0,writing:+fd.get("writing")||0,pacing:+fd.get("pacing")||0,ending:+fd.get("ending")||0,emotion:+fd.get("emotion")||0};
      await updateBook(b);if(newCover&&oldCover.path)await removeCover(oldCover.path);toast("Kitap güncellendi");render();
    }catch(err){if(newCover?.path)await removeCover(newCover.path);b.cover=oldCover.url;b.coverPath=oldCover.path;btn.disabled=false;statusEl.textContent="⚠ "+err.message;statusEl.classList.add("error");toast(err.message,true)}
  };
}
function editInput(label,name,value="",required=false,type="text",extra=""){return `<div class="form-group"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value??"")}" ${required?"required":""} ${extra}></div>`;}
function ratingInput(label,name,value){return `<div class="form-group"><label>${label} (0-5)</label><input name="${name}" type="number" value="${Number(value)||0}" step="0.1" min="0" max="5"></div>`;}

function renderBookshelf(app){
  const books=state.books,rows=[[],[],[]];books.forEach((b,i)=>rows[i%3].push(b));
  app.innerHTML=`<section class="section-card"><div class="section-head"><div><p class="mini-label">visual shelf</p><h2>My Bookshelf</h2></div><span class="tag">${books.length} kitap</span></div>${books.length?`<div class="shelf">${rows.map(row=>`<div class="shelf-row">${row.map(b=>`<button class="spine" data-id="${b.id}" title="${esc(b.title)}">${esc(b.title)}</button>`).join("")}${row.length===0?`<span class="muted small">Bu rafta henüz kitap yok.</span>`:""}</div>`).join("")}</div>`:emptyHTML("▤","Kitaplık henüz boş.","Kitap eklediğinde burada raflara dizilecek.","#add-book")}</section>`;
  app.querySelectorAll(".spine").forEach(el=>el.onclick=()=>location.hash=`#book/${el.dataset.id}`);
}

function renderTracker(app){
  const now=new Date(),selectedKey=state.uiTrackerMonth||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,[year,month]=selectedKey.split("-").map(Number),days=new Date(year,month,0).getDate(),monthData=state.tracker[selectedKey]||{},totalPages=Object.values(monthData).reduce((a,d)=>a+(Number(d.pages)||0),0),readingDays=Object.values(monthData).filter(d=>Number(d.pages)>0).length;
  app.innerHTML=`<section class="section-card"><div class="tracker-head"><div><p class="mini-label">daily reading journal</p><h2>${MONTHS[month-1]} ${year}</h2></div><div class="month-select"><label>Ay</label><input type="month" id="trackerMonth" value="${selectedKey}" class="field"></div></div><div class="stat-grid"><div class="stat-card"><b>${readingDays}</b><span>Okunan gün</span></div><div class="stat-card"><b>${totalPages}</b><span>Toplam sayfa</span></div><div class="stat-card"><b>${days}</b><span>Ayın günü</span></div><div class="stat-card"><b>${readingDays?Math.round(totalPages/readingDays):0}</b><span>Günlük ortalama</span></div></div><div class="tracker-grid">${Array.from({length:days},(_,i)=>{const d=i+1,data=monthData[d]||{};return `<div class="day-card" data-day="${d}"><div class="day-num">${d}</div><input type="number" min="0" data-field="pages" placeholder="sayfa" value="${data.pages||""}"><textarea data-field="note" placeholder="mini not…">${esc(data.note||"")}</textarea><span class="day-total">${data.pages?`${data.pages} sayfa okundu`:"henüz kayıt yok"}</span></div>`}).join("")}</div></section>`;
  app.querySelector("#trackerMonth").addEventListener("change",e=>{state.uiTrackerMonth=e.target.value;render()});
  app.querySelectorAll(".day-card input,.day-card textarea").forEach(el=>el.addEventListener("change",async()=>{const card=el.closest(".day-card"),day=card.dataset.day;state.tracker[selectedKey]=state.tracker[selectedKey]||{};const rec=state.tracker[selectedKey][day]||{pages:0,note:""};rec[el.dataset.field]=el.dataset.field==="pages"?(Number(el.value)||0):el.value;state.tracker[selectedKey][day]=rec;await saveJournal("Tracker buluta kaydedildi");render()}));
}

function renderMonthReview(app){
  const now=new Date(),selectedKey=state.uiReviewMonth||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,[year,month]=selectedKey.split("-").map(Number),review=state.monthReviews[selectedKey]||{},monthBooks=state.books.filter(b=>b.status==="finished"&&b.finishedDate?.startsWith(selectedKey)),pages=monthBooks.reduce((a,b)=>a+(Number(b.pages)||0),0),best=bestRated(monthBooks);
  app.innerHTML=`<section class="section-card"><div class="tracker-head"><div><p class="mini-label">end of month</p><h2>${MONTHS[month-1]} ${year} Review</h2></div><input type="month" id="reviewMonth" value="${selectedKey}" class="field"></div><div class="stat-grid"><div class="stat-card"><b>${monthBooks.length}</b><span>Bitirilen kitap</span></div><div class="stat-card"><b>${pages}</b><span>Toplam sayfa</span></div><div class="stat-card"><b>${best?.rating||"—"}</b><span>En yüksek puan</span></div><div class="stat-card"><b>${best?esc(best.title).slice(0,16):"—"}</b><span>Ayın yıldızı</span></div></div><form id="monthReviewForm" class="review-grid">${reviewArea("Ayın en sevdiğim kitabı","bestBook",review.bestBook)}${reviewArea("En sevdiğim karakter","bestCharacter",review.bestCharacter)}${reviewArea("Ayın favori alıntısı","quote",review.quote)}${reviewArea("En çok etkileyen kitap","impact",review.impact)}${reviewArea("Hayal kırıklığı","disappointment",review.disappointment)}${reviewArea("Bu ayın okuma ruh hali","mood",review.mood)}${reviewArea("Gelecek ay okumak istediklerim","nextMonth",review.nextMonth)}${reviewArea("Ayın genel notu","summary",review.summary)}<div class="form-actions" style="grid-column:1/-1"><button class="primary-btn">Ay sonu değerlendirmesini buluta kaydet</button></div></form><section style="margin-top:24px"><div class="section-head"><h3>Bu ay bitenler</h3><span class="tag">${monthBooks.length} kitap</span></div>${monthBooks.length?bookGridHTML(monthBooks):`<p class="muted">Bu aya ait bitiş tarihi olan kitap bulunamadı.</p>`}</section></section>`;
  app.querySelector("#reviewMonth").addEventListener("change",e=>{state.uiReviewMonth=e.target.value;render()});
  app.querySelector("#monthReviewForm").addEventListener("submit",async e=>{e.preventDefault();state.monthReviews[selectedKey]=Object.fromEntries(new FormData(e.currentTarget).entries());await saveJournal("Ay sonu değerlendirmesi buluta kaydedildi")}); bindBookCards(app);
}
function reviewArea(label,name,value=""){return `<div class="review-prompt"><label>${label}</label><textarea name="${name}" placeholder="buraya yaz…">${esc(value||"")}</textarea></div>`;}
function bestRated(books){return [...books].sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0))[0];}

function renderBestBook(app){
  const year=new Date().getFullYear(),finished=state.books.filter(b=>b.status==="finished"),nominees=state.bestBook.nominees.map(id=>state.books.find(b=>b.id===id)).filter(Boolean),winner=state.books.find(b=>b.id===state.bestBook.winnerId);
  app.innerHTML=`<section class="section-card"><div class="section-head"><div><p class="mini-label">battle of books</p><h2>Best Book of ${year}</h2></div>${winner?`<span class="tag">winner: ${esc(winner.title)}</span>`:""}</div><p class="muted">Bitirdiğin kitaplardan adaylarını seç. Yıl sonunda içlerinden birini yılın kitabı yap.</p><div class="toolbar"><select id="nomineeSelect"><option value="">Aday kitap seç…</option>${finished.filter(b=>!state.bestBook.nominees.includes(b.id)).map(b=>`<option value="${b.id}">${esc(b.title)} — ${esc(b.author||"")}</option>`).join("")}</select><button class="primary-btn" id="addNominee">Aday ekle</button></div>${nominees.length?`<div class="battle-grid">${nominees.map(b=>`<article class="nominee" data-id="${b.id}">${state.bestBook.winnerId===b.id?`<span class="winner-ribbon">BEST BOOK</span>`:""}${b.cover?`<img src="${esc(b.cover)}" alt="${esc(b.title)}">`:`<div class="nominee-placeholder">BOOK</div>`}<h4>${esc(b.title)}</h4><p class="small muted">${esc(b.author||"")} • ${Number(b.rating||0).toFixed(1)} ★</p><div class="form-actions" style="justify-content:center"><button class="soft-btn" data-action="winner">Kazanan yap</button><button class="icon-btn" data-action="remove">×</button></div></article>`).join("")}</div><div class="bracket"><h3>Final board</h3><div class="bracket-flow">${nominees.map((b,i)=>`${i?`<span class="arrow">→</span>`:""}<span class="bracket-chip">${esc(b.title)}</span>`).join("")}${winner?`<span class="arrow">→</span><span class="bracket-chip">♡ ${esc(winner.title)} ♡</span>`:""}</div></div>`:emptyHTML("♡","Henüz aday yok.","Bitirdiğin kitaplardan yılın favorilerini buraya ekle.","#library")}</section>`;
  const select=app.querySelector("#nomineeSelect");app.querySelector("#addNominee").onclick=async()=>{if(!select.value)return toast("Önce bir kitap seç",true);state.bestBook.nominees.push(select.value);await saveJournal("Aday buluta kaydedildi");render()};
  app.querySelectorAll("[data-action='winner']").forEach(btn=>btn.onclick=async()=>{state.bestBook.winnerId=btn.closest("[data-id]").dataset.id;await saveJournal("Yılın kitabı seçildi ♡");render()});
  app.querySelectorAll("[data-action='remove']").forEach(btn=>btn.onclick=async()=>{const id=btn.closest("[data-id]").dataset.id;state.bestBook.nominees=state.bestBook.nominees.filter(x=>x!==id);if(state.bestBook.winnerId===id)state.bestBook.winnerId=null;await saveJournal("Aday çıkarıldı");render()});
}

function emptyHTML(icon,title,text,href){return `<div class="empty"><div class="big">${icon}</div><h3>${title}</h3><p>${text}</p>${href?`<a class="primary-btn" href="${href}">Devam et</a>`:""}</div>`;}
function toast(msg,isError=false){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.style.background=isError?"#934b55":"#5f4b44";t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2600)}
function exportData(){const payload={exportedAt:new Date().toISOString(),user:currentUser?.email,state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="my-reading-corner-cloud-backup.json";a.click();URL.revokeObjectURL(url);toast("Yedek dosyası hazır")}

init();
