import { parseQuantityInput } from './inventory-quantities.js';

export function createQuantityInteraction(entities, inventory, {mode='detail',inStock=false}={}) {
  const order=[...entities].sort((a,b)=>Number((inventory[b.id]||0)>0)-Number((inventory[a.id]||0)>0)||a.order-b.order||a.id.localeCompare(b.id));
  return {entities:structuredClone(entities),order:order.map(e=>e.id),baseline:{...inventory},
    raw:Object.fromEntries(entities.map(e=>[e.id,String(inventory[e.id]||0)])),pending:{},errors:{},mode,inStock};
}
export function updateQuantityInput(state,id,text) {
  if(!state.entities.some(e=>e.id===id)) throw Error('Unknown inventory editor.');
  const next=structuredClone(state); next.raw[id]=String(text);
  next.pending[id]=next.raw[id]!==String(next.baseline[id]||0); delete next.errors[id]; return next;
}
export function acceptQuantityInput(state,id) {
  const next=structuredClone(state);
  try { const quantity=parseQuantityInput(next.raw[id]); delete next.errors[id]; return {state:next,quantity,error:null}; }
  catch(error) { next.errors[id]=error.message; return {state:next,quantity:null,error:error.message}; }
}
export function visibleQuantityEntries(state,filters={}) {
  const byId=Object.fromEntries(state.entities.map(e=>[e.id,e]));
  return state.order.map(id=>byId[id]).filter(e=>{
    if(filters.map && e.map!==filters.map || filters.family && e.familyId!==filters.family || filters.rarity && e.rarity!==filters.rarity) return false;
    if(filters.search && !(e.name+' '+(e.effect||'')).toLowerCase().includes(filters.search.toLowerCase())) return false;
    return !(filters.inStock??state.inStock) || (state.baseline[e.id]||0)>0 || state.pending[e.id] || state.errors[e.id];
  });
}
export function regroupQuantityEntries(state,committedInventory) {
  return createQuantityInteraction(state.entities,committedInventory,{mode:state.mode,inStock:state.inStock});
}
export function quantityFocusAfterCommit(before,{entityId,nextTargetId,trigger,visibleIds}) {
  if(trigger==='blur' && nextTargetId && visibleIds.includes(nextTargetId)) return nextTargetId;
  if(visibleIds.includes(entityId)) return entityId;
  const index=before.indexOf(entityId);
  return before.slice(index+1).find(id=>visibleIds.includes(id))
    || before.slice(0,index).reverse().find(id=>visibleIds.includes(id)) || 'inventory-search';
}
