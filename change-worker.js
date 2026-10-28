import {combinations,extraSuggestion} from './change-engine.js';
self.onmessage=({data})=>{
 try{
  const result=combinations(BigInt(data.change),'MXN',data.available);let suggestion=null,suggestError='';
  if(data.suggestionAvailable&&data.suggest)try{suggestion=extraSuggestion(BigInt(data.change),data.suggestionAvailable,BigInt(data.maxExtra));}catch(error){suggestError=error.message;}
  self.postMessage({id:data.id,...result,suggestion,suggestError});
 }catch(error){self.postMessage({id:data.id,error:error.message});}
};
