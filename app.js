const FIXTURES_API = "/api/fixtures";
const STANDINGS_API = "/api/standings";

const matchesEl = document.getElementById("matches");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("searchInput");
const genderFilter = document.getElementById("genderFilter");
const leagueFilter = document.getElementById("leagueFilter");
const matchCount = document.getElementById("matchCount");
const sectionTitle = document.getElementById("sectionTitle");

const matchesView = document.getElementById("matchesView");
const matchDetailView = document.getElementById("matchDetailView");
const matchDetailContent = document.getElementById("matchDetailContent");
const backToMatchesBtn = document.getElementById("backToMatchesBtn");
const standingsView = document.getElementById("standingsView");
const standingsLeagueSelect = document.getElementById("standingsLeagueSelect");
const standingsUpdatedAt = document.getElementById("standingsUpdatedAt");
const standingsContainer = document.getElementById("standingsContainer");

const TOURNAMENT_API = "/api/tournament";
const tournamentView = document.getElementById("tournamentView");
const tournamentLeagueSelect = document.getElementById("tournamentLeagueSelect");
const loadTournamentBtn = document.getElementById("loadTournamentBtn");
const tournamentContainer = document.getElementById("tournamentContainer");

let fixtures = [];
const CACHE_DURATION = 30 * 60 * 1000;
const tournamentCache = new Map();
const standingsCache = new Map();
let standingsRequestId = 0;

let tournamentMatches = [];
let tournamentOffset = 0;
let tournamentLoading = false;
let currentView = "all";
let loading = false;
let favorites = JSON.parse(localStorage.getItem("kickoff_favorites")) || [];

const liveCodes = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const finishedCodes = ["FT", "AET", "PEN"];

function getJakartaDate() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const v = {};
  p.forEach(x => v[x.type] = x.value);
  return `${v.year}-${v.month}-${v.day}`;
}

function formatUpdatedAt(value) {
  if (!value) return "Waktu sumber tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value)) + " WIB";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function getStatus(match) {
  const code = match.fixture.status.short;
  const elapsed = match.fixture.status.elapsed;
  if (liveCodes.includes(code)) return { label: (elapsed != null ? `${elapsed}' LIVE` : "LIVE"), type: "live" };
  if (finishedCodes.includes(code)) return { label: "SELESAI", type: "finished" };
  if (["NS", "TBD"].includes(code)) return { label: "BELUM MAIN", type: "upcoming" };
  return { label: code, type: "other" };
}

function isWomenMatch(match) {
  return /women'?s?|feminine|female|ladies|girls|女/i.test([match.league?.name, match.teams?.home?.name, match.teams?.away?.name].join(" ").toLowerCase());
}

function getGender(match) { return isWomenMatch(match) ? "women" : "men"; }

function getTime(match) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(match.fixture.date)) + " WIB";
}

function getSubScore(match) {
  if (match.score?.penalty?.home !== null) return `PEN: ${match.score.penalty.home} - ${match.score.penalty.away}`;
  if (match.score?.halftime?.home !== null) return `HT: ${match.score.halftime.home} - ${match.score.halftime.away}`;
  return "";
}

function updateLeagueOptions() {
  const previous = leagueFilter.value;
  const leagues = [...new Map(fixtures.map(m => [
    m.league.id, { id: m.league.id, name: m.league.name, season: m.league.season }
  ])).values()].sort((a, b) => a.name.localeCompare(b.name));

  leagueFilter.innerHTML = '<option value="all">Semua Kompetisi</option>';
  leagues.forEach(l => {
    const opt = document.createElement("option");
    opt.value = String(l.id);
    opt.textContent = l.name;
    leagueFilter.appendChild(opt);
  });
  if ([...leagueFilter.options].some(o => o.value === previous)) leagueFilter.value = previous;

  const standingsLeagues = [
    ["epl", "Premier League"],
    ["laliga", "La Liga"],
    ["bundesliga", "Bundesliga"],
    ["seriea", "Serie A"],
    ["ligue1", "Ligue 1"],
    ["ucl", "UEFA Champions League"],
    ["uel", "UEFA Europa League"],
    ["mls", "Major League Soccer"]
  ];

  const previousStandings = standingsLeagueSelect.value;
  standingsLeagueSelect.innerHTML = '<option value="">Pilih Kompetisi...</option>';

  standingsLeagues.forEach(([code, name]) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    standingsLeagueSelect.appendChild(opt);
  });

  if (standingsLeagues.some(([code]) => code === previousStandings)) {
    standingsLeagueSelect.value = previousStandings;
  }
}

