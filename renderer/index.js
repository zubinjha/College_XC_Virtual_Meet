// renderer/index.js
// must match preload.exposeInMainWorld key:
const { scrapeMeet } = window.api;

let tablesByName = {};
let selectedRaceName = '';

// STEP 1 → load & scrape
document.getElementById('loadBtn')
  .addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value.trim();
    const errDiv = document.getElementById('step1Error');
    errDiv.textContent = '';
    if (!url) {
      errDiv.textContent = 'Please enter a meet URL.';
      return;
    }

    const resp = await scrapeMeet(url);
    if (!resp || !resp.success && !resp.data) {
      errDiv.textContent = 'Failed to fetch. Check console for errors.';
      return;
    }
    const meet = resp.success ? resp.data : resp;
    tablesByName = meet.tables;

    // build race radio buttons
    const raceForm = document.getElementById('raceForm');
    raceForm.innerHTML = '';
    Object.keys(tablesByName).forEach(name => {
      const label = document.createElement('label');
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'race'; r.value = name;
      r.addEventListener('change', () => {
        selectedRaceName = name;
        document.getElementById('toTeams').disabled = false;
      });
      label.appendChild(r);
      label.append(name);
      raceForm.appendChild(label);
    });

    // show step 2
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
  });

// STEP 2 → choose race → show teams
document.getElementById('toTeams')
  .addEventListener('click', () => {
    if (!selectedRaceName) return;

    const runners = tablesByName[selectedRaceName];
    const teams = Array.from(
      new Set(runners.map(r => r.TEAM).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const teamForm = document.getElementById('teamForm');
    teamForm.innerHTML = '';
    teams.forEach(team => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = team;
      cb.addEventListener('change', () => {
        const any = teamForm.querySelectorAll('input:checked').length > 0;
        document.getElementById('importBtn').disabled = !any;
      });
      label.appendChild(cb);
      label.append(team);
      teamForm.appendChild(label);
    });

    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
  });

// STEP 3 → import → reset back to STEP 1
document.getElementById('importBtn')
  .addEventListener('click', () => {
    const picked = Array.from(
      document.querySelectorAll('#teamForm input:checked')
    ).map(cb => cb.value);

    let runners = tablesByName[selectedRaceName]
      .filter(r => picked.includes(r.TEAM));

    // apply seconds→minutes adjustment
    const sec = parseFloat(document.getElementById('adjustInput').value) || 0;
    const delta = sec / 60;
    runners = runners.map(r => ({
      ...r,
      TIME: +(r.TIME + delta).toFixed(3)
    }));

    console.log('Imported race:', selectedRaceName);
    console.log('Teams:', picked);
    console.log('Runners (with adjusted times):', runners);

    alert(`
      Imported "${selectedRaceName}"
      Teams: ${picked.join(', ')}
      Runners: ${runners.length}
    `);

    // reset UI to step 1
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('toTeams').disabled = true;
    document.getElementById('importBtn').disabled = true;
    document.getElementById('urlInput').value = '';
    selectedRaceName = '';
    tablesByName = {};
  });
