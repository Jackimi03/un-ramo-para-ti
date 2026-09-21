const experience = document.querySelector('#experience');
const startGift = document.querySelector('#start-gift');
const replay = document.querySelector('#replay');
const finalMessage = document.querySelector('#final-message');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let completionTimer;

function completeExperience() {
  experience.dataset.state = 'complete';
  experience.classList.remove('playing');
  experience.classList.add('complete');
  finalMessage.setAttribute('aria-hidden', 'false');
  replay.focus({ preventScroll: true });
}

function playExperience({ replaying = false } = {}) {
  window.clearTimeout(completionTimer);

  experience.classList.remove('complete', 'playing');
  experience.dataset.state = replaying ? 'resetting' : 'playing';
  finalMessage.setAttribute('aria-hidden', 'true');

  void experience.offsetWidth;

  requestAnimationFrame(() => {
    experience.dataset.state = 'playing';
    experience.classList.add('playing');
    completionTimer = window.setTimeout(
      completeExperience,
      reduceMotion.matches ? 850 : 9100,
    );
  });
}

startGift.addEventListener('click', () => playExperience());
replay.addEventListener('click', () => playExperience({ replaying: true }));

document.addEventListener('visibilitychange', () => {
  experience.classList.toggle('is-paused', document.hidden);
});