function poisson(lambda, k) {
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) result *= lambda / i;
  return result;
}

function calculatePrediction(match) {
  const code = match.fixture.status.short;
  const elapsed = match.fixture.status.elapsed;
  const homeScore = match.goals.home;
  const awayScore = match.goals.away;

  if (
    !liveCodes.includes(code) || elapsed === null || elapsed === undefined ||
    !Number.isFinite(Number(elapsed)) || homeScore === null || homeScore === undefined ||
    awayScore === null || awayScore === undefined ||
    !Number.isFinite(Number(homeScore)) || !Number.isFinite(Number(awayScore)) ||
    ["P", "BT", "SUSP", "INT"].includes(code)
  ) return null;

  const totalMinutes = code === "ET" ? 120 : 90;
  const remaining = Math.max(0, totalMinutes - Math.min(Number(elapsed), totalMinutes));
  const homeLambda = 1.35 * (remaining / 90);
  const awayLambda = 1.05 * (remaining / 90);

  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const prob = poisson(homeLambda, h) * poisson(awayLambda, a);
      const fH = Number(homeScore) + h;
      const fA = Number(awayScore) + a;
      if (fH > fA) homeWin += prob;
      else if (fH === fA) draw += prob;
      else awayWin += prob;
    }
  }

  const total = homeWin + draw + awayWin;
  if (!total) return null;
  const home = Math.round(homeWin / total * 100);
  const drawPercent = Math.round(draw / total * 100);
  return [home, drawPercent, 100 - home - drawPercent];
}

function predictionHTML(match) {
  const status = getStatus(match);
  if (status.type === "upcoming") {
    return `<div class="prediction"><div class="prediction-title">📊 Estimasi hasil pertandingan</div><div class="no-prediction">Estimasi otomatis akan tersedia setelah pertandingan dimulai (LIVE).</div></div>`;
  }
  if (status.type !== "live") return "";

  const values = calculatePrediction(match);
  if (!values) return `<div class="prediction"><div class="prediction-title">📊 Estimasi hasil pertandingan</div><div class="no-prediction">Estimasi belum tersedia untuk status atau data pertandingan ini.</div></div>`;

  return `
    <div class="prediction">
      <div class="prediction-title">📊 Estimasi hasil pertandingan</div>
      <div class="prediction-note">Model sederhana berdasarkan skor dan waktu tersisa. Bukan prediksi pasti dan belum memakai statistik tembakan atau penguasaan bola.</div>
      <div class="probabilities">
        <div class="probability home"><strong>${values[0]}%</strong><span>Menang kandang</span></div>
        <div class="probability draw"><strong>${values[1]}%</strong><span>Seri</span></div>
        <div class="probability away"><strong>${values[2]}%</strong><span>Menang tandang</span></div>
      </div>
    </div>`;
}

function toggleFavorite(id) {
  favorites = favorites.includes(id) ? favorites.filter(fId => fId !== id) : [...favorites, id];
  localStorage.setItem("kickoff_favorites", JSON.stringify(favorites));
  renderMatches();
}

let detailRequestId = 0;
let detailPreviousView = "all";

matchesEl.addEventListener("click", (e) => {
  const star = e.target.closest(".star-btn");
  if (star) {
    e.stopPropagation();
    toggleFavorite(parseInt(star.dataset.teamId, 10));
    return;
  }

  const card = e.target.closest(".match-card[data-fixture-id]");
  if (card) openMatchDetail(card.dataset.fixtureId);
});

backToMatchesBtn.addEventListener("click", () => {
  setView(detailPreviousView);
});

function displayStatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return escapeHTML(value);
}

function statNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function openMatchDetail(fixtureId) {
  const match = fixtures.find(item => String(item.fixture.id) === String(fixtureId));
  if (!match) return;

  const requestId = ++detailRequestId;
  detailPreviousView = currentView;

  matchesView.style.display = "none";
  standingsView.style.display = "none";
  tournamentView.style.display = "none";
  matchDetailView.style.display = "block";

  const status = getStatus(match);
  const home = match.teams.home;
  const away = match.teams.away;
  const hasScore = match.goals.home !== null && match.goals.away !== null;

  matchDetailContent.innerHTML = `
    <div class="detail-card">
      <div class="detail-league">${escapeHTML(match.league.name)} · ${escapeHTML(getTime(match))}</div>
      <div class="detail-status ${status.type}">${escapeHTML(status.label)}</div>
      <div class="detail-scoreboard">
        <div class="detail-team">
          ${home.logo ? `<img src="${escapeHTML(home.logo)}" alt="" loading="lazy">` : ""}
          <strong>${escapeHTML(home.name)}</strong>
        </div>
        <div class="detail-score">${hasScore ? `${escapeHTML(match.goals.home)} - ${escapeHTML(match.goals.away)}` : "VS"}</div>
        <div class="detail-team">
          ${away.logo ? `<img src="${escapeHTML(away.logo)}" alt="" loading="lazy">` : ""}
          <strong>${escapeHTML(away.name)}</strong>
        </div>
      </div>
    </div>
    <div class="detail-card">
      <h2>Statistik Pertandingan</h2>
      <div id="matchStats" class="empty">Mengambil statistik dari API-Football...</div>
    </div>`;

  try {
    const response = await fetch(`/api/statistics?fixture=${encodeURIComponent(fixtureId)}`, {
      cache: "no-store"
    });
    const data = await response.json();

    if (requestId !== detailRequestId) return;

    if (!response.ok || (data.errors && Object.keys(data.errors).length)) {
      throw new Error(data.message || data.error || "Statistik tidak dapat dimuat.");
    }

    const teams = Array.isArray(data.response) ? data.response : [];
    const homeStats = teams.find(item => String(item.team?.id) === String(home.id));
    const awayStats = teams.find(item => String(item.team?.id) === String(away.id));

    if (!homeStats || !awayStats ||
        !homeStats.statistics?.length || !awayStats.statistics?.length) {
      document.getElementById("matchStats").innerHTML =
        '<div class="empty">Statistik belum tersedia dari penyedia data untuk pertandingan ini.</div>';
      return;
    }

    const labels = {
      "Shots on Goal": "Tembakan tepat sasaran",
      "Shots off Goal": "Tembakan melenceng",
      "Total Shots": "Total tembakan",
      "Blocked Shots": "Tembakan diblok",
      "Shots insidebox": "Tembakan dalam kotak penalti",
      "Shots outsidebox": "Tembakan luar kotak penalti",
      "Fouls": "Pelanggaran",
      "Corner Kicks": "Tendangan sudut",
      "Offsides": "Offside",
      "Ball Possession": "Penguasaan bola",
      "Yellow Cards": "Kartu kuning",
      "Red Cards": "Kartu merah",
      "Goalkeeper Saves": "Penyelamatan kiper",
      "Total passes": "Total operan",
      "Passes accurate": "Operan akurat",
      "expected_goals": "Expected Goals (xG)",
      "Passes %": "Akurasi operan"
    };

    const awayMap = new Map(awayStats.statistics.map(item => [item.type, item.value]));
    const rows = homeStats.statistics
      .filter(item => labels[item.type])
      .map(item => {
        const left = item.value;
        const right = awayMap.get(item.type);
        const a = statNumber(left);
        const b = statNumber(right);
        const max = Math.max(a ?? 0, b ?? 0);
        const leftWidth = max > 0 && a !== null ? a / max * 100 : 0;
        const rightWidth = max > 0 && b !== null ? b / max * 100 : 0;

        return `
          <div class="stat-row">
            <div class="stat-values">
              <strong>${displayStatValue(left)}</strong>
              <span>${escapeHTML(labels[item.type])}</span>
              <strong>${displayStatValue(right)}</strong>
            </div>
            <div class="stat-bars">
              <div class="stat-track">
                <span class="stat-bar home" style="width:${leftWidth}%"></span>
              </div>
              <div class="stat-track">
                <span class="stat-bar away" style="width:${rightWidth}%"></span>
              </div>
            </div>
          </div>`;
      });

    document.getElementById("matchStats").innerHTML = rows.length
      ? rows.join("")
      : '<div class="empty">Belum ada jenis statistik yang didukung untuk pertandingan ini.</div>';

  } catch (error) {
    if (requestId !== detailRequestId) return;
    document.getElementById("matchStats").innerHTML =
      `<div class="empty">${escapeHTML(error.message)}<br>Silakan coba lagi nanti.</div>`;
  }
}

