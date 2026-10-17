// Original constraint solver. No external puzzle data or solver library.
export function model(n,k,regions) {
 const groups=Array.from({length:3*n},()=>[]), memberships=[], neighbors=[];
 for(let i=0;i<n*n;i++){
  const r=Math.floor(i/n),c=i%n,ms=[r,n+c,2*n+regions[i]];
  memberships.push(ms); for(const g of ms)groups[g].push(i);
  const ns=[];for(let y=Math.max(0,r-1);y<=Math.min(n-1,r+1);y++)for(let x=Math.max(0,c-1);x<=Math.min(n-1,c+1);x++){const j=y*n+x;if(j!==i)ns.push(j);}
  neighbors.push(ns);
 }
 return {n,k,regions,groups,memberships,neighbors};
}
export function solve(m,{limit=2,maxNodes=10000,initial=null}={}) {
 const {n,k,groups,memberships,neighbors}=m;
 let nodes=0,aborted=false;const solutions=[];
 function propagate(a) {
  // Values:0 undecided,1 empty,2 star.
  let changed=true;
  while(changed){
   changed=false;
   for(let i=0;i<a.length;i++)if(a[i]===2)for(const j of neighbors[i]){
    if(a[j]===2)return false;if(a[j]===0){a[j]=1;changed=true;}
   }
   for(const cells of groups){
    let stars=0;const open=[];
    for(const i of cells){if(a[i]===2)stars++;else if(a[i]===0)open.push(i);}
    const need=k-stars;if(need<0||need>open.length)return false;
    if(need===0){for(const i of open){a[i]=1;changed=true;}}
    else if(need===open.length){for(const i of open){a[i]=2;changed=true;}}
    else if(need===2 && open.length<=7){
     // A remaining candidate must have a non-touching partner in the same constraint.
     for(const i of open){if(!open.some(j=>i!==j&&!neighbors[i].includes(j))){a[i]=1;changed=true;}}
    }
   }
   // Locked candidate sets between row/column/region groups.
   for(let g=0;g<groups.length;g++){
    let count=0;const open=[];for(const i of groups[g]){if(a[i]===2)count++;else if(!a[i])open.push(i);}
    const need=k-count;if(!need||!open.length)continue;
    for(const h of memberships[open[0]]){
     if(h===g||!open.every(i=>memberships[i].includes(h)))continue;
     let existing=0;for(const i of groups[h])if(a[i]===2)existing++;
     if(k-existing===need){
      for(const i of groups[h])if(!a[i]&&!memberships[i].includes(g)){a[i]=1;changed=true;}
     }
    }
   }
  }
  return true;
 }
 function dfs(a){
  if(solutions.length>=limit||aborted)return;
  if(++nodes>maxNodes){aborted=true;return;}
  if(!propagate(a))return;
  let choice=-1,best=Infinity;
  for(const cells of groups){
   let count=0;const open=[];for(const i of cells){if(a[i]===2)count++;else if(!a[i])open.push(i);}
   const need=k-count;
   if(need>0&&open.length){
    const score=open.length/need;
    if(score<best){
     best=score;
     choice=open.reduce((left,right)=>neighbors[left].filter(i=>!a[i]).length>neighbors[right].filter(i=>!a[i]).length?left:right);
    }
   }
  }
  if(choice<0){solutions.push(Array.from(a,(v,i)=>v===2?i:-1).filter(i=>i>=0));return;}
  const yes=a.slice();yes[choice]=2;dfs(yes);
  if(solutions.length<limit&&!aborted){const no=a.slice();no[choice]=1;dfs(no);}
 }
 dfs(initial?Uint8Array.from(initial):new Uint8Array(n*n));
 return {count:solutions.length,solutions,nodes,aborted};
}
export function connected(regions,n,id,except=-1){
 let start=-1,total=0;for(let i=0;i<regions.length;i++)if(i!==except&&regions[i]===id){total++;start=i;}
 if(!total)return false;
 const seen=new Uint8Array(regions.length),stack=[start];seen[start]=1;let count=0;
 while(stack.length){const i=stack.pop();count++;const r=Math.floor(i/n),c=i%n;
  for(const j of [r?i-n:-1,r<n-1?i+n:-1,c?i-1:-1,c<n-1?i+1:-1])if(j>=0&&j!==except&&!seen[j]&&regions[j]===id){seen[j]=1;stack.push(j);}
 }
 return count===total;
}
export function validate(n,k,regions,solution){
 if(regions.length!==n*n||new Set(regions).size!==n)throw Error('Region count/board size mismatch');
 for(let g=0;g<n;g++)if(!connected(regions,n,g))throw Error('Disconnected region '+g);
 if(solution.length!==n*k||new Set(solution).size!==solution.length)throw Error('Wrong star count');
 const m=model(n,k,regions),set=new Set(solution);
 for(const group of m.groups)if(group.filter(i=>set.has(i)).length!==k)throw Error('Incorrect group total');
 for(const i of solution)if(m.neighbors[i].some(j=>set.has(j)))throw Error('Touching stars');
 return true;
}

