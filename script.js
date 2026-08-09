import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://hdbevdqxewgjilaycgdt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BtS-a3q_GfOozAHsH0U3-g_jhDHpT8p";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];

const STATUS_LABELS = {
  reading: "Okuyorum",
  finished: "Okudum",
  tbr: "Okuyacağım",
  paused: "Ara verdim",
  dnf: "Yarım bıraktım"
};

const VALID_ROUTES = [
  "home",
  "library",
  "wish-list",
  "finished",
  "bookshelf",
  "tracker",
  "month-review",
  "best-book",
  "add-book"
];

let currentUser = null;
let state = defaultState();
let currentRoute = "#home";
let authMode = "login";

function defaultState(){
  return {
    books: [],
    tracker: {},
    monthReviews: {},
    bestBook: {
      winnerId: null,
      nominees: []
    },
    settings: {
      readingGoal: 30
    }
  };
}

function uuid(){
  if (crypto.randomUUID) return crypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    c => {
      const r =
        crypto.getRandomValues(new Uint8Array(1))[0] & 15;

      const v =
        c === "x"
          ? r
          : (r & 3) | 8;

      return v.toString(16);
    }
  );
}

function esc(value=""){
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getRedirectUrl(){
  return `${window.location.origin}${window.location.pathname}`;
}

function setCloudBusy(isBusy,text="syncing"){
  const chip =
    document.getElementById("cloudChip");

  if(!chip) return;

  chip.textContent =
    isBusy
      ? `☁ ${text}…`
      : "☁ synced";
}

async function init(){

  bindGlobalUI();

  const {
    data: { session }
  } =
    await supabase.auth.getSession();

  currentUser =
    session?.user || null;

  if(currentUser){
    await enterApp();
  }else{
    renderAuth();
  }

  supabase.auth.onAuthStateChange(
    (_event,session)=>{
      setTimeout(
        async ()=>{

          const nextUser =
            session?.user || null;

          if(
            nextUser?.id ===
            currentUser?.id
          ){
            return;
          }

          currentUser =
            nextUser;

          if(currentUser){
            await enterApp();
          }else{
            renderAuth();
          }

        },
        0
      );
    }
  );

  window.addEventListener(
    "hashchange",
    ()=>{
      if(currentUser){
        render();
      }
    }
  );
}

function bindGlobalUI(){

  document
    .getElementById("menuBtn")
    .addEventListener(
      "click",
      ()=>{
        document
          .getElementById("sidebar")
          .classList.toggle("open");
      }
    );

  document
    .getElementById("exportBtn")
    .addEventListener(
      "click",
      exportData
    );

  document
    .getElementById("logoutBtn")
    .addEventListener(
      "click",
      async ()=>{

        await supabase.auth.signOut();

        currentUser = null;
        state = defaultState();

        renderAuth();
      }
    );
}

async function enterApp(){

  document.body
    .classList.remove("auth-mode");

  document
    .getElementById("accountEmail")
    .textContent =
    currentUser.email || "";

  document
    .getElementById("logoutBtn")
    .style.display =
    "inline-flex";

  document
    .getElementById("exportBtn")
    .style.display =
    "inline-flex";

  setCloudBusy(
    true,
    "loading"
  );

  await loadCloudData();

  setCloudBusy(false);

  const rawHash =
    location.hash.slice(1);

  const valid =
    VALID_ROUTES.includes(rawHash) ||
    rawHash.startsWith("book/");

  if(!valid){
    location.hash =
      "#home";
  }else{
    render();
  }
}

/* =================================================
   AUTH
================================================= */

function renderAuth(
  message="",
  isError=false
){

  document.body
    .classList.add("auth-mode");

  document
    .getElementById("logoutBtn")
    .style.display =
    "none";

  document
    .getElementById("exportBtn")
    .style.display =
    "none";

  const app =
    document.getElementById("app");

  app.innerHTML = `
    <div class="auth-shell">

      <section class="auth-art">

        <p class="mini-label">
          your cloud-synced reading journal
        </p>

        <h1>
          My Reading<br/>
          Corner ♡
        </h1>

        <p>
          Kitapların, kapakların,
          aylık tracker'ın ve
          yıl sonu favorilerin
          hesabına bağlı olarak
          bulutta saklanır.
        </p>

        <div class="auth-sticker">
          “A book is a dream
          you hold in your hands.” ✿
        </div>

      </section>

      <section class="auth-panel">

        <h2>
          ${
            authMode==="login"
            ? "Tekrar hoş geldin"
            : "Kitaplığını oluştur"
          }
        </h2>

        <p>
          ${
            authMode==="login"
            ? "Kitaplığına devam etmek için giriş yap."
            : "Ücretsiz hesabınla verilerini cihazlar arasında sakla."
          }
        </p>

        <div class="auth-tabs">

          <button
            class="auth-tab ${
              authMode==="login"
                ? "active"
                : ""
            }"
            data-auth-tab="login"
          >
            Giriş yap
          </button>

          <button
            class="auth-tab ${
              authMode==="signup"
                ? "active"
                : ""
            }"
            data-auth-tab="signup"
          >
            Kayıt ol
          </button>

        </div>

        <form
          class="auth-form"
          id="authForm"
        >

          <label>
            E-posta

            <input
              type="email"
              name="email"
              required
              autocomplete="email"
              placeholder="mail@example.com"
            >
          </label>

          <label>
            Şifre

            <input
              type="password"
              name="password"
              required
              minlength="6"
              autocomplete="${
                authMode==="login"
                ? "current-password"
                : "new-password"
              }"
              placeholder="en az 6 karakter"
            >
          </label>

          <button
            class="primary-btn"
            type="submit"
          >
            ${
              authMode==="login"
                ? "Giriş yap"
                : "Hesap oluştur"
            }
          </button>

        </form>

        <div
          class="
            auth-message
            ${message ? "show" : ""}
            ${isError ? "error" : ""}
          "
          id="authMessage"
        >
          ${esc(message)}
        </div>

        <p class="auth-help">
          Kayıt olurken e-posta
          doğrulaması açıksa Supabase
          sana bir onay e-postası
          gönderir.
        </p>

      </section>

    </div>
  `;

  app
    .querySelectorAll(
      "[data-auth-tab]"
    )
    .forEach(
      btn=>{
        btn.addEventListener(
          "click",
          ()=>{
            authMode =
              btn.dataset.authTab;

            renderAuth();
          }
        );
      }
    );

  app
    .querySelector("#authForm")
    .addEventListener(
      "submit",
      handleAuthSubmit
    );
}

async function handleAuthSubmit(e){

  e.preventDefault();

  const button =
    e.currentTarget.querySelector(
      "button[type='submit']"
    );

  const fd =
    new FormData(
      e.currentTarget
    );

  const email =
    String(
      fd.get("email") || ""
    ).trim();

  const password =
    String(
      fd.get("password") || ""
    );

  button.disabled = true;
  button.textContent =
    "Bekle…";

  if(authMode==="signup"){

    const {
      data,
      error
    } =
      await supabase.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo:
            getRedirectUrl()
        }
      });

    if(error){
      return renderAuth(
        error.message,
        true
      );
    }

    if(data.session){

      currentUser =
        data.user;

      await enterApp();

    }else{

      renderAuth(
        "Hesap oluşturuldu. E-postandaki doğrulama bağlantısına tıkla, sonra giriş yap.",
        false
      );

    }

  }else{

    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if(error){
      return renderAuth(
        error.message,
        true
      );
    }

    currentUser =
      data.user;

    await enterApp();
  }
}

/* =================================================
   CLOUD
================================================= */

async function loadCloudData(){

  state =
    defaultState();

  const [
    {
      data:books,
      error:booksError
    },
    {
      data:journal,
      error:journalError
    }
  ] =
    await Promise.all([

      supabase
        .from("books")
        .select("*")
        .order(
          "created_at",
          {
            ascending:false
          }
        ),

      supabase
        .from("reading_journal")
        .select("*")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle()

    ]);

  if(booksError){

    console.error(
      booksError
    );

    toast(
      "Kitaplar yüklenemedi: " +
      booksError.message,
      true
    );

  }else{

    state.books =
      (books || [])
      .map(fromDbBook);

  }

  if(journalError){

    console.error(
      journalError
    );

    toast(
      "Journal tablosu henüz hazır değil",
      true
    );

  }else if(journal){

    state.tracker =
      journal.tracker || {};

    state.monthReviews =
      journal.month_reviews || {};

    state.bestBook =
      journal.best_book || {
        winnerId:null,
        nominees:[]
      };

    state.settings = {
      ...state.settings,
      ...(journal.settings || {})
    };

  }else{

    await saveJournal();

  }
}

function fromDbBook(r){

  return {

    id:r.id,

    createdAt:
      r.created_at,

    title:
      r.title || "",

    author:
      r.author || "",

    cover:
      r.cover_url || "",

    coverPath:
      r.cover_path || "",

    genre:
      r.genre || "",

    pages:
      Number(r.pages) || 0,

    publishYear:
      r.publish_year || "",

    status:
      r.status || "tbr",

    startDate:
      r.start_date || "",

    finishedDate:
      r.finished_date || "",

    rating:
      Number(r.rating) || 0,

    favorite:
      !!r.favorite,

    review:
      r.review || "",

    ratings:{

      story:
        Number(r.story_rating) || 0,

      characters:
        Number(r.characters_rating) || 0,

      writing:
        Number(r.writing_rating) || 0,

      pacing:
        Number(r.pacing_rating) || 0,

      ending:
        Number(r.ending_rating) || 0,

      emotion:
        Number(r.emotion_rating) || 0

    },

    favoriteCharacter:
      r.favorite_character || "",

    favoriteScene:
      r.favorite_scene || "",

    disliked:
      r.disliked || "",

    reread:
      r.reread || "",

    recommend:
      r.recommend || "",

    quotes:
      Array.isArray(r.quotes)
        ? r.quotes
        : [],

    tags:
      Array.isArray(r.tags)
        ? r.tags
        : []

  };
}