function renderMatches() {
  const search = searchInput.value.toLowerCase().trim();
  const selL = leagueFilter.value;
  const selG = genderFilter.value;

  const filtered = fixtures.filter(m => {
    const s = !search || m.teams.home.name.toLowerCase().includes(search) || m.teams.away.name.toLowerCase().includes(search) || m.league.name.toLowerCase().includes(search);
    const l = selL === "all" || String(m.league.id) === selL;
    const g = selG === "all" || getGender(m) === selG;
    return s && l && g && (currentView === "all" || getStatus(m).type === currentView);
  }).sort((a, b) => {
    const aF = favorites.includes(a.teams.home.id) || favorites.includes(a.teams.away.id);
    const bF = favorites.includes(b.teams.home.id) || favorites.includes(b.teams.away.id);
    if (aF && !bF) return -1;
    if (!aF && bF) return 1;
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  matchCount.textContent = `${filtered.length} pertandingan`;
  if (!filtered.length) {
    matchesEl.innerHTML = '<div class="empty">Belum ada pertandingan dalam kategori ini.</div>';
    return;
  }

  matchesEl.innerHTML = filtered.map(match => {
    const status = getStatus(match);
    const hasScore = match.goals.home !== null && match.goals.away !== null;
    const homeStar = `<span class="star-btn ${favorites.includes(match.teams.home.id) ? 'active' : ''}" data-team-id="${match.teams.home.id}">★</span>`;
    const awayStar = `<span class="star-btn ${favorites.includes(match.teams.away.id) ? 'active' : ''}" data-team-id="${match.teams.away.id}">★</span>`;
    const subHTML = getSubScore(match) ? `<div class="sub-score">${escapeHTML(getSubScore(match))}</div>` : "";

    return `
    <article class="match-card" data-fixture-id="${escapeHTML(match.fixture.id)}" role="button" tabindex="0" aria-label="Lihat detail ${escapeHTML(match.teams.home.name)} melawan ${escapeHTML(match.teams.away.name)}">
      <div class="match-top">
        <div class="league">${match.league.logo ? `<img src="${escapeHTML(match.league.logo)}" loading="lazy">` : ""}<span>${escapeHTML(match.league.name)}</span></div>
        <span class="status ${status.type}">${escapeHTML(status.label)}</span>
      </div>
      <div class="teams">
        <div class="team">${match.teams.home.logo ? `<img src="${escapeHTML(match.teams.home.logo)}" loading="lazy">` : ""}<div class="team-name">${escapeHTML(match.teams.home.name)} ${homeStar}</div></div>
        <div class="score-wrapper"><div class="score">${escapeHTML(hasScore ? `${match.goals.home} - ${match.goals.away}` : "VS")}</div>${subHTML}</div>
        <div class="team">${match.teams.away.logo ? `<img src="${escapeHTML(match.teams.away.logo)}" loading="lazy">` : ""}<div class="team-name">${escapeHTML(match.teams.away.name)} ${awayStar}</div></div>
      </div>
      <div class="kickoff">${escapeHTML(getTime(match))}</div>
      ${["live", "upcoming"].includes(status.type) ? predictionHTML(match) : ""}
    </article>`;
  }).join("");
}


async function fetchTournament() {
  if (tournamentLoading) return;

  const league = tournamentLeagueSelect.value;
  const season = "2026";
  const maxPages = 20;
  const cacheKey = `${league}|${season}`;
  const cached = tournamentCache.get(cacheKey);

  if (cached && Date.now() - cached.savedAt < CACHE_DURATION) {
    tournamentMatches = [...cached.matches];
    tournamentContainer.dataset.loaded = "true";
    renderTournament();
    return;
  }

  tournamentLoading = true;
  tournamentContainer.dataset.loaded = "";
  tournamentContainer.innerHTML =
    '<div class="status-message">Mengambil data turnamen...</div>';

  try {
    const seen = new Set();
    const matches = [];
    let offset = 0;
    let pageCount = 0;
    let lastPageLength = 0;

    while (pageCount < maxPages) {
      const url = `${TOURNAMENT_API}?league=${encodeURIComponent(league)}&season=${season}&offset=${offset}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server ${response.status}`);
      }

      const page = Array.isArray(data)
        ? data
        : Array.isArray(data.matches)
          ? data.matches
          : [];

      lastPageLength = page.length;
      if (!page.length) break;

      page.forEach(match => {
        const key = match.game_id ||
          [
            match.round,
            match.date,
            match.home_team?.team_id,
            match.away_team?.team_id
          ].join("|");

        if (!seen.has(key)) {
          seen.add(key);
          matches.push(match);
        }
      });

      offset += page.length;
      pageCount++;

      if (tournamentLeagueSelect.value === league) {
        tournamentContainer.innerHTML =
          `<div class="status-message">Memuat halaman ${pageCount} · ${matches.length} pertandingan ditemukan...</div>`;
      }

      if (page.length < 50) break;
    }

    tournamentCache.set(cacheKey, {
      matches: [...matches],
      savedAt: Date.now()
    });

    if (tournamentLeagueSelect.value === league) {
      tournamentMatches = matches;
      tournamentOffset = offset;
      tournamentContainer.dataset.loaded = "true";
      renderTournament();

      if (pageCount === maxPages && lastPageLength === 50) {
        tournamentContainer.insertAdjacentHTML(
          "afterbegin",
          '<div class="status-message">Batas pengambilan halaman tercapai. Sebagian data mungkin belum dimuat.</div>'
        );
      }
    }
  } catch (error) {
    if (tournamentLeagueSelect.value === league) {
      tournamentContainer.innerHTML =
        `<div class="status-message">Gagal mengambil turnamen.<br>${escapeHTML(error.message)}</div>`;
    }
  } finally {
    tournamentLoading = false;

    const selectedLeague = tournamentLeagueSelect.value;
    const selectedKey = `${selectedLeague}|2026`;
    const selectedCache = tournamentCache.get(selectedKey);

    if (
      tournamentView &&
      currentView === "tournament" &&
      selectedLeague !== league &&
      !(selectedCache && Date.now() - selectedCache.savedAt < CACHE_DURATION)
    ) {
      fetchTournament();
    } else if (
      tournamentView &&
      currentView === "tournament" &&
      selectedLeague !== league &&
      selectedCache
    ) {
      tournamentMatches = [...selectedCache.matches];
      tournamentContainer.dataset.loaded = "true";
      renderTournament();
    }
  }
}

