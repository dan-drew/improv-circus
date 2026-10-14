import { loadYaml } from '../_models/modelUtils.js';
import { buildGames, readDefinitions } from '../_models/game.js';

export default function () {
  return buildGames(
    loadYaml('./data/game_data.yaml'),
    loadYaml('./data/game_tags.yaml'),
    readDefinitions(new URL('../games/definitions/', import.meta.url)),
  );
}
