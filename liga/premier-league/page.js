const API_FIXTURES = "/api/fixtures";
const API_STANDINGS = "/api/standings";

const pertandinganEl = document.getElementById("pertandingan");
const tanggalEl = document.getElementById("tanggal");
const klasemenEl = document.getElementById("klasemen");

function tanggalJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function waktuWIB(date) {
  return new Date(date).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

async function muatPertandingan() {
  const tanggal = tanggalJakarta();
  tanggalEl.textContent = `Tanggal: ${tanggal} (WIB)`;

  try {
    const response = await fetch(
      `${API_FIXTURES}?date=${encodeURIComponent(tanggal)}`,
      { cache: "no-store" }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Server ${response.status}`);

    const matches = (Array.isArray(data.response) ? data.response : [])
      .filter(match =>
        match?.league?.name?.toLowerCase() === "premier league"
      )
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    pertandinganEl.replaceChildren();

    if (!matches.length) {
      pertandinganEl.textContent =
        "Belum ada pertandingan Premier League yang terjadwal pada tanggal ini.";
      return;
    }

    matches.forEach(match => {
      const card = document.createElement("article");
      card.className = "match-card";

      const waktu = document.createElement("p");
      waktu.textContent = waktuWIB(match.fixture.date) + " WIB";

      const tim = document.createElement("h3");
      const home = match.teams.home.name;
      const away = match.teams.away.name;
      const gh = match.goals.home;
      const ga = match.goals.away;

      tim.textContent =
        gh !== null && ga !== null
          ? `${home} ${gh} - ${ga} ${away}`
          : `${home} vs ${away}`;

      const status = document.createElement("p");
      status.textContent = match.fixture.status.long || "Status belum tersedia";

      card.append(waktu, tim, status);
      pertandinganEl.appendChild(card);
    });
  } catch (error) {
    pertandinganEl.textContent = "Gagal memuat pertandingan: " + error.message;
  }
}

async function muatKlasemen() {
  klasemenEl.textContent = "Memuat klasemen...";

  try {
    const response = await fetch(`${API_STANDINGS}?league=epl`, {
      cache: "no-store"
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Server ${response.status}`);

    const teams = Array.isArray(data.response) ? data.response : [];

    if (!teams.length) {
      klasemenEl.textContent = "Data klasemen belum tersedia.";
      return;
    }

    const tabel = document.createElement("table");
    tabel.className = "standings-table";

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    ["Pos", "Klub", "Main", "M", "S", "K", "GM", "GK", "SG", "Poin"]
      .forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        header.appendChild(th);
      });

    thead.appendChild(header);
    tabel.appendChild(thead);

    const tbody = document.createElement("tbody");

    teams.sort((a, b) =>
      Number(a.league_rank ?? a.position ?? a.rank ?? 999) -
      Number(b.league_rank ?? b.position ?? b.rank ?? 999)
    );

    teams.forEach(team => {
      const row = document.createElement("tr");

      const values = [
        team.league_rank ?? team.position ?? team.rank ?? "-",
        team.team?.name ?? team.name ?? team.club ?? "-",
        team.played ?? team.matches_played ?? team.games_played ?? "-",
        team.wins ?? team.won ?? "-",
        team.draws ?? team.ties ?? "-",
        team.losses ?? team.lost ?? "-",
        team.goals_for ?? team.goals_scored ?? "-",
        team.goals_against ?? team.goals_conceded ?? "-",
        team.goal_difference ?? team.goaldifference ?? "-",
        team.points ?? team.pts ?? "-"
      ];

      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "-";
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    tabel.appendChild(tbody);
    klasemenEl.replaceChildren(tabel);

    const info = document.createElement("p");
    info.textContent = `Sumber: ${data.provider || "API"}${data.season_label ? " · Musim " + data.season_label : ""}`;
    klasemenEl.appendChild(info);

  } catch (error) {
    klasemenEl.textContent = "Gagal memuat klasemen: " + error.message;
  }
}

muatPertandingan();
muatKlasemen();