function toDbBook(b){

  return {

    id:b.id,

    user_id:
      currentUser.id,

    title:
      b.title,

    author:
      b.author || null,

    genre:
      b.genre || null,

    pages:
      Number(b.pages) || 0,

    publish_year:
      b.publishYear
        ? Number(b.publishYear)
        : null,

    status:
      b.status || "tbr",

    start_date:
      b.startDate || null,

    finished_date:
      b.finishedDate || null,

    rating:
      Number(b.rating) || 0,

    favorite:
      !!b.favorite,

    review:
      b.review || null,

    story_rating:
      Number(
        b.ratings?.story
      ) || 0,

    characters_rating:
      Number(
        b.ratings?.characters
      ) || 0,

    writing_rating:
      Number(
        b.ratings?.writing
      ) || 0,

    pacing_rating:
      Number(
        b.ratings?.pacing
      ) || 0,

    ending_rating:
      Number(
        b.ratings?.ending
      ) || 0,

    emotion_rating:
      Number(
        b.ratings?.emotion
      ) || 0,

    favorite_character:
      b.favoriteCharacter || null,

    favorite_scene:
      b.favoriteScene || null,

    disliked:
      b.disliked || null,

    reread:
      b.reread || null,

    recommend:
      b.recommend || null,

    cover_url:
      b.cover || null,

    cover_path:
      b.coverPath || null,

    quotes:
      b.quotes || [],

    tags:
      b.tags || [],

    updated_at:
      new Date().toISOString()

  };
}

async function insertBook(book){

  setCloudBusy(true);

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .insert(
        toDbBook(book)
      )
      .select()
      .single();

  setCloudBusy(false);

  if(error){
    throw error;
  }

  return fromDbBook(
    data
  );
}

async function updateBook(book){

  setCloudBusy(true);

  const payload =
    toDbBook(book);

  delete payload.id;
  delete payload.user_id;

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .update(payload)
      .eq(
        "id",
        book.id
      )
      .select()
      .single();

  setCloudBusy(false);

  if(error){
    throw error;
  }

  const idx =
    state.books.findIndex(
      x=>x.id===book.id
    );

  if(idx>=0){
    state.books[idx] =
      fromDbBook(data);
  }

  return state.books[idx];
}

async function saveJournal(
  message=""
){

  if(!currentUser){
    return;
  }

  setCloudBusy(true);

  const payload = {

    user_id:
      currentUser.id,

    tracker:
      state.tracker,

    month_reviews:
      state.monthReviews,

    best_book:
      state.bestBook,

    settings:
      state.settings,

    updated_at:
      new Date().toISOString()

  };

  const {
    error
  } =
    await supabase
      .from("reading_journal")
      .upsert(
        payload,
        {
          onConflict:"user_id"
        }
      );

  setCloudBusy(false);

  if(error){

    toast(
      "Kaydedilemedi: " +
      error.message,
      true
    );

    return false;
  }

  if(message){
    toast(message);
  }

  return true;
}

async function uploadCover(
  file,
  bookId
){

  if(!file){
    return {
      url:"",
      path:""
    };
  }

  const allowed = {
    "image/jpeg":"jpg",
    "image/png":"png",
    "image/webp":"webp"
  };

  if(!allowed[file.type]){
    throw new Error(
      "Kapak JPG, PNG veya WEBP olmalı."
    );
  }

  if(
    file.size >
    5*1024*1024
  ){
    throw new Error(
      "Kapak en fazla 5 MB olabilir."
    );
  }

  const path =
    `${
      currentUser.id
    }/${
      bookId
    }-${
      Date.now()
    }.${
      allowed[file.type]
    }`;

  const {
    error
  } =
    await supabase.storage
      .from("book-covers")
      .upload(
        path,
        file,
        {
          contentType:
            file.type,

          cacheControl:
            "3600",

          upsert:false
        }
      );

  if(error){
    throw error;
  }

  const {
    data
  } =
    supabase.storage
      .from("book-covers")
      .getPublicUrl(path);

  return {
    url:data.publicUrl,
    path
  };
}

async function removeCover(path){

  if(!path){
    return;
  }

  const {
    error
  } =
    await supabase.storage
      .from("book-covers")
      .remove([path]);

  if(error){
    console.warn(
      "Kapak silinemedi",
      error
    );
  }
}

/* =================================================
   ROUTING
================================================= */

function render(){

  if(!currentUser){
    return renderAuth();
  }

  currentRoute =
    location.hash || "#home";

  const app =
    document.getElementById("app");

  const route =
    currentRoute.slice(1);

  document
    .querySelectorAll(
      ".nav a"
    )
    .forEach(
      a=>{

        const base =
          route.startsWith("book/")
            ? "library"
            : route;

        a.classList.toggle(
          "active",
          a.dataset.route===base
        );

      }
    );

  document
    .getElementById("sidebar")
    .classList.remove("open");

  if(
    route.startsWith("book/")
  ){

    setTitle(
      "Book Review"
    );

    renderBookDetail(
      app,
      route.split("/")[1]
    );

    return;
  }

  switch(route){

    case "home":
      setTitle(
        "My Reading Corner"
      );
      renderHome(app);
      break;

    case "library":
      setTitle(
        "My Library"
      );
      renderLibrary(app);
      break;

    case "wish-list":
      setTitle(
        "Wish List"
      );
      renderWishList(app);
      break;

    case "finished":
      setTitle(
        "Finished Books"
      );
      renderFinishedBooks(app);
      break;

    case "bookshelf":
      setTitle(
        "Bookshelf"
      );
      renderBookshelf(app);
      break;

    case "tracker":
      setTitle(
        "Monthly Tracker"
      );
      renderTracker(app);
      break;

    case "month-review":
      setTitle(
        "Month Review"
      );
      renderMonthReview(app);
      break;

    case "best-book":
      setTitle(
        "Best Book"
      );
      renderBestBook(app);
      break;

    case "add-book":
      setTitle(
        "Add Book"
      );
      renderAddBook(app);
      break;

    default:
      location.hash =
        "#home";
  }
}

function setTitle(t){
  document
    .getElementById("pageTitle")
    .textContent =
    t;
}

/* =================================================
   STATS
================================================= */

function stats(){

  const finished =
    state.books.filter(
      b=>
        b.status==="finished"
    );

  const pages =
    finished.reduce(
      (a,b)=>
        a +
        (Number(b.pages)||0),
      0
    );

  const rated =
    finished.filter(
      b=>
        Number(b.rating)>0
    );

  const avg =
    rated.length
      ? (
          rated.reduce(
            (a,b)=>
              a+
              Number(b.rating),
            0
          ) /
          rated.length
        ).toFixed(1)
      : "0.0";

  return {

    finished:
      finished.length,

    pages,

    avg,

    reading:
      state.books.filter(
        b=>
          b.status==="reading"
      ).length

  };
}

function bestRated(books){

  if(!books.length){
    return null;
  }

  return [...books]
    .sort(
      (a,b)=>
        (Number(b.rating)||0) -
        (Number(a.rating)||0)
    )[0];
}

/* =================================================
   HOME
================================================= */

