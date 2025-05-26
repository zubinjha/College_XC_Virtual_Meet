// models/models.js

/** Represents an individual runner’s result */
class Runner {
  constructor(name, place, time) {
    this.name = name
    this.place = place
    this.time = time     // in minutes (float)
    this.effectivePlace = null
    this.points = null
  }
}

/** Represents a team */
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
      .sort((a,b)=>a-b)
    this.scoreList = places.slice(0,5)
    this.score = this.scoreList.length===5
      ? this.scoreList.reduce((sum,p)=>sum+p,0)
      : null
  }
}

/** Represents an entire meet */
class Meet {
  constructor() {
    this.teams = []
  }
  addTeam(team) {
    this.teams.push(team)
  }
  calculateAllTeamScores() {
    this.teams.forEach(t=>t.calculateScore())
    this.teams.sort((a,b)=>{
      if (a.score==null) return 1
      if (b.score==null) return -1
      return a.score - b.score
    })
  }
}

module.exports = { Runner, Team, Meet }
