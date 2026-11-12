/** 速度以規則層的 px/s 計算，長度回傳場景單位。 */
export function trailStyle(speed:number, disabled=false) {
  const strength=Math.max(0,Math.min(1,(speed-220)/1630));
  return {length:disabled?0:strength*1.35,opacity:disabled?0:strength*.85};
}

export interface BadgeCandidate {id:number;x:number;y:number;priority:number}
/** 每個圓牌的保留區為 30 CSS px；穩定排序避免同權重互相搶位。 */
export function selectBadges(candidates:BadgeCandidate[],width:number,height:number) {
  const accepted:BadgeCandidate[]=[];
  for(const badge of [...candidates].sort((a,b)=>b.priority-a.priority||a.id-b.id)){
    if(badge.x<15||badge.y<15||badge.x>width-15||badge.y>height-15)continue;
    if(accepted.some(other=>Math.hypot(other.x-badge.x,other.y-badge.y)<30))continue;
    accepted.push(badge);
  }
  return new Set(accepted.map(badge=>badge.id));
}
