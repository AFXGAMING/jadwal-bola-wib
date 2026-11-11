const API_STANDINGS = "/api/standings?league=epl";

const klasemenEl = document.getElementById("klasemen");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info-data");

function nilai(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "") ?? "-";
}

async function muatKlasemen() {
  statusEl.textContent = "Mengambil data klasemen...";
  klasemenEl.textContent = "Memuat klasemen Liga Inggris...";

  try {
    const response = await fetch(API_STANDINGS, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server ${response.status}`);
    }

    const teams = Array.isArray(data.response) ? [...data.response] : [];

    if (!teams.length) {
      throw new Error("Data klasemen belum tersedia dari penyedia data.");
    }

    teams.sort((a, b) =>
      Number(nilai(a.league_rank, a.position, a.rank, 999)) -
      Number(nilai(b.league_rank, b.position, b.rank, 999))
    );

    const tabel = document.createElement("table");
    tabel.className = "standings-table";

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    [
      "Pos", "Klub", "Main", "M", "S", "K",
      "GM", "GK", "SG", "Poin"
    ].forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });

    thead.appendChild(header);
    tabel.appendChild(thead);

    const tbody = document.createElement("tbody");

    teams.forEach(team => {
      const row = document.createElement("tr");

      const values = [
        nilai(team.league_rank, team.position, team.rank),
        nilai(team.team?.name, team.name, team.club),
        nilai(team.played, team.matches_played, team.games_played),
        nilai(team.wins, team.won),
        nilai(team.draws, team.ties),
        nilai(team.losses, team.lost),
        nilai(team.goals_for, team.goals_scored),
        nilai(team.goals_against, team.goals_conceded),
        nilai(team.goal_difference, team.goaldifference),
        nilai(team.points, team.pts)
      ];

      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;

        if (index === 1) {
          cell.className = "left";
        }

        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    tabel.appendChild(tbody);

    const card = document.createElement("div");
    card.className = "standings-card";
    card.appendChild(tabel);

    klasemenEl.replaceChildren(card);

    statusEl.textContent = "Klasemen berhasil dimuat.";
    infoEl.textContent =
      `Sumber: ${data.provider || "API"}`
      + (data.season_label ? ` · Musim ${data.season_label}` : "")
      + (data.fetched_at
        ? ` · Data diambil ${new Date(data.fetched_at).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta"
          })} WIB`
        : "");

  } catch (error) {
    statusEl.textContent = "Data klasemen gagal dimuat.";
    klasemenEl.textContent = error.message;
    infoEl.textContent = "Silakan coba muat ulang halaman.";
  }
}

muatKlasemen();
