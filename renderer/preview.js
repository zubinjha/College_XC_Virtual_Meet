// renderer/preview.js

// ← pull from localStorage
const raw = localStorage.getItem('virtualMeet');
if (!raw) {
  document.body.innerHTML =
    '<div style="padding:20px;color:red;">No meet data found.</div>';
  throw new Error('No meet data');
}
const snapshot = JSON.parse(raw);

// — model classes (unchanged) —
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
    // per-team sort & mark displacers
    this.teams.forEach(team => {
      team.runners.sort((a, b) => a.time - b.time);
      team.runners.forEach((r, idx) => (r.isDisplacer = idx < 7));
    });
    // global effective places
    const displacers = this.teams
      .flatMap(team => team.runners.filter(r => r.isDisplacer))
      .sort((a, b) => a.time - b.time);
    displacers.forEach((r, i) => (r.effectivePlace = i + 1));
    // non-displacers get null
    this.teams
      .flatMap(team => team.runners)
      .filter(r => !r.isDisplacer)
      .forEach(r => (r.effectivePlace = null));
    // assign points & calc team score
    this.teams.forEach(team => {
      team.runners.forEach((r, idx) => {
        r.points = idx < 5 && r.effectivePlace != null ? r.effectivePlace : null;
      });
      team.calculateScore();
    });
    // drop empty & sort teams by score
    this.teams = this.teams.filter(t => t.runners.length);
    this.teams.sort((a, b) => {
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
  }
}

// build meet
const meet = new Meet(snapshot);

// DOM refs
const indBody = document.querySelector('#ind-table tbody');
const teamBody = document.querySelector('#team-table tbody');
const form = document.getElementById('addRunnerForm');
const inpName = document.getElementById('newName');
const inpTeam = document.getElementById('newTeam');
const inpPlace = document.getElementById('newPlace');

// render everything
function render() {
  meet.recalcAll();
  // flatten & sort by time
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

    // Place (editable, raw index)
    const tdP = document.createElement('td');
    tdP.textContent = idx + 1;
    tdP.contentEditable = true;
    tdP.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newPlace = parseInt(tdP.textContent) || idx + 1;
        adjustTimeByPlace(r, newPlace, allRunners);
        render();
      }
    });
    tr.appendChild(tdP);

    // Name (editable)
    const tdN = document.createElement('td');
    tdN.textContent = r.name;
    tdN.contentEditable = true;
    tdN.addEventListener('blur', () => {
      r.name = tdN.textContent.trim();
      render();
    });
    tr.appendChild(tdN);

    // Team (editable)
    const tdT = document.createElement('td');
    tdT.textContent = r.team;
    tdT.contentEditable = true;
    tdT.addEventListener('blur', () => {
      const old = r.team;
      const nw = tdT.textContent.trim();
      if (nw && nw !== old) {
        r.team = nw;
        const tOld = meet.teams.find(t => t.name === old);
        let tNew = meet.teams.find(t => t.name === nw);
        if (!tNew) {
          tNew = new Team(nw);
          meet.teams.push(tNew);
        }
        if (tOld) tOld.runners = tOld.runners.filter(x => x !== r);
      }
      render();
    });
    tr.appendChild(tdT);

    // Time (read-only)
    const tdTi = document.createElement('td');
    tdTi.textContent = r.time.toFixed(3);
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

// add‐runner form handler
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = inpName.value.trim();
  const team = inpTeam.value.trim();
  const place = parseInt(inpPlace.value);
  if (!name || !team || !place) return;

  // create runner with placeholder time
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

  // immediately adjust their time so they land at 'place'
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
    // when moving down, average between newPlace and one below
    runner.time = (timeAt(newPlace - 1) + timeAt(newPlace)) / 2;
  } else {
    // moving up, average between one above and newPlace
    runner.time = (timeAt(newPlace - 2) + timeAt(newPlace - 1)) / 2;
  }
}

// initial render
render();
