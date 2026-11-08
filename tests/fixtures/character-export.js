import { freshSave } from '../../src/model.js';

// Synthetic progress using the representative Dredge export's canonical IDs.
export const characterExportTime = '2026-11-08T12:34:56.000Z';
export function dredgeExportFixture() {
  const save = freshSave();
  save.updatedAt = characterExportTime;
  Object.assign(save.characters['the-dredge'], {
    owned: true, favorite: true, prestige: 1, bloodwebLevel: 33, setupComplete: true,
    notes: 'Locker practice & timing.\nTry a 10.1-second route.', updatedAt: characterExportTime,
    perks: { bamboozle: 3, 'dark-devotion': 2, 'darkness-revealed': 3, 'monitor-abuse': 1 },
    inventory: { items: {}, addons: {
      'killer-addon-dredge-caffeine-tablets': 46,
      'killer-addon-dredge-mortar-and-pestle': 35,
      'killer-addon-dredge-followers-cowl': 31,
    } },
  });
  save.characters['the-doctor'].prestige = 3;
  save.perkOverrides['dark-devotion'] = { shrineTier: 3 };
  save.planning.prestigeQueues.killer.push({ characterId: 'the-dredge', targetPrestige: 2 });
  save.planning.playingQueues.killer.push({ characterId: 'the-dredge' });
  save.planning.upNext.killer.push({ characterId: 'the-dredge', intent: 'prestige' });
  return save;
}
