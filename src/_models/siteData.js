import { Theater } from "./theater.js";
import { Player } from "./player.js";
import { Show } from "./show.js";
import { loadYaml } from "./modelUtils.js";
import { mapFactory, listFactory } from "./factory.js";

let cached;

export function getSiteData() {
  if (cached) {
    return cached;
  }

  const theaterData = loadYaml("./data/theater_data.yaml");
  const playerData = loadYaml("./data/player_data.yaml");
  const showTypes = loadYaml("./data/show_types.yaml");
  const showData = loadYaml("./data/show_data.yaml");

  const theaters = mapFactory({ theaterData }, "theaterData", Theater);
  const players = mapFactory({ playerData, theaters }, "playerData", Player);
  const shows = listFactory({ showData, showTypes, theaters, players }, "showData", Show);

  cached = JSON.parse(JSON.stringify({
    theaters,
    players,
    shows,
  }));

  cached.allPlayers = Object.values(cached.players)

  console.info('site data: ', cached)

  return cached;
}
