import survivorSource from './survivor-inventory-verified.json' with {type:'json'};
export const survivorInventorySource = survivorSource;
export const inventoryEntities = adaptInventoryCatalog(survivorSource,'survivor');
export const inventoryEntityById = Object.fromEntries(inventoryEntities.map(entity=>[entity.id,entity]));
export const inventoryCatalogStatus = {
  survivor: 'ready',
  killerAddons: 'unavailable',
  killerPowers: 'unavailable',
};
export const killerPowerByCharacterId = {};

// Source IDs are frozen semantic slugs, never generated from display labels.
export function adaptInventoryCatalog(source,role) {
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const slug=value=>typeof value==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const provenance=value=>value && Array.isArray(value.references) && value.references.length>0
    && value.references.every(url=>{try{return new URL(url).protocol==='https:';}catch{return false;}});
  check(role==='survivor','Unsupported inventory catalog role.');
  check(typeof source.patch==='string' && source.patch && /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt) && provenance(source.provenance),'Malformed catalog provenance.');
  check(Array.isArray(source.itemFamilies) && Array.isArray(source.items) && Array.isArray(source.addons),'Missing catalog collections.');
  const families=new Set();
  for(const family of source.itemFamilies){check(slug(family.id)&&!families.has(family.id),'Duplicate or invalid family.');families.add(family.id);}
  const seen=new Set(), ids=new Set(), entities=[];
  for(const [rows,kind,map] of [[source.items,'survivor-item','items'],[source.addons,'survivor-addon','addons']]){
    for(const row of rows){
      check(!row.kind||row.kind===kind,'Invalid inventory kind.');
      check(typeof row.sourceId==='string','Missing source identity.');
      const parts=row.sourceId.split('/');
      check(parts.length===2&&parts.every(slug)&&parts[0]===row.familyId&&families.has(row.familyId),'Incompatible source identity.');
      const id=kind+'-'+parts.join('-');
      check(!row.id||row.id===id,'Incompatible save identity.');
      check(!seen.has(row.sourceId)&&!ids.has(id),'Duplicate inventory identity.');
      check(typeof row.name==='string'&&row.name&&typeof row.effect==='string'&&row.effect&&provenance(row.provenance),'Missing entity metadata/provenance.');
      seen.add(row.sourceId);ids.add(id);
      entities.push({...structuredClone(row),id,kind,role,map,characterId:null,order:entities.length,
        compatibleItemIds:[],imagePath:row.imagePath??null,description:row.description??null});
    }
  }
  for(const entity of entities.filter(e=>e.map==='addons')){
    const sourceIds=entity.compatibleSourceItemIds;
    check(!sourceIds||Array.isArray(sourceIds)&&sourceIds.every(id=>entities.some(e=>e.sourceId===id&&e.map==='items'&&e.familyId===entity.familyId)),'Invalid compatibility.');
    entity.compatibleItemIds=entities.filter(e=>e.map==='items'&&e.familyId===entity.familyId&&(!sourceIds?.length||sourceIds.includes(e.sourceId))).map(e=>e.id);
  }
  return entities;
}