function renderTournament() {
  if (!tournamentMatches.length) {
    tournamentContainer.innerHTML =
      '<div class="empty">Belum ada data pertandingan turnamen.</div>';
    return;
  }

  const rounds = new Map();

  tournamentMatches.forEach(match => {
    if (
      match.season_type &&
      match.season_type !== "knockout"
    ) return;

    const round = match.round || "Babak lainnya";

    if (!rounds.has(round)) {
      rounds.set(round, []);
    }

    rounds.get(round).push(match);
  });

  if (!rounds.size) {
    tournamentContainer.innerHTML =
      '<div class="empty">Data babak gugur belum tersedia.</div>';
    return;
  }

  const hasScore = value =>
    value !== null && value !== undefined && value !== "";

  const formatDate = match => {
    const value = match.start_time || match.date;

    if (!value) return "Tanggal belum tersedia";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return match.date || value;
    }

    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: match.start_time ? "short" : undefined
    }).format(date) + (match.start_time ? " WIB" : "");
  };

  const matchCard = match => {
    const home = match.home_team?.name || "TBD";
    const away = match.away_team?.name || "TBD";

    const homeScore = hasScore(match.home_score)
      ? String(match.home_score)
      : "-";

    const awayScore = hasScore(match.away_score)
      ? String(match.away_score)
      : "-";

    const winnerName =
      typeof match.winner === "string"
        ? match.winner
        : match.winner?.name || "";

    const winner = winnerName.trim().toLowerCase();
    const winnerValue = typeof match.winner === "string"
  ? match.winner
  : match.winner?.team_id || match.winner?.name || "";

const normalize = value => String(value || "").toLowerCase().trim();

const homeWinner =
  normalize(winnerValue) === normalize(match.home_team?.team_id) ||
  normalize(winnerValue) === normalize(home);

const awayWinner =
  normalize(winnerValue) === normalize(match.away_team?.team_id) ||
  normalize(winnerValue) === normalize(away);

const marker =
  match.decided_in === "penalties" ? " P" :
  match.decided_in === "extra_time" ? " ET" : "";

const homeMarker = homeWinner ? marker : "";
const awayMarker = awayWinner ? marker : "";

    return `
      <article class="tournament-match">
        <div class="tournament-team-row ${homeWinner ? "is-winner" : ""}">
          <span>${escapeHTML(home)}</span>
          <strong>${escapeHTML(homeScore + homeMarker)}</strong>
        </div>

        <div class="tournament-team-row ${awayWinner ? "is-winner" : ""}">
          <span>${escapeHTML(away)}</span>
          <strong>${escapeHTML(awayScore + awayMarker)}</strong>
        </div>

        <div class="tournament-match-info">
          ${escapeHTML(formatDate(match))}
        </div>
      </article>
    `;
  };

  let html = `
    <div class="tournament-scroll">
      <div class="tournament-bracket">
  `;

  const roundOrder = round => {
    const name = String(round).toLowerCase();

    if (/qualif|preliminary/.test(name)) return 0;
    if (/first round|1st round|round 1/.test(name)) return 100;
    if (/second round|2nd round|round 2/.test(name)) return 200;
    if (/third round|3rd round|round 3/.test(name)) return 300;
    if (/fourth round|4th round|round 4/.test(name)) return 400;
    if (/fifth round|5th round|round 5/.test(name)) return 500;
    if (/sixth round|6th round|round 6/.test(name)) return 600;
    if (/round of 64|last 64/.test(name)) return 650;
    if (/play.?off/.test(name)) return 700;
    if (/round of 32|last 32/.test(name)) return 750;
    if (/round of 16|last 16/.test(name)) return 800;
    if (/quarter.?final/.test(name)) return 900;
    if (/semi.?final/.test(name)) return 1000;
    if (/\bfinal\b/.test(name)) return 1100;

    return 5000;
};

