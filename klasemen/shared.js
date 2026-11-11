const CONFIG = {
  epl: {
    name: "Premier League",
    title: "Klasemen Liga Inggris",
    region: "Inggris",
    stage: "Klasemen Premier League"
  },
  laliga: {
    name: "La Liga",
    title: "Klasemen Liga Spanyol",
    region: "Spanyol",
    stage: "Klasemen La Liga"
  },
  bundesliga: {
    name: "Bundesliga",
    title: "Klasemen Liga Jerman",
    region: "Jerman",
    stage: "Klasemen Bundesliga"
  },
  seriea: {
    name: "Serie A",
    title: "Klasemen Liga Italia",
    region: "Italia",
    stage: "Klasemen Serie A"
  },
  ligue1: {
    name: "Ligue 1",
    title: "Klasemen Liga Prancis",
    region: "Prancis",
    stage: "Klasemen Ligue 1"
  },
  ucl: {
    name: "Champions League",
    title: "Klasemen Liga Champions",
    region: "Eropa",
    stage: "League Phase Liga Champions"
  },
  uel: {
    name: "Europa League",
    title: "Klasemen Liga Europa",
    region: "Eropa",
    stage: "League Phase Liga Europa"
  },
  mls: {
    name: "MLS",
    title: "Klasemen MLS",
    region: "Amerika Serikat dan Kanada",
    stage: "Klasemen Major League Soccer"
  }
};

const LINKS = [
  ["epl", "Liga Inggris", "liga-inggris"],
  ["laliga", "La Liga", "la-liga"],
  ["bundesliga", "Bundesliga", "bundesliga"],
  ["seriea", "Serie A", "serie-a"],
  ["ligue1", "Ligue 1", "ligue-1"],
  ["ucl", "Champions League", "champions-league"],
  ["uel", "Europa League", "europa-league"],
  ["mls", "MLS", "mls"]
];

const league = document.body.dataset.league;
const config = CONFIG[league];

const klasemenEl = document.getElementById("klasemen");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info-data");

function nilai(...values) {
  return values.find(value =>
    value !== undefined && value !== null && value !== ""
  ) ?? "-";
}

function buatNavigasi() {
  const nav = document.getElementById("competition-links");
  if (!nav) return;

  LINKS.forEach(([code, label, slug]) => {
    const link = document.createElement("a");
    link.href = `/klasemen/${slug}/`;
    link.textContent = label;

    if (code === league) {
      link.setAttribute("aria-current", "page");
    }

    nav.appendChild(link);
  });
}

function buatSel(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value;

  if (className) cell.className = className;

  row.appendChild(cell);
}

async function muatKlasemen() {
  if (!config) {
    statusEl.textContent = "Kode kompetisi tidak dikenali.";
    return;
  }

  statusEl.textContent = "Mengambil data klasemen...";
  klasemenEl.textContent = "Memuat data...";

  try {
    const response = await fetch(
      `/api/standings?league=${encodeURIComponent(league)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server ${response.status}`);
    }

    const teams = Array.isArray(data.response)
      ? [...data.response]
      : [];

    if (!teams.length) {
      throw new Error("Data klasemen belum tersedia.");
    }

    teams.sort((a, b) =>
      Number(nilai(a.league_rank, a.position, a.rank, 999)) -
      Number(nilai(b.league_rank, b.position, b.rank, 999))
    );

    const tabel = document.createElement("table");
    tabel.className = "standings-table";

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    const labels = ["Pos", "Klub"];

    if (league === "mls") labels.push("Wilayah");

    labels.push(
      "Main", "M", "S", "K",
      "GM", "GK", "SG", "Poin"
    );

    labels.forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });

    thead.appendChild(header);
    tabel.appendChild(thead);

    const tbody = document.createElement("tbody");

    teams.forEach(team => {
      const row = document.createElement("tr");

      buatSel(row, nilai(team.league_rank, team.position, team.rank));
      buatSel(
        row,
        nilai(team.team?.name, team.name, team.club),
        "left"
      );

      if (league === "mls") {
        buatSel(row, nilai(team.conference));
      }

      [
        nilai(team.played, team.matches_played, team.games_played),
        nilai(team.wins, team.won),
        nilai(team.draws, team.ties),
        nilai(team.losses, team.lost),
        nilai(team.goals_for, team.goals_scored),
        nilai(team.goals_against, team.goals_conceded),
        nilai(team.goal_difference, team.goaldifference),
        nilai(team.points, team.pts)
      ].forEach(value => buatSel(row, value));

      tbody.appendChild(row);
    });

    tabel.appendChild(tbody);

    const card = document.createElement("div");
    card.className = "standings-card";
    card.appendChild(tabel);

    klasemenEl.replaceChildren(card);

    statusEl.textContent =
      `${config.stage} berhasil dimuat · ${teams.length} tim`;

    infoEl.textContent =
      `Sumber: ${data.provider || "API"}` +
      (data.season_label ? ` · Musim ${data.season_label}` : "") +
      (data.fetched_at
        ? ` · Diperbarui ${new Date(data.fetched_at).toLocaleString(
            "id-ID",
            { timeZone: "Asia/Jakarta" }
          )} WIB`
        : "");

  } catch (error) {
    statusEl.textContent = "Data klasemen gagal dimuat.";
    klasemenEl.textContent = error.message;
    infoEl.textContent = "Silakan coba muat ulang halaman.";
  }
}

buatNavigasi();
muatKlasemen();
