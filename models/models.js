// models.js

/** Represents an individual runner’s result */
class Runner {
  /**
   * @param {string} name 
   * @param {number} place 
   * @param {number} time  // in minutes (float)
   */
  constructor(name, place, time) {
    this.name = name;
    this.place = place;
    this.time = time;
    this.effectivePlace = null; // for scoring (1–∞)
    this.points = null;         // points earned (or null)
  }
}

/** Represents a team and its runners’ results */
class Team {
  /**
   * @param {string} name 
   */
  constructor(name) {
    this.name = name;
    /** @type {Runner[]} */
    this.runners = [];
    /** @type {number[]} the effective places (first five) */
    this.scoreList = [];
    /** @type {number|null} total points (sum of scoreList) */
    this.score = null;
  }

  /**
   * Add a runner to this team.
   * @param {Runner} runner 
   */
  addRunner(runner) {
    this.runners.push(runner);
  }

  /**
   * Compute this.team’s scoreList & total score:
   * - take each runner’s effectivePlace (if set), sort, take first 5,
   * - sum to this.score, store the list in this.scoreList.
   */
  calculateScore() {
    const places = this.runners
      .map(r => r.effectivePlace)
      .filter(p => typeof p === 'number')
      .sort((a, b) => a - b);
    this.scoreList = places.slice(0, 5);
    if (this.scoreList.length === 5) {
      this.score = this.scoreList.reduce((sum, p) => sum + p, 0);
    } else {
      this.score = null;
    }
  }
}

/** Represents an entire meet (collection of teams) */
class Meet {
  constructor() {
    /** @type {Team[]} */
    this.teams = [];
  }

  /**
   * Add a team to this meet.
   * @param {Team} team 
   */
  addTeam(team) {
    this.teams.push(team);
  }

  /**
   * Once all runners have effectivePlace set, recalc every team’s score.
   */
  calculateAllTeamScores() {
    this.teams.forEach(team => team.calculateScore());
    // Optionally sort teams by score, etc.
    this.teams.sort((a, b) => {
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
  }
}

module.exports = { Runner, Team, Meet };
