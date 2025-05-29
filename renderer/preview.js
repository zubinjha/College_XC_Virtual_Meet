// ← pull from localStorage
const raw = localStorage.getItem('virtualMeet');
if (!raw) {
  document.body.innerHTML =
    '<div style="padding:20px;color:red;">No meet data found.</div>';
  throw new Error('No meet data');
}
const snapshot = JSON.parse(raw);

// Model Classes for storing running meet representation
class Runner {
  constructor(name, place, time, eff, pts, team) {
    this.name = name;
    this.place = place;
    this.time = time;
    this.effectivePlace = eff;
    this.points = pts;
    this.team = team;
    this.isDisplacer = false;
  }
}
class Team {
  constructor(name) {
    this.name = name;
    this.runners = [];
    this.scoreList = [];
    this.score = null;
  }
  calculateScore() {
    const pts = this.runners
      .map(r => r.points)
      .filter(v => typeof v === 'number')
      .slice(0, 5);
    this.scoreList = pts;
    this.score = pts.length === 5 ? pts.reduce((s, v) => s + v, 0) : null;
  }
}
class Meet {
  constructor(data) {
    this.teams = data.teams.map(t => {
      const team = new Team(t.name);
      t.runners.forEach(r => {
        team.runners.push(
          new Runner(
            r.name,
            r.place,
            r.time,
            r.effectivePlace,
            r.points,
            r.team || t.name
          )
        );
      });
      return team;
    });
    this.recalcAll();
  }
  recalcAll() {
    this.teams.forEach(team => {
      team.runners.sort((a, b) => a.time - b.time);
      team.runners.forEach((r, idx) => (r.isDisplacer = idx < 7));
    });
    const displacers = this.teams
      .flatMap(team => team.runners.filter(r => r.isDisplacer))
      .sort((a, b) => a.time - b.time);
    displacers.forEach((r, i) => (r.effectivePlace = i + 1));
    this.teams
      .flatMap(team => team.runners)
      .filter(r => !r.isDisplacer)
      .forEach(r => (r.effectivePlace = null));
    this.teams.forEach(team => {
      team.runners.forEach((r, idx) => {
        r.points = idx < 5 && r.effectivePlace != null ? r.effectivePlace : null;
      });
      team.calculateScore();
    });
    this.teams = this.teams.filter(t => t.runners.length);
    this.teams.sort((a, b) => {
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
  }
}

// build meet object represenation from snapshot
const meet = new Meet(snapshot);

// Hook up the existing “Save as Excel” button to the corresponding logic
const saveBtn = document.getElementById('saveExcelBtn');
saveBtn.addEventListener('click', async () => {
  const individuals = meet.teams
    .flatMap(team => team.runners.map(r => ({
      Place: r.effectivePlace || '',
      Name: r.name,
      Team: r.team,
      Time: formatTime(r.time),
      Points: r.points != null ? r.points : ''
    })));

  const teams = meet.teams.map((t, i) => ({
    Place: i + 1,
    Team: t.name,
    Score: t.score != null ? t.score : ''
  }));

  const result = await window.api.saveMeet({ individuals, teams });
  if (!result.success) {
    alert('Save failed: ' + result.error);
  }
});

// DOM refs
const indBody = document.querySelector('#ind-table tbody');
const teamBody = document.querySelector('#team-table tbody');
const form = document.getElementById('addRunnerForm');
const inpName = document.getElementById('newName');
const inpTeam = document.getElementById('newTeam');
const inpPlace = document.getElementById('newPlace');

// Format decimal-minutes to mm:ss.d (Could add logic to handle hours too but will do another time)
function formatTime(t) {
  const minInt = Math.floor(t);
  const secondsTotal = (t - minInt) * 60;
  const secInt = Math.floor(secondsTotal);
  const tenths = Math.floor((secondsTotal - secInt) * 10);
  const secStr = secInt.toString().padStart(2, '0');
  return `${minInt}:${secStr}.${tenths}`;
}

// render everything
function render() {
  meet.recalcAll();
  const allRunners = meet.teams
    .flatMap(t => t.runners)
    .sort((a, b) => a.time - b.time);

  // — individuals —
  indBody.innerHTML = '';
  allRunners.forEach((r, idx) => {
    const tr = document.createElement('tr');

    // delete button
    const del = document.createElement('td');
    del.innerHTML = `<button class="delete-btn">🗑️</button>`;
    del.querySelector('button').onclick = () => {
      const team = meet.teams.find(t => t.name === r.team);
      if (team) team.runners = team.runners.filter(x => x !== r);
      render();
    };
    tr.appendChild(del);

    // Place (using <input>)
    const tdP = document.createElement('td');
    const inpP = document.createElement('input');
    inpP.type = 'number';
    inpP.value = idx + 1;
    inpP.min = '1';
    inpP.style.width = '3em';
    inpP.addEventListener('change', () => {
      const newPlace = parseInt(inpP.value) || idx + 1;
      adjustTimeByPlace(r, newPlace, allRunners);
      render();
    });
    // ensure click brings window + input focus
    inpP.addEventListener('click', () => {
      window.focus();
      inpP.focus();
    });
    tdP.appendChild(inpP);
    tr.appendChild(tdP);

    // Name (non-editable)
    const tdN = document.createElement('td');
    tdN.textContent = r.name;
    tr.appendChild(tdN);

    // Team (non-editable)
    const tdT = document.createElement('td');
    tdT.textContent = r.team;
    tr.appendChild(tdT);

    // Time (read-only)
    const tdTi = document.createElement('td');
    tdTi.textContent = formatTime(r.time);
    tr.appendChild(tdTi);

    // Points (read-only)
    const tdPts = document.createElement('td');
    tdPts.textContent = r.points ?? '—';
    tr.appendChild(tdPts);

    indBody.appendChild(tr);
  });

  // — team scores —
  teamBody.innerHTML = '';
  meet.teams.forEach((t, i) => {
    const tr = document.createElement('tr');
    ;[i + 1, t.name, t.score == null ? '—' : t.score].forEach(txt => {
      const td = document.createElement('td');
      td.textContent = txt;
      tr.appendChild(td);
    });
    teamBody.appendChild(tr);
  });
}

// add-runner form handler
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = inpName.value.trim();
  const team = inpTeam.value.trim();
  const place = parseInt(inpPlace.value);
  if (!name || !team || !place) return;

  const placeholderTime = meet.teams
    .flatMap(t => t.runners.map(r => r.time))
    .reduce((m, t) => Math.max(m, t), 0) + 0.05;
  const run = new Runner(name, place, placeholderTime, null, null, team);
  let tm = meet.teams.find(t => t.name === team);
  if (!tm) {
    tm = new Team(team);
    meet.teams.push(tm);
  }
  tm.runners.push(run);

  const all = meet.teams
    .flatMap(t => t.runners)
    .sort((a, b) => a.time - b.time);
  adjustTimeByPlace(run, place, all);

  inpName.value = inpTeam.value = inpPlace.value = '';
  render();
});

// adjust a runner’s time when place is edited or on add
function adjustTimeByPlace(runner, newPlace, sortedAll) {
  const n = sortedAll.length;
  if (newPlace < 1 || newPlace > n) return;
  const oldIdx = sortedAll.indexOf(runner);
  const oldPlace = oldIdx + 1;
  const movingDown = newPlace > oldPlace;
  const timeAt = i => sortedAll[i]?.time;

  if (newPlace === 1) {
    runner.time = timeAt(0) - 0.05;
  } else if (newPlace === n) {
    runner.time = timeAt(n - 1) + 0.05;
  } else if (movingDown) {
    runner.time = (timeAt(newPlace - 1) + timeAt(newPlace)) / 2;
  } else {
    runner.time = (timeAt(newPlace - 2) + timeAt(newPlace - 1)) / 2;
  }
}

// when the window gets OS-focus back, auto-focus the name field and clicks anywhere in the body should bring window focus
window.addEventListener('focus', () => {
  const first = document.getElementById('newName');
  if (first) first.focus();
});

document.body.addEventListener('mousedown', () => {
  window.focus();
});

// Initial render
render();
