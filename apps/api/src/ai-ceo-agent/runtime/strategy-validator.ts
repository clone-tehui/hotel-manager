import { BadRequestException } from '@nestjs/common';
export type StrategyEvidenceContext = { rooms: Map<string,{active:boolean;periodKeys:Set<string>;availableFields:Set<string>;periodDates:Map<string,{from:string;to:string}>}>; allowedChannels:Set<string>; maxDiscountPercent:number };
const PRIORITIES=new Set(['LOW','MEDIUM','HIGH','CRITICAL']);

/** Canonical evidence names are derived from the actual Room Intelligence row.
 * Null/UNAVAILABLE values are deliberately excluded instead of being whitelisted by schema alone.
 */
export function availableRoomMetricReferences(row:any){
 const fields=new Set<string>();
 const add=(name:string,value:any)=>{if(value!==null&&value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value)))fields.add(name);};
 add('roomCode',row?.roomCode); add('building',row?.building); add('roomType',row?.roomType); add('operationalStatus',row?.operationalStatus);
 add('bookedNights',row?.bookedNights); add('occupancy',row?.occupancy); add('bookedNightRevenue',row?.bookedNightRevenue); add('adr',row?.adr); add('revPar',row?.revPar);
 add('calendarVacantNights',row?.availability?.vacantNights);
 add('calendarAvailableNights',row?.availability?.sellableNights);
 add('availabilityAssumption',row?.availability?.assumption);
 add('monthlyCost',row?.economics?.monthlyCost); add('profitStyleDifference',row?.economics?.profit); add('revenueGap',row?.economics?.revenueGap);
 add('breakEvenRevenue',row?.economics?.breakEvenRevenue); add('breakEvenNights',row?.economics?.breakEvenNights); add('breakEvenReached',row?.economics?.breakEvenReached);
 add('requiredADRToBreakEven',row?.economics?.requiredADRToBreakEven); add('economicsMargin',row?.economics?.margin);
 add('referencePrice',row?.referencePrice); add('discountablePrice',row?.discountablePrice);
 for(const [name,status] of Object.entries(row?.unavailable??{}))if(status!=='UNAVAILABLE')add(name,status);
 return fields;
}
function array(value:any,name:string){if(!Array.isArray(value))throw new BadRequestException(`${name} must be an array`);return value;}
function finiteOrNull(value:any,name:string){if(value==null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new BadRequestException(`${name} must be a non-negative number or null`);return value;}
export function validateAgentStrategyOutput(raw:any,ctx:StrategyEvidenceContext){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Agent final output must be an object');
 const rows=array(raw.roomStrategies,'roomStrategies'); const valid:any[]=[];
 for(const [index,row] of rows.entries()){
  if(!row||typeof row!=='object')throw new BadRequestException(`roomStrategies[${index}] must be an object`);
  const room=ctx.rooms.get(String(row.roomId||''));if(!room||!room.active)throw new BadRequestException(`Invalid or inactive roomId at strategy ${index}`);
  const periodKey=String(row.periodKey||'');if(!room.periodKeys.has(periodKey))throw new BadRequestException(`Invalid periodKey at strategy ${index}`);
  if(!PRIORITIES.has(String(row.priority||'')))throw new BadRequestException(`Invalid priority at strategy ${index}`);
  if(!String(row.assessment||'').trim())throw new BadRequestException(`Missing assessment at strategy ${index}`);
  if(!String(row.objective||'').trim())throw new BadRequestException(`Missing objective at strategy ${index}`);
  const evidence=array(row.evidence,'evidence').map(String).filter(Boolean);if(!evidence.length)throw new BadRequestException(`Strategy ${index} requires evidence`);
  if(row.claimedExecution===true||row.executed===true)throw new BadRequestException(`Strategy ${index} cannot claim execution`);
  const pricing=row.pricingRecommendation??{}; const discount=finiteOrNull(pricing.discountPercent??row.discountPercentMax,'discountPercent');if(discount!=null&&discount>ctx.maxDiscountPercent)throw new BadRequestException(`Discount exceeds guardrail at strategy ${index}`);
  const channels=array(row.channelRecommendation?.channels??row.channels??[],'channels').map(String);if(channels.some((channel)=>!ctx.allowedChannels.has(channel)))throw new BadRequestException(`Unsupported channel recommendation at strategy ${index}`);
  const dates=row.dateRange; if(dates){const expected=room.periodDates.get(periodKey)!;if(dates.from<expected.from||dates.to>expected.to||dates.from>dates.to)throw new BadRequestException(`Invalid date range at strategy ${index}`);}
  const references=array(row.dataReferences??[],'dataReferences').map(String);if(references.some((field)=>!room.availableFields.has(field)))throw new BadRequestException(`Strategy ${index} references unavailable data`);
  valid.push({...row,roomId:String(row.roomId),periodKey,priority:String(row.priority),evidence,targetOccupancy:finiteOrNull(row.targetOccupancy,'targetOccupancy'),targetRevenue:finiteOrNull(row.targetRevenue,'targetRevenue'),confidence:row.confidence==null?null:Math.max(0,Math.min(1,Number(row.confidence)))});
 }
 return {executiveSummary:String(raw.executiveSummary||''),roomStrategies:valid,companyActions:array(raw.companyActions??[],'companyActions'),missingData:array(raw.missingData??[],'missingData')};
}
