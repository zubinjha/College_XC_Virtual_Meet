// renderer/index.js
// grab the bridged API
const { scrapeMeet } = window.api

let tablesByName = {}
let selectedRaceName = ''

// STEP 1 → load & scrape
document.getElementById('loadBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim()
  document.getElementById('step1Error').textContent = ''
  if (!url) {
    document.getElementById('step1Error').textContent = 'Please enter a meet URL.'
    return
  }

  const resp = await scrapeMeet(url)
  if (!resp || !resp.success) {
    document.getElementById('step1Error').textContent = 'Failed to fetch. Check console for errors.'
    console.error(resp && resp.error)
    return
  }

  const meet = resp.data

  tablesByName = meet.tables
  const raceForm = document.getElementById('raceForm')
  raceForm.innerHTML = ''

  Object.keys(tablesByName).forEach(name => {
    const label = document.createElement('label')
    const r = document.createElement('input')
    r.type = 'radio'
    r.name = 'race'
    r.value = name
    r.addEventListener('change', () => {
      selectedRaceName = name
      document.getElementById('toTeams').disabled = false
    })
    label.appendChild(r)
    label.append(' ' + name)
    raceForm.appendChild(label)
  })

  document.getElementById('step1').style.display = 'none'
  document.getElementById('step2').style.display = 'block'
})

// STEP 2 → choose race → show teams
document.getElementById('toTeams').addEventListener('click', () => {
  if (!selectedRaceName) return
  const runners = tablesByName[selectedRaceName]
  const teams = Array.from(new Set(runners.map(r => r.TEAM).filter(Boolean)))

  const teamForm = document.getElementById('teamForm')
  teamForm.innerHTML = ''

  teams.forEach(team => {
    const label = document.createElement('label')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.value = team
    cb.addEventListener('change', () => {
      const any = teamForm.querySelectorAll('input:checked').length > 0
      document.getElementById('importBtn').disabled = !any
    })
    label.appendChild(cb)
    label.append(' ' + team)
    teamForm.appendChild(label)
  })

  document.getElementById('step2').style.display = 'none'
  document.getElementById('step3').style.display = 'block'
})

// STEP 3 → import selection into your in-memory model
document.getElementById('importBtn').addEventListener('click', () => {
  const pickedTeams = Array.from(
    document.querySelectorAll('#teamForm input:checked')
  ).map(cb => cb.value)

  const runners = tablesByName[selectedRaceName]
  const filtered = runners.filter(r => pickedTeams.includes(r.TEAM))

  console.log('Importing race:', selectedRaceName)
  console.log('Picked teams:', pickedTeams)
  console.log('Filtered runners:', filtered)

  alert(`
    Imported "${selectedRaceName}"
    Teams: ${pickedTeams.join(', ')}
    Runners: ${filtered.length}
  `)
})