function renderHome(app){

  const s =
    stats();

  const now =
    new Date();

  const year =
    now.getFullYear();

  const monthKey =
    `${year}-${
      String(
        now.getMonth()+1
      ).padStart(
        2,
        "0"
      )
    }`;

  const monthName =
    MONTHS[
      now.getMonth()
    ];

  const reading =
    state.books
      .filter(
        b=>
          b.status==="reading"
      )
      .slice(
        0,
        4
      );

  const monthBooks =
    [...state.books]
      .filter(
        b=>
          b.status==="finished" &&
          b.finishedDate?.startsWith(
            monthKey
          )
      )
      .sort(
        (a,b)=>
          (b.finishedDate||"")
          .localeCompare(
            a.finishedDate||""
          )
      );

  const recent =
    [...state.books]
      .filter(
        b=>
          b.status==="finished"
      )
      .sort(
        (a,b)=>
          (b.finishedDate||"")
          .localeCompare(
            a.finishedDate||""
          )
      )
      .slice(
        0,
        8
      );

  const goal =
    Number(
      state.settings.readingGoal
    ) || 30;

  const pct =
    Math.min(
      100,
      Math.round(
        (s.finished/goal)*100
      )
    );

  const monthPages =
    monthBooks.reduce(
      (sum,b)=>
        sum +
        (Number(b.pages)||0),
      0
    );

  const monthRated =
    monthBooks.filter(
      b=>
        Number(b.rating)>0
    );

  const monthAvg =
    monthRated.length
      ? (
          monthRated.reduce(
            (sum,b)=>
              sum+
              Number(b.rating),
            0
          ) /
          monthRated.length
        ).toFixed(1)
      : "—";

  const favorite =
    bestRated(
      monthBooks
    );

  app.innerHTML = `
    <section class="home-journal">

      <div
        class="spiral-strip"
        aria-hidden="true"
      >
        ${"◉".repeat(18)}
      </div>

      <div class="journal-paper">

        <div class="journal-heading">

          <p class="journal-kicker">
            MY READING CORNER · ${year}
          </p>

          <h2>
            ${monthName}
            <br/>
            <em>Recap</em>
          </h2>

          <span class="journal-star">
            ✦
          </span>

        </div>

        <div class="journal-notes">

          <p>
            <span>Read:</span>
            ${monthBooks.length}
            books
          </p>

          <p>
            <span>Pages:</span>
            ${monthPages.toLocaleString("tr-TR")}
          </p>

          <p>
            <span>Average:</span>
            ${monthAvg}
            ${
              monthAvg!=="—"
                ? " ★"
                : ""
            }
          </p>

          <p>
            <span>Currently:</span>
            ${
              reading.length
                ? esc(
                    reading[0].title
                  )
                : "—"
            }
          </p>

        </div>

        <div class="goal-note">

          <span class="tape"></span>

          <small>
            ${year}
            READING GOAL
          </small>

          <strong>
            ${s.finished}
            /
            ${goal}
          </strong>

          <div class="progress">
            <span
              style="width:${pct}%"
            ></span>
          </div>

          <button
            class="paper-link"
            id="goalBtn"
          >
            hedefi değiştir ✎
          </button>

        </div>

        <div class="receipt-card">

          <div class="receipt-pin">
            ⌇
          </div>

          <p class="receipt-logo">
            STATS.FM
          </p>

          <div class="receipt-row">
            <span>MONTH</span>
            <b>
              ${monthName.toUpperCase()}
            </b>
          </div>

          <div class="receipt-row">
            <span>BOOKS READ</span>
            <b>
              ${monthBooks.length}
            </b>
          </div>

          <div class="receipt-row">
            <span>PAGES</span>
            <b>
              ${monthPages}
            </b>
          </div>

          <div class="receipt-row">
            <span>AVG RATING</span>
            <b>
              ${monthAvg}
            </b>
          </div>

          <div class="receipt-row">
            <span>YEAR TOTAL</span>
            <b>
              ${s.finished}
            </b>
          </div>

          <div class="receipt-dash"></div>

          <p class="receipt-fav">
            FAVORITE
            <br/>

            <b>
              ${
                favorite
                  ? esc(
                      favorite.title
                    )
                  : "not chosen yet"
              }
            </b>
          </p>

          <p class="receipt-footer">
            CARDHOLDER:
            BOOK LOVER ♡
          </p>

        </div>

        <div class="cover-collage">

          ${
            (
              monthBooks.length
                ? monthBooks
                : recent
            )
            .slice(0,7)
            .map(
              (b,i)=>`
                <button
                  class="
                    collage-book
                    collage-${(i%7)+1}
                  "
                  data-id="${b.id}"
                  data-action="open-book"
                >

                  ${
                    b.cover
                      ? `
                        <img
                          src="${esc(b.cover)}"
                          alt="${esc(b.title)}"
                        >
                      `
                      : `
                        <span class="collage-placeholder">
                          BOOK
                        </span>
                      `
                  }

                  <span>
                    ${
                      Number(b.rating)>0
                        ? `${Math.round(Number(b.rating))}☆`
                        : ""
                    }
                  </span>

                </button>
              `
            )
            .join("")
          }

        </div>

        <div class="
          journal-doodle
          doodle-one
        ">
          ✧
        </div>

        <div class="
          journal-doodle
          doodle-two
        ">
          ♡
        </div>

      </div>

    </section>

    <section
      class="
        section-card
        scrapbook-section
      "
    >

      <div class="section-head">

        <div>

          <p class="mini-label">
            on my nightstand
          </p>

          <h2>
            Currently Reading
          </h2>

        </div>

        <a
          class="soft-btn"
          href="#library"
        >
          Tüm kitaplar
        </a>

      </div>

      ${
        reading.length
          ? bookGridHTML(reading)
          : emptyHTML(
              "📖",
              "Henüz okuduğun bir kitap yok.",
              "İlk kitabını ekleyip durumunu “Okuyorum” seçebilirsin.",
              "#add-book"
            )
      }

    </section>

    <section
      class="
        section-card
        scrapbook-section
      "
    >

      <div class="section-head">

        <div>

          <p class="mini-label">
            tiny memories
          </p>

          <h2>
            Recently Finished
          </h2>

        </div>

        <a
          class="soft-btn"
          href="#add-book"
        >
          ＋ Add Book
        </a>

      </div>

      ${
        recent.length
          ? bookGridHTML(recent)
          : emptyHTML(
              "✿",
              "Henüz biten kitap yok.",
              "Bitirdiğin kitaplar burada görünecek.",
              "#add-book"
            )
      }

    </section>
  `;

  app
    .querySelector("#goalBtn")
    .onclick =
    async ()=>{

      const v =
        prompt(
          "Yıllık kitap hedefin kaç?",
          goal
        );

      if(!v){
        return;
      }

      const n =
        Math.max(
          1,
          Number(v)||goal
        );

      state.settings.readingGoal =
        n;

      await saveJournal(
        "Okuma hedefi kaydedildi"
      );

      render();
    };

  bindBookCards(app);
}

/* =================================================
   BOOK CARDS
================================================= */

function bookGridHTML(books){

  return `
    <div class="book-grid">
      ${
        books
          .map(bookCardHTML)
          .join("")
      }
    </div>
  `;
}

function bookCardHTML(b){

  const stars =
    Number(b.rating)>0
      ? `${
          "★".repeat(
            Math.round(
              Number(b.rating)
            )
          )
        } ${Number(b.rating).toFixed(1)}`
      : "Henüz puan yok";

  return `
    <article
      class="book-card"
      data-id="${b.id}"
    >

      <button
        class="book-cover-wrap"
        data-action="open-book"
      >

        ${
          b.cover
            ? `
              <img
                class="book-cover"
                src="${esc(b.cover)}"
                alt="${esc(b.title)} kapağı"
              >
            `
            : `
              <span class="cover-placeholder">
                BOOK
              </span>
            `
        }

      </button>

      <div class="book-card-body">

        <div class="book-card-top">

          <span class="status-pill">
            ${
              STATUS_LABELS[
                b.status
              ] || "Kitap"
            }
          </span>

          <button
            class="
              heart-btn
              ${
                b.favorite
                  ? "active"
                  : ""
              }
            "
            data-action="favorite"
          >
            ${
              b.favorite
                ? "♥"
                : "♡"
            }
          </button>

        </div>

        <h3 class="book-title">
          ${esc(b.title)}
        </h3>

        <p class="book-author">
          ${esc(b.author||"")}
        </p>

        <div class="rating-line">
          ${stars}
        </div>

      </div>

    </article>
  `;
}

function bindBookCards(
  scope=document
){

  scope
    .querySelectorAll(
      "[data-action='open-book']"
    )
    .forEach(
      btn=>
        btn.addEventListener(
          "click",
          ()=>{
            location.hash =
              `#book/${
                btn
                  .closest("[data-id]")
                  .dataset.id
              }`;
          }
        )
    );

  scope
    .querySelectorAll(
      "[data-action='favorite']"
    )
    .forEach(
      btn=>
        btn.addEventListener(
          "click",
          async ()=>{

            const b =
              state.books.find(
                x=>
                  x.id===
                  btn
                    .closest("[data-id]")
                    .dataset.id
              );

            if(!b){
              return;
            }

            b.favorite =
              !b.favorite;

            try{

              await updateBook(b);

              toast(
                "Favoriler güncellendi"
              );

              render();

            }catch(e){

              b.favorite =
                !b.favorite;

              toast(
                e.message,
                true
              );

            }

          }
        )
    );
}

/* =================================================
   LIBRARY
================================================= */

function renderLibrary(app){

  app.innerHTML = `
    <section class="section-card">

      <div class="toolbar">

        <input
          id="searchBooks"
          placeholder="Kitap veya yazar ara…"
        >

        <select id="statusFilter">

          <option value="all">
            Tüm durumlar
          </option>

          <option value="reading">
            Okuyorum
          </option>

          <option value="finished">
            Okudum
          </option>

          <option value="tbr">
            Okuyacağım
          </option>

          <option value="paused">
            Ara verdim
          </option>

          <option value="dnf">
            Yarım bıraktım
          </option>

          <option value="favorite">
            Favoriler
          </option>

        </select>

        <select id="sortBooks">

          <option value="newest">
            En yeni eklenen
          </option>

          <option value="title">
            Kitap adına göre
          </option>

          <option value="rating">
            Puana göre
          </option>

        </select>

        <a
          class="primary-btn"
          href="#add-book"
        >
          ＋ Add Book
        </a>

      </div>

      <div id="libraryResults"></div>

    </section>
  `;

  const search =
    app.querySelector(
      "#searchBooks"
    );

  const status =
    app.querySelector(
      "#statusFilter"
    );

  const sort =
    app.querySelector(
      "#sortBooks"
    );

  function refresh(){

    const q =
      search.value
        .trim()
        .toLowerCase();

    let books =
      state.books.filter(
        b=>
          (
            !q ||
            `${b.title} ${b.author}`
              .toLowerCase()
              .includes(q)
          ) &&
          (
            status.value==="all" ||
            (
              status.value==="favorite"
                ? b.favorite
                : b.status===status.value
            )
          )
      );

    if(
      sort.value==="title"
    ){

      books.sort(
        (a,b)=>
          a.title.localeCompare(
            b.title,
            "tr"
          )
      );

    }

    if(
      sort.value==="rating"
    ){

      books.sort(
        (a,b)=>
          (Number(b.rating)||0) -
          (Number(a.rating)||0)
      );

    }

    if(
      sort.value==="newest"
    ){

      books.sort(
        (a,b)=>
          new Date(
            b.createdAt||0
          ) -
          new Date(
            a.createdAt||0
          )
      );

    }

    const out =
      app.querySelector(
        "#libraryResults"
      );

    out.innerHTML =
      books.length
        ? bookGridHTML(
            books
          )
        : emptyHTML(
            "📚",
            "Burada kitap yok.",
            "Filtreyi değiştir veya yeni bir kitap ekle.",
            "#add-book"
          );

    bindBookCards(out);
  }

  [
    search,
    status,
    sort
  ].forEach(
    el=>
      el.addEventListener(
        "input",
        refresh
      )
  );

  refresh();
}

