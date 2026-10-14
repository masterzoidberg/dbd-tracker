import {characters,perkById} from '../data/catalog.js';
import {isAvailable} from './model.js';

export function suggestedP1Targets(save) {
  return characters.filter(character=>save.characters[character.id]?.owned)
    .map(character=>({character,missing:character.nativePerkIds.filter(id=>!isAvailable(save,perkById[id])).length}))
    .filter(row=>row.missing>0)
    .sort((a,b)=>b.missing-a.missing||save.characters[b.character.id].bloodwebLevel-save.characters[a.character.id].bloodwebLevel||a.character.name.localeCompare(b.character.name))
    .slice(0,5);
}

export function recentCharacters(save,limit=5) {
  const instant=character=>Date.parse(save.characters[character.id]?.updatedAt);
  return characters.filter(character=>Number.isFinite(instant(character)))
    .sort((a,b)=>instant(b)-instant(a)||a.name.localeCompare(b.name)).slice(0,limit);
}

export function favoriteCharacters(save) {
  return characters.filter(character=>save.characters[character.id]?.favorite)
    .sort((a,b)=>a.name.localeCompare(b.name));
}
