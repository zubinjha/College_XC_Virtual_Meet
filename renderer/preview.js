// renderer/preview.js

// ← pull from localStorage now
const raw = localStorage.getItem('virtualMeet')
if (!raw) {
  document.body.innerHTML =
    '<div style="padding:20px;color:red;">No meet data found.</div>'
  throw new Error('No meet data')
}
const snapshot = JSON.parse(raw)

// — in-memory model classes —
class Runner {
  constructor(name, place, time, eff, pts, team) {
    this.name = name
    this.place = place
    this.time = time
    this.effectivePlace = eff
    this.points = pts
    this.team = team
    this.isDisplacer = false
  }
}

class Team {
  constructor(name) {
    this.name = name
    this.runners = []
    this.scoreList = []
    this.score = null
  }
  calculateScore() {
    // sum the first 5 non-null points
    const pts = this.runners
      .map(r => r.points)
      .filter(v => typeof v === 'number')
      .slice(0, 5)
    this.scoreList = pts
    this.score = pts.length === 5
      ? pts.reduce((s, v) => s + v, 0)
      : null
  }
}

class Meet {
  constructor(data) {
    this.teams = data.teams.map(t => {
      const team = new Team(t.name)
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
        )
      })
      return team
    })
    this.recalcAll()
  }

  recalcAll() {
    // 1) Per-team: sort by time, mark top 7 as displacers
    this.teams.forEach(team => {
      team.runners.sort((a, b) => a.time - b.time)
      team.runners.forEach((r, idx) => {
        r.isDisplacer = idx < 7
      })
    })

    // 2) Gather all displacers and assign global effectivePlace
    const displacers = this.teams
      .flatMap(team => team.runners.filter(r => r.isDisplacer))
      .sort((a, b) => a.time - b.time)

    displacers.forEach((r, i) => {
      r.effectivePlace = i + 1
    })

    // 3) Runners beyond 7th get no effectivePlace
    this.teams
      .flatMap(team => team.runners)
      .filter(r => !r.isDisplacer)
      .forEach(r => {
        r.effectivePlace = null
      })

    // 4) Assign each runner’s points: first 5 per team
    this.teams.forEach(team => {
      team.runners.forEach((r, idx) => {
        r.points = (idx < 5 && r.effectivePlace != null)
          ? r.effectivePlace
          : null
      })
      team.calculateScore()
    })

    // 5) Drop empty teams & sort teams by score
    this.teams = this.teams.filter(t => t.runners.length > 0)
    this.teams.sort((a, b) => {
      if (a.score == null) return 1
      if (b.score == null) return -1
      return a.score - b.score
    })
  }
}

// build the Meet model
const meet = new Meet(snapshot)

// DOM refs
const indBody  = document.querySelector('#ind-table tbody')
const teamBody = document.querySelector('#team-table tbody')

// re-render function
function render() {
  meet.recalcAll()

  // — individuals —
  indBody.innerHTML = ''
  meet.teams
    .flatMap(t => t.runners)
    .sort((a, b) => a.time - b.time)
    .forEach(r => {
      const tr = document.createElement('tr')

      // Place (editable)
      const tdP = document.createElement('td')
      tdP.textContent = r.effectivePlace ?? ''
      tdP.contentEditable = true
      tdP.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          const np = parseInt(tdP.textContent) || r.effectivePlace
          adjustTimeByPlace(r, np)
          render()
        }
      })
      tr.appendChild(tdP)

      // Name (editable)
      const tdN = document.createElement('td')
      tdN.textContent = r.name
      tdN.contentEditable = true
      tdN.addEventListener('blur', () => {
        r.name = tdN.textContent.trim()
        render()
      })
      tr.appendChild(tdN)

      // Team (editable)
      const tdT = document.createElement('td')
      tdT.textContent = r.team
      tdT.contentEditable = true
      tdT.addEventListener('blur', () => {
        const oldTeam = r.team
        const newTeam = tdT.textContent.trim()
        if (newTeam && newTeam !== oldTeam) {
          r.team = newTeam
          const tOld = meet.teams.find(t => t.name === oldTeam)
          let tNew = meet.teams.find(t => t.name === newTeam)
          if (!tNew) {
            tNew = new Team(newTeam)
            meet.teams.push(tNew)
          }
          tOld.runners = tOld.runners.filter(x => x !== r)
          tNew.runners.push(r)
        }
        render()
      })
      tr.appendChild(tdT)

      // Time (read-only)
      const tdTi = document.createElement('td')
      tdTi.textContent = r.time.toFixed(3)
      tr.appendChild(tdTi)

      // Points (read-only)
      const tdPts = document.createElement('td')
      tdPts.textContent = r.points ?? '—'
      tr.appendChild(tdPts)

      indBody.appendChild(tr)
    })

  // — team scores —
  teamBody.innerHTML = ''
  meet.teams.forEach((t, i) => {
    const tr = document.createElement('tr')
    ;[i + 1, t.name, t.score == null ? '—' : t.score].forEach(txt => {
      const td = document.createElement('td')
      td.textContent = txt
      tr.appendChild(td)
    })
    teamBody.appendChild(tr)
  })
}

// adjust a runner’s time when place is edited
function adjustTimeByPlace(runner, newPlace) {
  const all = meet.teams.flatMap(t => t.runners)
    .sort((a, b) => (a.effectivePlace || Infinity) - (b.effectivePlace || Infinity))

  if (newPlace < 1 || newPlace > all.length) return
  let t1 = all[newPlace - 2]?.time
  let t2 = all[newPlace - 1]?.time

  if (newPlace === 1) {
    runner.time = t2 - 0.05
  } else if (newPlace === all.length) {
    runner.time = all[all.length - 1].time + 0.05
  } else {
    runner.time = (t1 + t2) / 2
  }
}

// initial render
render()