/* =================================================
   WISH LIST
================================================= */

function renderWishList(app){

  const books =
    [...state.books]
      .filter(
        b=>
          b.status==="tbr"
      )
      .sort(
        (a,b)=>
          new Date(
            b.createdAt||0
          ) -
          new Date(
            a.createdAt||0
          )
      );

  app.innerHTML = `
    <section class="wishlist-page">

      <div class="wishlist-paper">

        <div class="wishlist-topline">
          <span>Leitura</span>
          <span>
            ${new Date().getFullYear()}
          </span>
          <span>Books</span>
        </div>

        <div class="wishlist-title">

          <span class="wish-script">
            Wish
          </span>

          <span class="wish-serif">
            List
          </span>

          <small>
            version: books
          </small>

        </div>

        <div class="wishlist-basket">

          <div class="basket-back"></div>

          <div class="basket-grid"></div>

          <div class="basket-books">

            ${
              books
                .slice(0,6)
                .map(
                  (b,i)=>`
                    <button
                      class="
                        basket-book
                        basket-book-${i+1}
                      "
                      data-id="${b.id}"
                      data-action="open-book"
                    >

                      <span class="basket-number">
                        ${
                          String(i+1)
                            .padStart(
                              2,
                              "0"
                            )
                        }
                      </span>

                      ${
                        b.cover
                          ? `
                            <img
                              src="${esc(b.cover)}"
                              alt="${esc(b.title)}"
                            >
                          `
                          : `
                            <span class="basket-placeholder">
                              BOOK
                            </span>
                          `
                      }

                    </button>
                  `
                )
                .join("")
            }

          </div>

        </div>

        <div class="wishlist-caption">

          ${
            books.length
              ? books
                  .slice(0,6)
                  .map(
                    (b,i)=>`
                      ${
                        String(i+1)
                          .padStart(
                            2,
                            "0"
                          )
                      }:
                      ${esc(b.title)}
                      ${
                        b.author
                          ? ` — ${esc(b.author)}`
                          : ""
                      }
                    `
                  )
                  .join(" · ")
              : `
                Henüz wish list'te
                kitap yok.
                Add Book sayfasından
                kitabı ekleyip
                durumunu “Okuyacağım”
                seçebilirsin.
              `
          }

        </div>

        <div class="wishlist-actions">

          <a
            class="primary-btn"
            href="#add-book"
          >
            ＋ Wish List'e kitap ekle
          </a>

          <a
            class="soft-btn"
            href="#library"
          >
            Tüm kitaplar
          </a>

        </div>

      </div>

    </section>

    ${
      books.length>6
        ? `
          <section
            class="
              section-card
              scrapbook-section
            "
          >

            <div class="section-head">

              <div>

                <p class="mini-label">
                  more wishes
                </p>

                <h2>
                  More on my list
                </h2>

              </div>

              <span class="tag">
                ${books.length}
                books
              </span>

            </div>

            ${
              bookGridHTML(
                books.slice(6)
              )
            }

          </section>
        `
        : ""
    }
  `;

  bindBookCards(app);
}

/* =================================================
   FINISHED BOOKS
================================================= */

function renderFinishedBooks(app){

  const books =
    [...state.books]
      .filter(
        b=>
          b.status==="finished"
      )
      .sort(
        (a,b)=>
          (b.finishedDate||"")
          .localeCompare(
            a.finishedDate||""
          )
      );

  app.innerHTML = `
    <section class="finished-sky-page">

      <div class="finished-sky">

        <div class="
          sky-cloud
          cloud-a
        "></div>

        <div class="
          sky-cloud
          cloud-b
        "></div>

        <div class="
          sky-cloud
          cloud-c
        "></div>

        <div class="finished-title">
          the books i
          <br/>
          finished
        </div>

        <div class="
          sky-sticker
          sticker-star
        ">
          ☆
        </div>

        <div class="
          sky-sticker
          sticker-butterfly
        ">
          🦋
        </div>

        <div class="
          clothesline
          line-one
        ">

          <div class="rope"></div>

          ${
            books
              .slice(0,5)
              .map(
                (b,i)=>`
                  <button
                    class="
                      hanging-book
                      hang-${i+1}
                    "
                    data-id="${b.id}"
                    data-action="open-book"
                  >

                    <span class="peg"></span>

                    ${
                      b.cover
                        ? `
                          <img
                            src="${esc(b.cover)}"
                            alt="${esc(b.title)}"
                          >
                        `
                        : `
                          <span class="hanging-placeholder">
                            BOOK
                          </span>
                        `
                    }

                  </button>
                `
              )
              .join("")
          }

        </div>

        <div class="
          hill
          hill-back
        "></div>

        <div class="
          hill
          hill-front
        "></div>

        <div class="
          clothesline
          line-two
        ">

          <div class="rope"></div>

          ${
            books
              .slice(5,10)
              .map(
                (b,i)=>`
                  <button
                    class="
                      hanging-book
                      hang-${i+1}
                    "
                    data-id="${b.id}"
                    data-action="open-book"
                  >

                    <span class="peg"></span>

                    ${
                      b.cover
                        ? `
                          <img
                            src="${esc(b.cover)}"
                            alt="${esc(b.title)}"
                          >
                        `
                        : `
                          <span class="hanging-placeholder">
                            BOOK
                          </span>
                        `
                    }

                  </button>
                `
              )
              .join("")
          }

        </div>

        ${
          !books.length
            ? `
              <div class="finished-empty">

                <h3>
                  Henüz biten kitap yok ♡
                </h3>

                <p>
                  Durumunu “Okudum”
                  yaptığın kitaplar
                  burada ipe asılmış
                  gibi görünecek.
                </p>

                <a
                  class="primary-btn"
                  href="#add-book"
                >
                  ＋ Add Book
                </a>

              </div>
            `
            : ""
        }

      </div>

    </section>

    ${
      books.length>10
        ? `
          <section
            class="
              section-card
              scrapbook-section
            "
          >

            <div class="section-head">

              <div>

                <p class="mini-label">
                  more finished books
                </p>

                <h2>
                  Reading archive
                </h2>

              </div>

              <span class="tag">
                ${books.length}
                books
              </span>

            </div>

            ${
              bookGridHTML(
                books.slice(10)
              )
            }

          </section>
        `
        : ""
    }
  `;

  bindBookCards(app);
}

/* =================================================
   ADD BOOK
================================================= */

