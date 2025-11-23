// renderer/index.js

// Need bridge to scrape meet
const { scrapeMeet } = window.api

// Memory Classes for storing meet representation 
class Runner {
  constructor(name, place, time) {
    this.name = name
    this.place = place
    this.time = time    // Stored as minutes as a float, needs to be converted on render to normal format
    this.effectivePlace = null
    this.points = null
  }
}

class Team {
  constructor(name) {
    this.name = name
    this.runners = []
    this.scoreList = []
    this.score = null
  }
  addRunner(runner) {
    this.runners.push(runner)
  }
  calculateScore() {
    const places = this.runners
      .map(r => r.effectivePlace)
      .filter(p => typeof p === 'number')
      .sort((a, b) => a - b)
    this.scoreList = places.slice(0, 5)
    this.score =
      this.scoreList.length === 5
        ? this.scoreList.reduce((sum, p) => sum + p, 0)
        : null
  }
}

class Meet {
  constructor() {
    this.teams = []
  }
  addTeam(t) {
    this.teams.push(t)
  }
  calculateAllTeamScores() {
    this.teams.forEach(t => t.calculateScore())
    this.teams.sort((a, b) => {
      if (a.score == null) return 1
      if (b.score == null) return -1
      return a.score - b.score
    })
  }
}

// — state & refs —
let tablesByName = {}
let selectedRaceName = ''
let currentMeetMeta = null
const importedRaces = []
const meet = new Meet()

const step1      = document.getElementById('step1')
const step2      = document.getElementById('step2')
const step3      = document.getElementById('step3')
const loadBtn    = document.getElementById('loadBtn')
const previewBtn = document.getElementById('previewBtn')
const toTeams    = document.getElementById('toTeams')
const importBtn  = document.getElementById('importBtn')
const errDiv     = document.getElementById('step1Error')
const summarySection = document.getElementById('importSummary')
const summaryList = document.getElementById('importList')

const formatAdjustment = secs => {
  const val = Number(secs) || 0
  if (!val) return 'Adjustment: +0s'
  const prefix = val > 0 ? '+' : ''
  return `Adjustment: ${prefix}${val}s`
}

function renderImportedRaces() {
  if (!summarySection || !summaryList) return
  if (!importedRaces.length) {
    summarySection.classList.add('hidden')
    summaryList.innerHTML = '<p class="import-empty">No races imported yet.</p>'
    return
  }

  summarySection.classList.remove('hidden')
  summaryList.innerHTML = ''
  importedRaces.forEach(entry => {
    const card = document.createElement('article')
    card.className = 'import-card'

    const header = document.createElement('div')
    header.className = 'import-card-header'

    const info = document.createElement('div')
    const meetEl = document.createElement('div')
    meetEl.className = 'import-meet'
    meetEl.textContent = entry.meetName
    const raceEl = document.createElement('div')
    raceEl.className = 'import-race'
    raceEl.textContent = entry.raceName
    info.appendChild(meetEl)
    info.appendChild(raceEl)

    const dateEl = document.createElement('div')
    dateEl.className = 'import-date'
    dateEl.textContent = formatAdjustment(entry.adjustment)

    header.appendChild(info)
    header.appendChild(dateEl)

    const list = document.createElement('ul')
    list.className = 'import-team-list'
    if (entry.teams.length === 0) {
      const li = document.createElement('li')
      li.textContent = 'No teams selected'
      list.appendChild(li)
    } else {
      entry.teams.forEach(team => {
        const li = document.createElement('li')
        li.textContent = team
        list.appendChild(li)
      })
    }

    card.appendChild(header)
    card.appendChild(list)
    summaryList.appendChild(card)
  })
}

renderImportedRaces()