[...rounds.entries()]
    .sort((a, b) => roundOrder(a[0]) - roundOrder(b[0]))
    .forEach(([round, matches]) => {
    html += `
      <section class="tournament-round">
        <h3>
          <span>${escapeHTML(round)}</span>
          <small class="tournament-round-count">${matches.length} pertandingan</small>
        </h3>
        ${matches.map(matchCard).join("")}
      </section>
    `;
  });

  html += `
      </div>
    </div>
  `;

  tournamentContainer.innerHTML = html;

}


function setView(view) {
  matchDetailView.style.display = "none";
  const isStandings = view === "standings";
  const isTournament = view === "tournament";

  matchesView.style.display =
    (!isStandings && !isTournament) ? "block" : "none";

  standingsView.style.display =
    isStandings ? "block" : "none";

  tournamentView.style.display =
    isTournament ? "block" : "none";

  if (!isStandings && !isTournament) {
    currentView = view;

    const titles = {
      all: "Semua Pertandingan",
      upcoming: "Belum Main",
      live: "Sedang Main",
      finished: "Selesai"
    };

    sectionTitle.textContent = titles[view] || "Pertandingan";
    renderMatches();
  }

  if (isTournament && !tournamentContainer.dataset.loaded) {
    fetchTournament();
  }

  document.querySelectorAll(".tabs button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

async function fetchStandings() {
  const league = standingsLeagueSelect.value;
  const requestId = ++standingsRequestId;

  if (!league) {
    standingsContainer.innerHTML =
      '<div class="empty">Pilih liga untuk memuat klasemen.</div>';
    return;
  }

  const cached = standingsCache.get(league);

  if (cached && Date.now() - cached.savedAt < CACHE_DURATION) {
    standingsContainer.innerHTML = cached.html;
    if (standingsUpdatedAt) {
      standingsUpdatedAt.textContent = cached.updatedAt;
    }
    return;
  }

  standingsContainer.innerHTML =
    '<div class="status-message">Mengambil klasemen musim berjalan...</div>';

  try {
    const res = await fetch(
      `${STANDINGS_API}?league=${encodeURIComponent(league)}`
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Gagal mengambil klasemen.");
    }

    const updatedAt = formatUpdatedAt(data.fetched_at);

    if (!Array.isArray(data.response) || data.response.length === 0) {
      const html = '<div class="empty">Data klasemen belum tersedia.</div>';
      standingsCache.set(league, {
        html,
        updatedAt,
        savedAt: Date.now()
      });

      if (requestId === standingsRequestId) {
        standingsContainer.innerHTML = html;
        if (standingsUpdatedAt) standingsUpdatedAt.textContent = updatedAt;
      }
      return;
    }

    const standings = league === "mls"
      ? [...data.response].sort((a, b) => {
          const order = { Eastern: 1, Western: 2 };
          return (order[a.conference] ?? 99) - (order[b.conference] ?? 99)
            || (a.conference_rank ?? 99) - (b.conference_rank ?? 99);
        })
      : data.response;

    const seasonLabel = data.season_label || "Musim berjalan";

    let tableHTML = `
      <div class="standings-card">
        <div class="status-message">${escapeHTML(seasonLabel)}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="left">Klub</th>
              <th>MN</th>
              <th>M</th>
              <th>S</th>
              <th>K</th>
              <th>SG</th>
              <th>PT</th>
            </tr>
          </thead>
          <tbody>
    `;

    let currentConference = "";

    standings.forEach(team => {
      const t = team.team || {};

      if (league === "mls" && team.conference !== currentConference) {
        currentConference = team.conference;
        tableHTML += `
          <tr class="conference-heading">
            <td colspan="8">${escapeHTML(currentConference || "Konferensi")}</td>
          </tr>
        `;
      }

      tableHTML += `
        <tr>
          <td>${league === "mls"
            ? team.conference_rank ?? "-"
            : team.league_rank ?? "-"}</td>
          <td class="left">
            <div class="team-cell">
              <span class="team-name">${escapeHTML(t.name || "Klub")}</span>
            </div>
          </td>
          <td>${team.games_played ?? 0}</td>
          <td>${team.wins ?? 0}</td>
          <td>${team.draws ?? 0}</td>
          <td>${team.losses ?? 0}</td>
          <td>${team.goal_difference ?? 0}</td>
          <td><strong>${team.points ?? 0}</strong></td>
        </tr>
      `;
    });

    tableHTML += `
          </tbody>
        </table>
      </div>
    `;

    standingsCache.set(league, {
      html: tableHTML,
      updatedAt,
      savedAt: Date.now()
    });

    if (requestId === standingsRequestId) {
      standingsContainer.innerHTML = tableHTML;
      if (standingsUpdatedAt) {
        standingsUpdatedAt.textContent = updatedAt;
      }
    }
  } catch (err) {
    if (requestId === standingsRequestId) {
      standingsContainer.innerHTML =
        `<div class="empty">${escapeHTML(err.message || "Gagal memuat klasemen.")}</div>`;
    }
  }
}

async function load() {
  if (loading) return;
  loading = true;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Memuat...";

  matchesEl.innerHTML = Array(5).fill(`<article class="skeleton-card"><div class="skeleton-box skel-top"></div><div class="teams"><div class="team"><div class="skeleton-box skel-team"></div><div class="skeleton-box skel-name"></div></div><div class="score-wrapper"><div class="skeleton-box skel-score"></div></div><div class="team"><div class="skeleton-box skel-team"></div><div class="skeleton-box skel-name"></div></div></div><div class="skeleton-box skel-bottom"></div></article>`).join("");

  try {
    const res = await fetch(`${FIXTURES_API}?date=${encodeURIComponent(getJakartaDate())}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server ${res.status}`);

    const fixturesUpdatedAt = document.getElementById("fixturesUpdatedAt");
    if (fixturesUpdatedAt) {
      fixturesUpdatedAt.textContent = formatUpdatedAt(data.fetched_at);
    }
    fixtures = data.response.filter(m => m && m.fixture && m.teams && m.league);
    updateLeagueOptions();
    renderMatches();
  } catch (error) {
    matchesEl.innerHTML = `<div class="status-message">Gagal mengambil jadwal.<br>${escapeHTML(error.message)}</div>`;
  } finally {
    loading = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = "↻ Refresh";
  }
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
refreshBtn.addEventListener("click", load);
searchInput.addEventListener("input", renderMatches);
genderFilter.addEventListener("change", renderMatches);
leagueFilter.addEventListener("change", renderMatches);
standingsLeagueSelect.addEventListener("change", fetchStandings);
loadTournamentBtn.addEventListener("click", () => fetchTournament());

load();
setInterval(load, 5 * 60 * 1000);
