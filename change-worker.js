import {combinations,extraSuggestion} from './change-engine.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,...combinations(BigInt(data.change),'MXN',data.available),suggestion:data.available&&data.suggest?extraSuggestion(BigInt(data.change),data.available,BigInt(data.maxExtra)):null});}catch(error){self.postMessage({id:data.id,error:error.message});}};
