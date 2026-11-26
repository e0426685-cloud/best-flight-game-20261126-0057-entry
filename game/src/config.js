// Island Hopper — Sky Courier: tuning constants and the world layout.
// One clear job: every number the flight model, the renderer and the missions
// share lives here, so a balance change touches exactly one file.

export const CONFIG = {
  // World: metres. x east, z north, y up. Sea level is y = 0.
  world: {
    islandCount: 7,
    seaLevel: 0,
    maxTerrainHeight: 190,
  },
  // Flight model (speeds in knots, distances in metres, angles in radians).
  plane: {
    maxSpeedKts: 210,
    cruiseSpeedKts: 150,
    stallSpeedKts: 58,
    accelPerSec: 26,
    climbFactor: 0.62,
    turnRatePerRoll: 0.55,
    rollSpeed: 2.4,
    pitchSpeed: 1.1,
    pitchMax: 0.42,
    rollMax: 1.05,
    fuelCapacity: 100,
    fuelBurnPerSec: 0.55,
    damagePerHardHit: 34,
    safeDescentFpm: 620,
    safeTouchdownKts: 95,
    runwayMarginM: 26,
  },
  // Camera: chase view behind and above the plane.
  camera: {
    distanceM: 26,
    heightM: 7.5,
    pitchDown: 0.10,
    fovDeg: 68,
  },
  // Scoring.
  score: {
    ring: 250,
    landingPerfect: 500,
    landingGood: 250,
    legTimeBonusPerSec: 4,
    crashPenalty: 150,
  },
  // Missions: three legs. Each leg names its departure strip, its rings
  // (x, z, altitude in feet, radius in metres) and its arrival strip.
  legs: [
    {
      name: 'Leg 1 — Coral Bay to Turtle Rock',
      from: 'coral',
      to: 'turtle',
      brief: 'Take off from Coral Bay, thread all five rings, land at Turtle Rock.',
      rings: [
        { x: 120, z: 420, altFt: 900, r: 34 },
        { x: -260, z: 780, altFt: 1100, r: 34 },
        { x: 180, z: 1150, altFt: 1000, r: 30 },
        { x: -80, z: 1520, altFt: 1200, r: 30 },
        { x: 240, z: 1850, altFt: 900, r: 34 },
      ],
    },
    {
      name: 'Leg 2 — Turtle Rock to Gull Point',
      from: 'turtle',
      to: 'gull',
      brief: 'Low run over the lagoon: six rings, then put her down at Gull Point.',
      rings: [
        { x: 620, z: 2250, altFt: 700, r: 30 },
        { x: 980, z: 2560, altFt: 800, r: 30 },
        { x: 760, z: 2920, altFt: 650, r: 28 },
        { x: 1180, z: 3180, altFt: 900, r: 30 },
        { x: 900, z: 3500, altFt: 750, r: 28 },
        { x: 1240, z: 3780, altFt: 700, r: 30 },
      ],
    },
    {
      name: 'Leg 3 — Gull Point home to Coral Bay',
      from: 'gull',
      to: 'coral',
      brief: 'Final leg: climb over the ridge, seven rings, home to Coral Bay.',
      rings: [
        { x: 900, z: 3300, altFt: 1400, r: 32 },
        { x: 480, z: 2900, altFt: 1600, r: 32 },
        { x: 120, z: 2500, altFt: 1500, r: 30 },
        { x: -320, z: 2050, altFt: 1300, r: 30 },
        { x: 60, z: 1600, altFt: 1100, r: 30 },
        { x: -180, z: 1150, altFt: 900, r: 30 },
        { x: 40, z: 700, altFt: 800, r: 32 },
      ],
    },
  ],
  // Airstrips: centre (x, z), heading in degrees, length and width in metres.
  strips: {
    coral: { name: 'Coral Bay', x: 0, z: 0, headingDeg: 0, lengthM: 420, widthM: 34 },
    turtle: { name: 'Turtle Rock', x: 420, z: 2100, headingDeg: 12, lengthM: 380, widthM: 30 },
    gull: { name: 'Gull Point', x: 1150, z: 4050, headingDeg: -8, lengthM: 400, widthM: 30 },
  },
  palette: {
    skyTop: '#2f6fb8',
    skyMid: '#7fb2e0',
    skyHorizon: '#cfe8f2',
    seaDeep: '#14506e',
    seaShallow: '#2f8aa8',
    sand: '#e3cd96',
    grass: '#5d9b4a',
    forest: '#2f6b34',
    rock: '#8a7f74',
    snow: '#e8eef2',
    runway: '#3a3f46',
    runwayEdge: '#f2f2e8',
    ring: '#ffcf3d',
    ringNext: '#ffb400',
    planeBody: '#e8502e',
    planeWing: '#f4f1e6',
    planeTrim: '#1d3a5f',
    hudAmber: '#ffc857',
    hudGreen: '#7ee081',
    hudRed: '#ff6b5e',
  },
};

// Knots <-> metres per second, feet <-> metres.
export const KTS_TO_MS = 0.514444;
export const FT_TO_M = 0.3048;
export const M_TO_FT = 1 / FT_TO_M;
