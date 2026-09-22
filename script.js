const experience = document.querySelector('#experience');
const startGift = document.querySelector('#start-gift');
const replay = document.querySelector('#replay');
const finalMessage = document.querySelector('#final-message');
const host = document.querySelector('#bouquet-3d');
const sceneStatus = document.querySelector('#scene-status');
let bouquet;
let restarting = false;
let loadPromise;

function sceneFailure(message) {
  sceneStatus.hidden = false;
  sceneStatus.textContent = message || 'No se pudo abrir el ramo 3D. Toca “Ver florecer otra vez” para reintentarlo.';
  experience.dataset.state = 'complete';
  experience.classList.add('complete');
  replay.disabled = false;
  restarting = false;
}

function prepareScene() {
  if (!loadPromise) {
    loadPromise = import('./bouquet3d.js?v=3d-5').then(({ createBouquet }) => {
      bouquet = createBouquet(host, completeExperience, sceneFailure);
      experience.classList.add('has-3d');
      return bouquet;
    }).catch(error => { loadPromise = null; throw error; });
  }
  return loadPromise;
}

function completeExperience() {
  experience.dataset.state = 'complete';
  experience.classList.remove('playing');
  experience.classList.add('complete');
  finalMessage.setAttribute('aria-hidden', 'false');
  replay.disabled = false;
  sceneStatus.hidden = true;
  restarting = false;
}

async function playExperience({ replaying = false } = {}) {
  if (restarting || experience.dataset.state === 'playing') return;
  restarting = true;
  replay.disabled = true;
  try {
    if (replaying) {
      experience.classList.add('restarting');
      await new Promise(resolve => setTimeout(resolve, 240));
    }
    sceneStatus.hidden = false;
    sceneStatus.textContent = 'Preparando tus flores…';
    const scene = await prepareScene();
    experience.classList.remove('complete', 'playing', 'restarting');
    experience.dataset.state = 'playing';
    finalMessage.setAttribute('aria-hidden', 'true');
    experience.classList.add('playing');
    sceneStatus.hidden = true;
    scene.start();
    restarting = false;
  } catch (error) {
    console.error('Bouquet could not start:', error);
    experience.classList.remove('restarting');
    sceneFailure();
  }
}

startGift.addEventListener('click', () => playExperience());
replay.addEventListener('click', () => playExperience({ replaying: true }));

document.addEventListener('visibilitychange', () => {
  experience.classList.toggle('is-paused', document.hidden);
});

replay.disabled = true;
// Warm the self-hosted module while the invitation is visible.
prepareScene().catch(() => {});