function renderAddBook(app){

  app.innerHTML = `
    <section class="section-card">

      <div class="section-head">

        <div>

          <p class="mini-label">
            new memory
          </p>

          <h2>
            Yeni kitap ekle
          </h2>

        </div>

      </div>

      <form id="bookForm">

        <div class="form-grid">

          ${coverPickerHTML()}

          ${
            formGroup(
              "Kitap adı",
              "title",
              "text",
              true
            )
          }

          ${
            formGroup(
              "Yazar",
              "author",
              "text",
              true
            )
          }

          ${
            formGroup(
              "Tür",
              "genre",
              "text",
              false,
              "Roman, klasik, fantastik..."
            )
          }

          ${
            formGroup(
              "Sayfa sayısı",
              "pages",
              "number"
            )
          }

          ${
            formGroup(
              "Yayın yılı",
              "publishYear",
              "number"
            )
          }

          <div class="form-group">

            <label>
              Durum
            </label>

            <select name="status">

              <option value="tbr">
                Okuyacağım
              </option>

              <option value="reading">
                Okuyorum
              </option>

              <option value="finished">
                Okudum
              </option>

              <option value="paused">
                Ara verdim
              </option>

              <option value="dnf">
                Yarım bıraktım
              </option>

            </select>

          </div>

          ${
            formGroup(
              "Başlama tarihi",
              "startDate",
              "date"
            )
          }

          ${
            formGroup(
              "Bitirme tarihi",
              "finishedDate",
              "date"
            )
          }

          ${
            formGroup(
              "Genel puan (0-5)",
              "rating",
              "number",
              false,
              "4.5",
              'step="0.1" min="0" max="5"'
            )
          }

          <div class="
            form-group
            full
          ">

            <label>
              Kısa ilk not
            </label>

            <textarea
              name="review"
              placeholder="Bu kitap hakkında ilk düşüncen…"
            ></textarea>

          </div>

        </div>

        <div class="form-actions">

          <button
            class="primary-btn"
            type="submit"
            id="saveBookBtn"
          >
            Kitabı buluta kaydet ♡
          </button>

          <span
            class="save-status"
            id="saveStatus"
          >
            ☁ yükleniyor…
          </span>

          <a
            class="soft-btn"
            href="#library"
          >
            Vazgeç
          </a>

        </div>

      </form>

    </section>
  `;

  bindCoverPreview(app);

  app
    .querySelector("#bookForm")
    .addEventListener(
      "submit",
      async e=>{

        e.preventDefault();

        const fd =
          new FormData(
            e.currentTarget
          );

        const btn =
          app.querySelector(
            "#saveBookBtn"
          );

        const statusEl =
          app.querySelector(
            "#saveStatus"
          );

        const bookId =
          uuid();

        const file =
          app.querySelector(
            "#coverFile"
          ).files[0];

        btn.disabled =
          true;

        statusEl
          .classList
          .add("show");

        let uploaded = {
          url:"",
          path:""
        };

        try{

          if(file){

            statusEl.textContent =
              "☁ kapak yükleniyor…";

            uploaded =
              await uploadCover(
                file,
                bookId
              );

          }

          statusEl.textContent =
            "☁ kitap kaydediliyor…";

          const book = {

            id:bookId,

            createdAt:
              new Date()
              .toISOString(),

            title:
              String(
                fd.get("title")
              ).trim(),

            author:
              String(
                fd.get("author")
              ).trim(),

            cover:
              uploaded.url,

            coverPath:
              uploaded.path,

            genre:
              String(
                fd.get("genre")||""
              ).trim(),

            pages:
              Number(
                fd.get("pages")
              ) || 0,

            publishYear:
              fd.get(
                "publishYear"
              ),

            status:
              fd.get("status"),

            startDate:
              fd.get(
                "startDate"
              ),

            finishedDate:
              fd.get(
                "finishedDate"
              ),

            rating:
              Number(
                fd.get("rating")
              ) || 0,

            favorite:false,

            review:
              String(
                fd.get("review")||""
              ).trim(),

            ratings:{
              story:0,
              characters:0,
              writing:0,
              pacing:0,
              ending:0,
              emotion:0
            },

            favoriteCharacter:"",
            favoriteScene:"",
            disliked:"",
            reread:"",
            recommend:"",
            quotes:[],
            tags:[]
          };

          const saved =
            await insertBook(book);

          state.books.unshift(
            saved
          );

          toast(
            "Kitap ve kapağı buluta kaydedildi ♡"
          );

          location.hash =
            `#book/${saved.id}`;

        }catch(err){

          if(uploaded.path){

            await removeCover(
              uploaded.path
            );

          }

          btn.disabled =
            false;

          statusEl.textContent =
            "⚠ " + err.message;

          statusEl
            .classList
            .add("error");

          toast(
            err.message,
            true
          );

        }

      }
    );
}

/* =================================================
   COVER PICKER
================================================= */

function coverPickerHTML(
  current=""
){

  return `
    <div class="cover-upload-card">

      <div
        class="cover-preview"
        id="coverPreview"
      >

        ${
          current
            ? `
              <img
                src="${esc(current)}"
                alt="Mevcut kapak"
              >
            `
            : `
              <span>
                BOOK
                <br/>
                COVER
              </span>
            `
        }

      </div>

      <div class="cover-upload-copy">

        <h3>
          Kitap kapağı
        </h3>

        <p>
          Bilgisayarından veya
          telefonundan JPG,
          PNG ya da WEBP kapak seç.
          En fazla 5 MB.
        </p>

        <label class="file-picker">

          ＋ Kapak seç

          <input
            type="file"
            id="coverFile"
            accept="
              image/jpeg,
              image/png,
              image/webp
            "
          >

        </label>

        <div
          class="upload-meta"
          id="coverMeta"
        >

          ${
            current
              ? "Yeni bir dosya seçmezsen mevcut kapak kalır."
              : "Henüz kapak seçilmedi."
          }

        </div>

      </div>

    </div>
  `;
}

function bindCoverPreview(scope){

  const input =
    scope.querySelector(
      "#coverFile"
    );

  const preview =
    scope.querySelector(
      "#coverPreview"
    );

  const meta =
    scope.querySelector(
      "#coverMeta"
    );

  if(!input){
    return;
  }

  input.addEventListener(
    "change",
    ()=>{

      const file =
        input.files[0];

      if(!file){
        return;
      }

      if(
        file.size >
        5*1024*1024
      ){

        input.value="";

        return toast(
          "Kapak en fazla 5 MB olabilir.",
          true
        );
      }

      const url =
        URL.createObjectURL(
          file
        );

      preview.innerHTML = `
        <img
          src="${url}"
          alt="Kapak önizleme"
        >
      `;

      meta.textContent =
        `${
          file.name
        } · ${
          (
            file.size /
            1024 /
            1024
          ).toFixed(2)
        } MB`;

    }
  );
}

function formGroup(
  label,
  name,
  type="text",
  required=false,
  placeholder="",
  extra=""
){

  return `
    <div class="form-group">

      <label>
        ${label}
      </label>

      <input
        name="${name}"
        type="${type}"
        ${
          required
            ? "required"
            : ""
        }
        placeholder="${placeholder}"
        ${extra}
      >

    </div>
  `;
}

/* =================================================
   BOOK DETAIL
================================================= */

function renderBookDetail(
  app,
  id
){

  const b =
    state.books.find(
      x=>x.id===id
    );

  if(!b){

    app.innerHTML =
      emptyHTML(
        "📕",
        "Kitap bulunamadı.",
        "Kitaplık sayfasına dönebilirsin.",
        "#library"
      );

    return;
  }

  const R =
    b.ratings || {};

  const rating =
    Math.max(
      0,
      Math.min(
        5,
        Math.round(
          Number(b.rating)||0
        )
      )
    );

  const starLine =
    `${
      "★".repeat(rating)
    }${
      "☆".repeat(5-rating)
    }`;

  app.innerHTML = `
    <section class="book-journal-page">

      <div
        class="book-spiral"
        aria-hidden="true"
      >
        ${"◉".repeat(22)}
      </div>

      <div class="book-journal-inner">

        <aside class="journal-cover-column">

          <div class="journal-cover-frame">

            ${
              b.cover
                ? `
                  <img
                    src="${esc(b.cover)}"
                    alt="${esc(b.title)} kapağı"
                  >
                `
                : `
                  <div class="journal-no-cover">
                    BOOK
                    <br/>
                    COVER
                  </div>
                `
            }

          </div>

          <div class="mini-sticker">
            ${
              STATUS_LABELS[
                b.status
              ] || "BOOK"
            }
            ✦
          </div>

          <button
            class="soft-btn"
            id="toggleFav"
          >
            ${
              b.favorite
                ? "♥ Favorilerden çıkar"
                : "♡ Favorilere ekle"
            }
          </button>

        </aside>

        <div class="journal-info-column">

          <div class="journal-field">

            <b>AUTHOR :</b>

            <span>
              ${esc(b.author||"—")}
            </span>

          </div>

          <div class="journal-field">

            <b>TITLE :</b>

            <span>
              ${esc(b.title)}
            </span>

          </div>

          <div class="journal-field">

            <b>GENRE :</b>

            <span>
              ${esc(b.genre||"—")}
            </span>

          </div>

          <div class="
            journal-field
            rating-field
          ">

            <b>
              MY RATING :
            </b>

            <span class="big-stars">
              ${starLine}
            </span>

            <small>
              ${
                Number(
                  b.rating||0
                ).toFixed(1)
              }
              / 5
            </small>

          </div>

          <div class="journal-meta-line">

            ${
              b.pages
                ? `
                  <span>
                    ${b.pages} pages
                  </span>
                `
                : ""
            }

            ${
              b.publishYear
                ? `
                  <span>
                    ${esc(b.publishYear)}
                  </span>
                `
                : ""
            }

            ${
              b.finishedDate
                ? `
                  <span>
                    ${esc(b.finishedDate)}
                  </span>
                `
                : ""
            }

          </div>

        </div>

        <section class="journal-review-block">

          <div class="journal-block-title">

            <h3>
              IN A FEW WORDS
            </h3>

            <button
              class="paper-link"
              id="editBookBtn"
            >
              edit ✎
            </button>

          </div>

          <p>
            ${
              b.review
                ? esc(b.review)
                : "Henüz yorum eklenmedi."
            }
          </p>

        </section>

        <section class="journal-score-block">

          <h3>
            MY NOTES
          </h3>

          <div class="journal-score-grid">

            ${
              scoreCard(
                "Konu",
                R.story
              )
            }

            ${
              scoreCard(
                "Karakterler",
                R.characters
              )
            }

            ${
              scoreCard(
                "Yazım dili",
                R.writing
              )
            }

            ${
              scoreCard(
                "Akıcılık",
                R.pacing
              )
            }

            ${
              scoreCard(
                "Final",
                R.ending
              )
            }

            ${
              scoreCard(
                "Hissettirdikleri",
                R.emotion
              )
            }

          </div>

        </section>

        <section class="journal-prompts">

          <div>

            <b>
              favorite character
            </b>

            <p>
              ${
                esc(
                  b.favoriteCharacter ||
                  "—"
                )
              }
            </p>

          </div>

          <div>

            <b>
              favorite scene
            </b>

            <p>
              ${
                esc(
                  b.favoriteScene ||
                  "—"
                )
              }
            </p>

          </div>

          <div>

            <b>
              not for me
            </b>

            <p>
              ${
                esc(
                  b.disliked ||
                  "—"
                )
              }
            </p>

          </div>

          <div>

            <b>
              reread?
            </b>

            <p>
              ${
                esc(
                  b.reread ||
                  "—"
                )
              }
            </p>

          </div>

        </section>

        <section class="journal-quotes">

          <div class="journal-block-title">

            <h3>
              QUOTES
            </h3>

            <button
              class="paper-link"
              id="addQuoteBtn"
            >
              ＋ add quote
            </button>

          </div>

          ${
            (b.quotes||[]).length
              ? b.quotes
                  .map(
                    q=>`
                      <blockquote>
                        “${esc(q.text)}”

                        ${
                          q.page
                            ? `
                              <small>
                                — s.
                                ${esc(q.page)}
                              </small>
                            `
                            : ""
                        }

                      </blockquote>
                    `
                  )
                  .join("")
              : `
                <p class="muted">
                  Henüz alıntı eklenmedi.
                </p>
              `
          }

        </section>

        <div class="journal-footer-actions">

          <a
            class="soft-btn"
            href="#library"
          >
            ← Kitaplığa dön
          </a>

          <button
            class="danger-btn"
            id="deleteBookBtn"
          >
            Kitabı sil
          </button>

        </div>

      </div>

    </section>
  `;

  app
    .querySelector("#toggleFav")
    .onclick =
    async ()=>{

      b.favorite =
        !b.favorite;

      try{

        await updateBook(b);

        toast(
          "Favoriler güncellendi"
        );

        render();

      }catch(e){

        b.favorite =
          !b.favorite;

        toast(
          e.message,
          true
        );

      }

    };

  app
    .querySelector("#addQuoteBtn")
    .onclick =
    async ()=>{

      const text =
        prompt(
          "Alıntıyı yaz:"
        );

      if(!text){
        return;
      }

      const page =
        prompt(
          "Sayfa numarası (isteğe bağlı):"
        ) || "";

      b.quotes =
        b.quotes || [];

      b.quotes.push({
        text,
        page
      });

      try{

        await updateBook(b);

        toast(
          "Alıntı buluta kaydedildi"
        );

        render();

      }catch(e){

        b.quotes.pop();

        toast(
          e.message,
          true
        );

      }

    };

  app
    .querySelector("#editBookBtn")
    .onclick =
    ()=>{
      renderBookEdit(
        app,
        b
      );
    };

  app
    .querySelector("#deleteBookBtn")
    .onclick =
    async ()=>{

      if(
        !confirm(
          `“${b.title}” silinsin mi?`
        )
      ){
        return;
      }

      setCloudBusy(true);

      const {
        error
      } =
        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            b.id
          );

      setCloudBusy(false);

      if(error){

        return toast(
          error.message,
          true
        );
      }

      await removeCover(
        b.coverPath
      );

      state.books =
        state.books.filter(
          x=>x.id!==b.id
        );

      state.bestBook.nominees =
        state.bestBook.nominees
          .filter(
            x=>x!==b.id
          );

      if(
        state.bestBook.winnerId===
        b.id
      ){
        state.bestBook.winnerId =
          null;
      }

      await saveJournal();

      toast(
        "Kitap silindi"
      );

      location.hash =
        "#library";
    };
}

