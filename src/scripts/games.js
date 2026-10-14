export function matchesGame(name, tags, search, selectedTags) {
  return name.toLocaleLowerCase('en').includes(search.trim().toLocaleLowerCase('en'))
    && [...selectedTags].every(tag => tags.includes(tag));
}

export function initGames(root) {
  const search = root.querySelector('#game-search');
  const buttons = [...root.querySelectorAll('[data-game-tag]')];
  const rows = [...root.querySelectorAll('[data-game-name]')];
  const selected = new Set();
  const update = () => {
    let visible = 0;
    for (const row of rows) {
      row.hidden = !matchesGame(row.dataset.gameName, row.dataset.gameTags.split(' '), search.value, selected);
      if (!row.hidden) visible++;
    }
    root.querySelector('.game_empty').hidden = visible !== 0;
  };
  search.addEventListener('input', update);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const tag = button.dataset.gameTag;
      if (selected.has(tag)) selected.delete(tag);
      else selected.add(tag);
      button.setAttribute('aria-pressed', String(selected.has(tag)));
      update();
    });
  }
  root.querySelector('.game_filters').hidden = false;
  update();
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-games-index]').forEach(initGames);
}