// STEP 1 → load & scrape
loadBtn.addEventListener('click', async () => {
  errDiv.textContent = ''
  const url = document.getElementById('urlInput').value.trim()
  if (!url) return errDiv.textContent = 'Please enter a meet URL.'

  const res = await scrapeMeet(url)
  if (!res || !res.success) {
    return errDiv.textContent = 'Fetch failed. Check console.'
  }

  tablesByName = res.data.tables
  currentMeetMeta = {
    name: res.data.name || 'Imported Meet',
    date: res.data.date || ''
  }

  // build the race‐radio list
  const rf = document.getElementById('raceForm')
  rf.innerHTML = ''
  Object.keys(tablesByName).forEach(name => {
    const lbl = document.createElement('label')
    const r   = document.createElement('input')
    r.type = 'radio'
    r.name = 'race'
    r.value = name
    r.onchange = () => {
      selectedRaceName = name
      toTeams.disabled = false
    }
    lbl.appendChild(r)
    lbl.append(name)
    rf.appendChild(lbl)
  })

  step1.classList.add('hidden')
  step2.classList.remove('hidden')
})

// STEP 2 → pick race → show teams
toTeams.addEventListener('click', () => {
  const runners = tablesByName[selectedRaceName]
  const teams   = Array.from(new Set(runners.map(r => r.TEAM))).sort()
  const tf = document.getElementById('teamForm')
  tf.innerHTML = ''

  teams.forEach(teamName => {
    const lbl = document.createElement('label')
    const cb  = document.createElement('input')
    cb.type = 'checkbox'
    cb.value = teamName
    cb.onchange = () => {
      importBtn.disabled = tf.querySelectorAll('input:checked').length === 0
    }
    lbl.appendChild(cb)
    lbl.append(teamName)
    tf.appendChild(lbl)
  })

  step2.classList.add('hidden')
  step3.classList.remove('hidden')
})

// STEP 3 → import into your Meet + recalc
importBtn.addEventListener('click', () => {
  const adjustSec = parseFloat(document.getElementById('adjustInput').value) || 0
  const pickedTeams = Array.from(
    document.querySelectorAll('#teamForm input:checked')
  ).map(cb => cb.value)

  const rows = tablesByName[selectedRaceName].filter(r =>
    pickedTeams.includes(r.TEAM)
  )

  rows.forEach(r => {
    const time = r.TIME + adjustSec / 60
    const runner = new Runner(r.NAME, r.PLACE, time)
    let team = meet.teams.find(t => t.name === r.TEAM)
    if (!team) {
      team = new Team(r.TEAM)
      meet.addTeam(team)
    }
    team.addRunner(runner)
  })

  // recalc effectivePlace & team‐scores
  const all = meet.teams.flatMap(t => t.runners)
  all.sort((a, b) => a.time - b.time).forEach((r, i) => {
    r.effectivePlace = i + 1
  })

  meet.calculateAllTeamScores()

  // enable preview if we have data
  previewBtn.disabled = all.length === 0

  importedRaces.push({
    meetName: (currentMeetMeta && currentMeetMeta.name) || 'Imported Meet',
    raceName: selectedRaceName || 'Race',
    adjustment: adjustSec,
    teams: pickedTeams.slice().sort((a, b) => a.localeCompare(b))
  })
  renderImportedRaces()

  // --- RESET FORM FIELDS ---
  document.getElementById('urlInput').value = ''
  document.getElementById('adjustInput').value = '0'
  toTeams.disabled    = true
  importBtn.disabled  = true

  // go back to step 1, with blue button on
  step3.classList.add('hidden')
  step1.classList.remove('hidden')
})

// “Preview Virtual Meet”
previewBtn.addEventListener('click', () => {
  const snapshot = {
    teams: meet.teams.map(team => ({
      name: team.name,
      runners: team.runners.map(r => ({
        name: r.name,
        place: r.place,
        time: r.time,
        effectivePlace: r.effectivePlace,
        points: r.points
      }))
    }))
  }

  localStorage.setItem('virtualMeet', JSON.stringify(snapshot))
  window.location.href = 'preview.html'
})