function scoreCard(
  label,
  value
){

  const v =
    Number(value)||0;

  return `
    <div class="score-card">

      <span>
        ${label}
      </span>

      <b>
        ${v.toFixed(1)}
        / 5
      </b>

    </div>
  `;
}

/* =================================================
   EDIT BOOK
================================================= */

function renderBookEdit(
  app,
  b
){

  const R =
    b.ratings || {};

  app.innerHTML = `
    <section class="section-card">

      <div class="section-head">

        <div>

          <p class="mini-label">
            edit review
          </p>

          <h2>
            ${esc(b.title)}
          </h2>

        </div>

      </div>

      <form id="editBookForm">

        <div class="form-grid">

          ${
            coverPickerHTML(
              b.cover
            )
          }

          ${
            editInput(
              "Kitap adı",
              "title",
              b.title,
              true
            )
          }

          ${
            editInput(
              "Yazar",
              "author",
              b.author,
              true
            )
          }

          ${
            editInput(
              "Tür",
              "genre",
              b.genre
            )
          }

          ${
            editInput(
              "Sayfa sayısı",
              "pages",
              b.pages,
              false,
              "number"
            )
          }

          ${
            editInput(
              "Genel puan",
              "rating",
              b.rating,
              false,
              "number",
              'step="0.1" min="0" max="5"'
            )
          }

          <div class="form-group">

            <label>
              Durum
            </label>

            <select name="status">

              ${
                Object.entries(
                  STATUS_LABELS
                )
                .map(
                  ([k,v])=>`
                    <option
                      value="${k}"
                      ${
                        b.status===k
                          ? "selected"
                          : ""
                      }
                    >
                      ${v}
                    </option>
                  `
                )
                .join("")
              }

            </select>

          </div>

          ${
            editInput(
              "Başlama tarihi",
              "startDate",
              b.startDate,
              false,
              "date"
            )
          }

          ${
            editInput(
              "Bitirme tarihi",
              "finishedDate",
              b.finishedDate,
              false,
              "date"
            )
          }

          ${
            ratingInput(
              "Konu",
              "story",
              R.story
            )
          }

          ${
            ratingInput(
              "Karakterler",
              "characters",
              R.characters
            )
          }

          ${
            ratingInput(
              "Yazım dili",
              "writing",
              R.writing
            )
          }

          ${
            ratingInput(
              "Akıcılık",
              "pacing",
              R.pacing
            )
          }

          ${
            ratingInput(
              "Final",
              "ending",
              R.ending
            )
          }

          ${
            ratingInput(
              "Hissettirdikleri",
              "emotion",
              R.emotion
            )
          }

          <div class="
            form-group
            full
          ">

            <label>
              Genel yorumum
            </label>

            <textarea name="review">
${esc(b.review||"")}</textarea>

          </div>

          <div class="form-group">

            <label>
              En sevdiğim karakter
            </label>

            <input
              name="favoriteCharacter"
              value="${esc(b.favoriteCharacter||"")}"
            >

          </div>

          <div class="form-group">

            <label>
              En sevdiğim sahne / bölüm
            </label>

            <input
              name="favoriteScene"
              value="${esc(b.favoriteScene||"")}"
            >

          </div>

          <div class="form-group">

            <label>
              Sevmediğim kısım
            </label>

            <input
              name="disliked"
              value="${esc(b.disliked||"")}"
            >

          </div>

          <div class="form-group">

            <label>
              Tekrar okur muyum?
            </label>

            <input
              name="reread"
              value="${esc(b.reread||"")}"
              placeholder="Evet / Hayır / Belki"
            >

          </div>

        </div>

        <div class="form-actions">

          <button
            class="primary-btn"
            id="editSaveBtn"
          >
            Kaydet
          </button>

          <span
            class="save-status"
            id="saveStatus"
          >
            ☁ kaydediliyor…
          </span>

          <button
            type="button"
            class="soft-btn"
            id="cancelEdit"
          >
            Vazgeç
          </button>

        </div>

      </form>

    </section>
  `;

  bindCoverPreview(app);

  app
    .querySelector("#cancelEdit")
    .onclick =
    ()=>{
      renderBookDetail(
        app,
        b.id
      );
    };

  app
    .querySelector("#editBookForm")
    .onsubmit =
    async e=>{

      e.preventDefault();

      const fd =
        new FormData(
          e.currentTarget
        );

      const file =
        app.querySelector(
          "#coverFile"
        ).files[0];

      const btn =
        app.querySelector(
          "#editSaveBtn"
        );

      const statusEl =
        app.querySelector(
          "#saveStatus"
        );

      btn.disabled =
        true;

      statusEl
        .classList
        .add("show");

      const oldCover = {
        url:b.cover,
        path:b.coverPath
      };

      let newCover =
        null;

      try{

        if(file){

          statusEl.textContent =
            "☁ yeni kapak yükleniyor…";

          newCover =
            await uploadCover(
              file,
              b.id
            );

          b.cover =
            newCover.url;

          b.coverPath =
            newCover.path;
        }

        [
          "title",
          "author",
          "genre",
          "status",
          "startDate",
          "finishedDate",
          "review",
          "favoriteCharacter",
          "favoriteScene",
          "disliked",
          "reread"
        ]
        .forEach(
          k=>
            b[k] =
              String(
                fd.get(k) || ""
              )
        );

        b.pages =
          Number(
            fd.get("pages")
          ) || 0;

        b.rating =
          Number(
            fd.get("rating")
          ) || 0;

        b.ratings = {

          story:
            +fd.get("story")||0,

          characters:
            +fd.get("characters")||0,

          writing:
            +fd.get("writing")||0,

          pacing:
            +fd.get("pacing")||0,

          ending:
            +fd.get("ending")||0,

          emotion:
            +fd.get("emotion")||0

        };

        await updateBook(b);

        if(
          newCover &&
          oldCover.path
        ){

          await removeCover(
            oldCover.path
          );

        }

        toast(
          "Kitap güncellendi ♡"
        );

        renderBookDetail(
          app,
          b.id
        );

      }catch(err){

        if(
          newCover?.path
        ){

          await removeCover(
            newCover.path
          );

          b.cover =
            oldCover.url;

          b.coverPath =
            oldCover.path;
        }

        btn.disabled =
          false;

        statusEl.textContent =
          "⚠ " + err.message;

        statusEl
          .classList
          .add("error");

        toast(
          err.message,
          true
        );

      }

    };
}

