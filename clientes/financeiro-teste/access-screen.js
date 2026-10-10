// Coordinates registration with asynchronous session recovery; contains no credentials.
export function createAccessScreen(){
 let state='restoring';const listeners=new Set();
 return {get state(){return state},set(next){state=next;for(const fn of listeners)fn(state)},subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn)}};
}
export const accessScreen=createAccessScreen();
