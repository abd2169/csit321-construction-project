// Demo data only (SRS AS-4). Replace with API calls to FastAPI /api/v1 later.
const STAGES = [
  { id: 'col', name: 'Columns', w: 20 },
  { id: 'slab', name: 'Slab', w: 25 },
  { id: 'wall', name: 'Walls', w: 25 },
  { id: 'win', name: 'Windows', w: 15 },
  { id: 'fin', name: 'Finishing', w: 15 },
];
// a = actual stage completion %, p = planned stage completion %, null = no photos yet
const FLOORS = [
  { n: 1, a: [100,100,100,100,100], p: [100,100,100,100,100] },
  { n: 2, a: [100,100,100,90,60],   p: [100,100,100,100,67] },
  { n: 3, a: [100,100,40,0,0],      p: [100,100,88,0,0] },
  { n: 4, a: [100,70,0,0,0],        p: [100,100,0,0,0] },
  { n: 5, a: [80,0,0,0,0],          p: [100,0,0,0,0] },
  { n: 6, a: [30,0,0,0,0],          p: [40,0,0,0,0] },
  { n: 7, a: null, p: [0,0,0,0,0] }, { n: 8, a: null, p: [0,0,0,0,0] },
  { n: 9, a: null, p: [0,0,0,0,0] }, { n: 10, a: null, p: [0,0,0,0,0] },
  { n: 11, a: null, p: [0,0,0,0,0] }, { n: 12, a: null, p: [0,0,0,0,0] },
];
const PROJECTS = [
  { id: 1, name: 'Marina Heights Tower', loc: 'Dubai Marina', floors: 12 },
  { id: 2, name: 'Al Quoz Warehouse Block', loc: 'Al Quoz, Dubai', floors: 4 },
  { id: 3, name: 'JVC Residence B', loc: 'Jumeirah Village Circle', floors: 8 },
];
const USERS = [
  { name: 'Anuj Pachava', email: 'anuj@buildpulse.demo', role: 'Administrator' },
  { name: 'Taha Imran', email: 'taha@buildpulse.demo', role: 'Project Manager' },
  { name: 'Site Team A', email: 'site.a@contractor.demo', role: 'Site Engineer' },
  { name: 'Owner Rep', email: 'owner@client.demo', role: "Owner's Representative" },
];
const QUEUE = [
  { floor: 5, stage: 'Columns', sug: 80, conf: 0.45 },
  { floor: 6, stage: 'Columns', sug: 30, conf: 0.52 },
  { floor: 4, stage: 'Slab', sug: 70, conf: 0.58 },
];
const HISTORY = { planned: [0,8,17,26,34,42,49,56], actual: [0,7,15,23,30,38,45] };
const WEEKS = ['W1','W2','W3','W4','W5','W6','W7','W8'];