function editInput(
  label,
  name,
  value,
  required=false,
  type="text",
  extra=""
){

  return `
    <div class="form-group">

      <label>
        ${label}
      </label>

      <input
        type="${type}"
        name="${name}"
        value="${esc(value??"")}"
        ${
          required
            ? "required"
            : ""
        }
        ${extra}
      >

    </div>
  `;
}

function ratingInput(
  label,
  name,
  value
){

  return `
    <div class="form-group">

      <label>
        ${label}
      </label>

      <input
        type="number"
        name="${name}"
        value="${
          Number(value)||0
        }"
        min="0"
        max="5"
        step="0.1"
      >

    </div>
  `;
}

/* =================================================
   BOOKSHELF
================================================= */

function renderBookshelf(app){

  const books =
    [...state.books];

  if(!books.length){

    app.innerHTML =
      emptyHTML(
        "📚",
        "Rafın henüz boş.",
        "Kitap ekledikçe burada rafına yerleşecek.",
        "#add-book"
      );

    return;
  }

  const chunks = [];

  for(
    let i=0;
    i<books.length;
    i+=12
  ){

    chunks.push(
      books.slice(
        i,
        i+12
      )
    );

  }

  app.innerHTML = `
    <section class="section-card">

      <div class="section-head">

        <div>

          <p class="mini-label">
            my little shelf
          </p>

          <h2>
            Bookshelf
          </h2>

        </div>

      </div>

      <div class="shelf">

        ${
          chunks.map(
            row=>`
              <div class="shelf-row">

                ${
                  row.map(
                    b=>`
                      <button
                        class="spine"
                        data-book-id="${b.id}"
                      >
                        ${esc(b.title)}
                      </button>
                    `
                  )
                  .join("")
                }

              </div>
            `
          )
          .join("")
        }

      </div>

    </section>
  `;

  app
    .querySelectorAll(
      "[data-book-id]"
    )
    .forEach(
      btn=>{

        btn.addEventListener(
          "click",
          ()=>{
            location.hash =
              `#book/${
                btn.dataset.bookId
              }`;
          }
        );

      }
    );
}

/* =================================================
   TRACKER
================================================= */

function renderTracker(app){

  const now =
    new Date();

  const selectedKey =
    state.uiTrackerMonth ||
    `${now.getFullYear()}-${
      String(
        now.getMonth()+1
      ).padStart(2,"0")
    }`;

  const [
    year,
    month
  ] =
    selectedKey
      .split("-")
      .map(Number);

  const days =
    new Date(
      year,
      month,
      0
    ).getDate();

  const monthData =
    state.tracker[
      selectedKey
    ] || {};

  const totalPages =
    Object
      .values(monthData)
      .reduce(
        (a,d)=>
          a +
          (Number(d.pages)||0),
        0
      );

  const readingDays =
    Object
      .values(monthData)
      .filter(
        d=>
          Number(d.pages)>0
      ).length;

  const level =
    pages=>{

      pages =
        Number(pages)||0;

      if(!pages){
        return "none";
      }

      if(pages<=10){
        return "l1";
      }

      if(pages<=20){
        return "l2";
      }

      if(pages<=40){
        return "l3";
      }

      if(pages<=70){
        return "l4";
      }

      return "l5";
    };

  app.innerHTML = `
    <section class="tracker-journal-page">

      <div class="tracker-paper">

        <div class="tracker-page-head">

          <div>

            <p class="mini-label">
              monthly reading log
            </p>

            <h2>
              Reading Tracker
            </h2>

            <p>
              ${MONTHS[month-1]}
              ${year}
            </p>

          </div>

          <input
            type="month"
            id="trackerMonth"
            value="${selectedKey}"
            class="
              field
              tracker-month-input
            "
          >

        </div>

        <div
          class="reading-ring"
          style="--days:${days}"
        >

          <div class="ring-center">

            <div class="line-art-books">

              <div class="flower">
                ✿
              </div>

              <div class="jar">
                ╭─╮
                <br/>
                │ │
                <br/>
                ╰─╯
              </div>

              <div class="book-stack">
                ▰
                <br/>
                ▱
                <br/>
                ▰
              </div>

            </div>

            <strong>
              ${totalPages}
            </strong>

            <span>
              pages this month
            </span>

          </div>

          ${
            Array
              .from(
                {
                  length:days
                },
                (_,i)=>{

                  const d =
                    i+1;

                  const data =
                    monthData[d] || {};

                  const cls =
                    level(
                      data.pages
                    );

                  const angle =
                    (360/days)*i;

                  return `
                    <button
                      class="
                        ring-day
                        ${cls}
                      "
                      data-day="${d}"
                      style="
                        --i:${i};
                        --angle:${angle}deg
                      "
                    >

                      <span class="ring-day-num">
                        ${d}
                      </span>

                    </button>
                  `;
                }
              )
              .join("")
          }

        </div>

        <div class="tracker-key">

          <h3>
            Key:
          </h3>

          <span>
            <i class="
              key-box
              none
            "></i>
            None
          </span>

          <span>
            <i class="
              key-box
              l1
            "></i>
            0–10 pages
          </span>

          <span>
            <i class="
              key-box
              l2
            "></i>
            11–20 pages
          </span>

          <span>
            <i class="
              key-box
              l3
            "></i>
            21–40 pages
          </span>

          <span>
            <i class="
              key-box
              l4
            "></i>
            41–70 pages
          </span>

          <span>
            <i class="
              key-box
              l5
            "></i>
            70+ pages
          </span>

        </div>

        <div class="tracker-summary-strip">

          <div>

            <b>
              ${readingDays}
            </b>

            <span>
              reading days
            </span>

          </div>

          <div>

            <b>
              ${totalPages}
            </b>

            <span>
              pages
            </span>

          </div>

          <div>

            <b>
              ${
                readingDays
                  ? Math.round(
                      totalPages /
                      readingDays
                    )
                  : 0
              }
            </b>

            <span>
              daily avg.
            </span>

          </div>

        </div>

      </div>

      <div
        class="tracker-entry-sheet"
        id="trackerEntrySheet"
      >

        <div class="tracker-entry-empty">

          <span>
            ✎
          </span>

          <p>
            Halkadaki bir güne tıkla.
            <br/>
            O gün okuduğun sayfa
            ve notunu buradan ekleyebilirsin.
          </p>

        </div>

      </div>

    </section>
  `;

  app
    .querySelector("#trackerMonth")
    .addEventListener(
      "change",
      e=>{

        state.uiTrackerMonth =
          e.target.value;

        render();

      }
    );

  const sheet =
    app.querySelector(
      "#trackerEntrySheet"
    );

  app
    .querySelectorAll(
      ".ring-day"
    )
    .forEach(
      btn=>{

        btn.addEventListener(
          "click",
          ()=>{

            const day =
              btn.dataset.day;

            const data =
              (
                state.tracker[
                  selectedKey
                ] || {}
              )[day] ||
              {
                pages:0,
                note:""
              };

            sheet.innerHTML = `
              <div class="tracker-entry-card">

                <p class="mini-label">
                  ${
                    MONTHS[
                      month-1
                    ]
                  }
                  ${day}
                </p>

                <h3>
                  Day ${day}
                </h3>

                <label>

                  Pages

                  <input
                    id="trackerPages"
                    type="number"
                    min="0"
                    value="${
                      data.pages||""
                    }"
                    placeholder="0"
                  >

                </label>

                <label>

                  Mini note

                  <textarea
                    id="trackerNote"
                    placeholder="Bugün ne okudun?"
                  >${esc(data.note||"")}</textarea>

                </label>

                <button
                  class="primary-btn"
                  id="saveTrackerDay"
                >
                  save this day ♡
                </button>

              </div>
            `;

            sheet
              .querySelector(
                "#saveTrackerDay"
              )
              .onclick =
              async ()=>{

                state.tracker[
                  selectedKey
                ] =
                state.tracker[
                  selectedKey
                ] || {};

                state.tracker[
                  selectedKey
                ][day] = {

                  pages:
                    Number(
                      sheet
                        .querySelector(
                          "#trackerPages"
                        )
                        .value
                    ) || 0,

                  note:
                    sheet
                      .querySelector(
                        "#trackerNote"
                      )
                      .value
                };

                await saveJournal(
                  "Tracker buluta kaydedildi"
                );

                render();
              };

          }
        );

      }
    );
}

/* =================================================
   MONTH REVIEW
================================================= */

function renderMonthReview(app){

  const now =
    new Date();

  const selectedKey =
    state.uiReviewMonth ||
    `${now.getFullYear()}-${
      String(
        now.getMonth()+1
      ).padStart(2,"0")
    }`;

  const [
    year,
    month
  ] =
    selectedKey
      .split("-")
      .map(Number);

  const review =
    state.monthReviews[
      selectedKey
    ] || {};

  const monthBooks =
    state.books
      .filter(
        b=>
          b.status==="finished" &&
          b.finishedDate?.startsWith(
            selectedKey
          )
      )
      .sort(
        (a,b)=>
          (a.finishedDate||"")
          .localeCompare(
            b.finishedDate||""
          )
      );

  const pages =
    monthBooks.reduce(
      (a,b)=>
        a+
        (Number(b.pages)||0),
      0
    );

  const best =
    bestRated(
      monthBooks
    );

  const rated =
    monthBooks.filter(
      b=>
        Number(b.rating)>0
    );

  const avg =
    rated.length
      ? (
          rated.reduce(
            (a,b)=>
              a+
              Number(b.rating),
            0
          ) /
          rated.length
        ).toFixed(1)
      : "—";

  const stars =
    b=>{

      const n =
        Math.max(
          0,
          Math.min(
            5,
            Math.round(
              Number(b.rating)||0
            )
          )
        );

      return `${
        "★".repeat(n)
      }${
        "☆".repeat(5-n)
      }`;
    };

  app.innerHTML = `
    <section class="month-scrapbook-page">

      <div class="month-scrap-paper">

        <div
          class="torn-holes"
          aria-hidden="true"
        >
          ${
            Array
              .from(
                {
                  length:15
                },
                ()=>"<i></i>"
              )
              .join("")
          }
        </div>

        <div class="month-review-head">

          <div>

            <p class="mini-label">
              monthly wrap-up ·
              ${year}
            </p>

            <h2>
              Books:
            </h2>

          </div>

          <input
            type="month"
            id="reviewMonth"
            value="${selectedKey}"
            class="
              field
              month-review-picker
            "
          >

        </div>

        <div class="month-stats-note">

          <p>
            <b>
              ${MONTHS[month-1]}
            </b>
            wrap-up
          </p>

          <p>
            read:
            ${monthBooks.length}
            books
          </p>

          <p>
            pages:
            ${pages}
          </p>

          <p>
            average:
            ${avg}
            ${
              avg!=="—"
                ? " ★"
                : ""
            }
          </p>

          <p>
            favorite:
            ${
              best
                ? esc(best.title)
                : "—"
            }
          </p>

        </div>

        <div class="month-book-collage">

          ${
            monthBooks.length
              ? monthBooks
                  .map(
                    (b,i)=>`
                      <article
                        class="
                          review-book-polaroid
                          review-pos-${(i%8)+1}
                        "
                        data-id="${b.id}"
                      >

                        <button
                          data-action="open-book"
                          class="review-cover-btn"
                        >

                          ${
                            b.cover
                              ? `
                                <img
                                  src="${esc(b.cover)}"
                                  alt="${esc(b.title)}"
                                >
                              `
                              : `
                                <div class="review-cover-placeholder">
                                  BOOK
                                </div>
                              `
                          }

                        </button>

                        <div class="review-stars">
                          ${stars(b)}
                        </div>

                        <h3>
                          ${esc(b.title)}
                        </h3>

                        <p>
                          ${
                            b.review
                              ? esc(b.review)
                                  .slice(0,120) +
                                (
                                  b.review.length>120
                                    ? "…"
                                    : ""
                                )
                              : "little reading memory ♡"
                          }
                        </p>

                      </article>
                    `
                  )
                  .join("")
              : `
                <div class="review-empty-collage">

                  <span>
                    ☆
                  </span>

                  <h3>
                    No books yet
                  </h3>

                  <p>
                    Bu aya ait
                    bitiş tarihi olan
                    kitapların kapakları
                    burada görünecek.
                  </p>

                  <a
                    class="primary-btn"
                    href="#add-book"
                  >
                    ＋ Add Book
                  </a>

                </div>
              `
          }

        </div>

      </div>

      <section class="month-memory-sheet">

        <div class="section-head">

          <div>

            <p class="mini-label">
              little notes from the month
            </p>

            <h2>
              ${
                MONTHS[
                  month-1
                ]
              }
              memories
            </h2>

          </div>

        </div>

        <form
          id="monthReviewForm"
          class="scrap-review-grid"
        >

          ${
            reviewArea(
              "favorite book",
              "bestBook",
              review.bestBook
            )
          }

          ${
            reviewArea(
              "favorite character",
              "bestCharacter",
              review.bestCharacter
            )
          }

          ${
            reviewArea(
              "favorite quote",
              "quote",
              review.quote
            )
          }

          ${
            reviewArea(
              "biggest impact",
              "impact",
              review.impact
            )
          }

          ${
            reviewArea(
              "not for me",
              "disappointment",
              review.disappointment
            )
          }

          ${
            reviewArea(
              "reading mood",
              "mood",
              review.mood
            )
          }

          ${
            reviewArea(
              "next month tbr",
              "nextMonth",
              review.nextMonth
            )
          }

          ${
            reviewArea(
              "month in a few words",
              "summary",
              review.summary
            )
          }

          <div class="
            form-actions
            scrapbook-save
          ">

            <button class="primary-btn">
              save monthly memories ♡
            </button>

          </div>

        </form>

      </section>

    </section>
  `;

  app
    .querySelector("#reviewMonth")
    .addEventListener(
      "change",
      e=>{

        state.uiReviewMonth =
          e.target.value;

        render();

      }
    );

  app
    .querySelector("#monthReviewForm")
    .addEventListener(
      "submit",
      async e=>{

        e.preventDefault();

        state.monthReviews[
          selectedKey
        ] =
        Object.fromEntries(
          new FormData(
            e.currentTarget
          ).entries()
        );

        await saveJournal(
          "Ay sonu değerlendirmesi buluta kaydedildi"
        );

      }
    );

  bindBookCards(app);
}

function reviewArea(
  label,
  name,
  value=""
){

  return `
    <div class="review-prompt">

      <label>
        ${label}
      </label>

      <textarea
        name="${name}"
      >${esc(value||"")}</textarea>

    </div>
  `;
}

/* =================================================
   BEST BOOK
================================================= */

function renderBestBook(app){

  const finished =
    state.books.filter(
      b=>
        b.status==="finished"
    );

  if(!finished.length){

    app.innerHTML =
      emptyHTML(
        "♡",
        "Henüz aday kitap yok.",
        "Bitirdiğin kitaplardan yılın favorisini seçebilirsin.",
        "#add-book"
      );

    return;
  }

  const winner =
    state.books.find(
      b=>
        b.id===
        state.bestBook.winnerId
    );

  app.innerHTML = `
    <section class="section-card">

      <div class="section-head">

        <div>

          <p class="mini-label">
            book of the year
          </p>

          <h2>
            Best Book ♡
          </h2>

        </div>

      </div>

      <div class="book-grid">

        ${
          finished
            .map(
              b=>`
                <article
                  class="book-card"
                  data-id="${b.id}"
                >

                  <button
                    class="book-cover-wrap"
                    data-action="open-book"
                  >

                    ${
                      b.cover
                        ? `
                          <img
                            class="book-cover"
                            src="${esc(b.cover)}"
                          >
                        `
                        : `
                          <span class="cover-placeholder">
                            BOOK
                          </span>
                        `
                    }

                  </button>

                  <div class="book-card-body">

                    <h3 class="book-title">
                      ${esc(b.title)}
                    </h3>

                    <button
                      class="soft-btn"
                      data-winner="${b.id}"
                    >
                      ${
                        winner?.id===b.id
                          ? "★ Winner"
                          : "Favorim seç"
                      }
                    </button>

                  </div>

                </article>
              `
            )
            .join("")
        }

      </div>

    </section>
  `;

  bindBookCards(app);

  app
    .querySelectorAll(
      "[data-winner]"
    )
    .forEach(
      btn=>{

        btn.addEventListener(
          "click",
          async ()=>{

            state.bestBook.winnerId =
              btn.dataset.winner;

            await saveJournal(
              "Yılın favori kitabı kaydedildi ♡"
            );

            render();

          }
        );

      }
    );
}

/* =================================================
   HELPERS
================================================= */

function emptyHTML(
  icon,
  title,
  text,
  link
){

  return `
    <div class="empty">

      <div class="big">
        ${icon}
      </div>

      <h3>
        ${title}
      </h3>

      <p>
        ${text}
      </p>

      ${
        link
          ? `
            <a
              class="primary-btn"
              href="${link}"
            >
              Devam et
            </a>
          `
          : ""
      }

    </div>
  `;
}

function toast(
  text,
  error=false
){

  let el =
    document.querySelector(
      ".toast"
    );

  if(!el){

    el =
      document.createElement(
        "div"
      );

    el.className =
      "toast";

    document.body
      .appendChild(el);
  }

  el.textContent =
    text;

  el.style.background =
    error
      ? "#934b4b"
      : "#4f4841";

  el.classList.add(
    "show"
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(
      ()=>{
        el.classList.remove(
          "show"
        );
      },
      2500
    );
}

function exportData(){

  const data = {
    exportedAt:
      new Date().toISOString(),
    ...state
  };

  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href =
    url;

  a.download =
    `my-reading-corner-${
      new Date()
        .toISOString()
        .slice(0,10)
    }.json`;

  a.click();

  URL.revokeObjectURL(
    url
  );
}

/* =================================================
   START APP
================================================= */

init();
