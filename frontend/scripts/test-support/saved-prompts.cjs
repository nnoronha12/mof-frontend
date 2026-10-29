/** Shared source embedded in the hosted n8n saved-prompts workflow. */
function normalizePromptRequest(item) {
  const headers = item.headers || {};
  const body = item.body && typeof item.body === 'object' && !Array.isArray(item.body) ? item.body : {};
  const token = String(headers.token || headers.authorization || '').replace(/^Bearer\s+/i,'').trim();
  const action = body.action || 'list';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.replace(/\r\n?/g,'\n').trim() : '';
  const id = typeof body.id === 'string' ? body.id : '';
  const search = typeof body.search === 'string' ? body.search.trim() : '';
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const cursor = body.cursor;
  const cursorValid = !cursor || (typeof cursor === 'object' && uuid(cursor.id) &&
    typeof cursor.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(cursor.updatedAt) && Number.isFinite(Date.parse(cursor.updatedAt)));
  const valid = ['list','save','delete'].includes(action) &&
    (action !== 'save' || (title.length >= 1 && title.length <= 120 && content.length >= 1 && content.length <= 12000)) &&
    (action !== 'delete' || uuid(id)) && (action !== 'list' || (cursorValid&&search.length<=120));
  return {action,title,content,id,valid,search:search.replace(/[\\%_]/g,'\\$&'),language:body.language==='ar'?'ar':'en',
    authorization:'Bearer '+token,tokenPresent:!!token,
    cursorAt:cursorValid&&cursor?cursor.updatedAt:'9999-12-31T23:59:59.999999Z',
    cursorId:cursorValid&&cursor?cursor.id:'ffffffff-ffff-ffff-ffff-ffffffffffff'};
}
function authorizePromptRequest(request,response) {
  const user=response.body;
  const authenticated=request.tokenPresent && response.statusCode===200 && user &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id||''));
  const denied=!request.tokenPresent||response.statusCode===401||response.statusCode===403;
  return {...request,allowed:!!authenticated&&request.valid,
    status:authenticated?400:denied?401:503,ownerId:authenticated?String(user.id):null};
}
function promptReply(context,rows) {
  const ar=context.language==='ar';
  const button=(action,label,type,payload={})=>({id:action,label,action,actionButtonType:type,payload});
  const controls={buttons:[button('prompt.save',ar?'حفظ المطالبة':'Save prompt','execute')]};
  const map=row=>({id:row.id,title:row.title,content:row.content,createdAt:row.createdAt,updatedAt:row.updatedAt,
    actionButtons:{buttons:[button('prompt.use',ar?'استخدام':'Use','prompt',{id:row.id}),button('prompt.delete',ar?'حذف':'Delete','execute',{id:row.id})]}});
  if(rows.some(row=>row.error))return {status:503,body:{success:false,code:'PROMPTS_UNAVAILABLE',actionButtons:{buttons:[]}}};
  if(context.action==='delete')return rows.some(row=>row.id)?{status:200,body:{success:true,deleted:true,actionButtons:controls}}:
    {status:404,body:{success:false,code:'PROMPT_NOT_FOUND',actionButtons:{buttons:[]}}};
  const saved=rows.filter(row=>row.id);
  if(context.action==='save')return saved.length?{status:200,body:{success:true,prompt:map(saved[0]),actionButtons:controls}}:
    {status:409,body:{success:false,code:'PROMPT_NOT_SAVED',actionButtons:{buttons:[]}}};
  const page=saved.slice(0,50);
  const last=page[page.length-1];
  const nextCursor=saved.length>50?{id:last.id,updatedAt:last.updatedAt}:null;
  if(nextCursor)controls.buttons.push(button('prompt.more',ar?'تحميل المزيد':'Load more','view',{cursor:nextCursor}));
  return {status:200,body:{success:true,prompts:page.map(map),nextCursor,actionButtons:controls}};
}
module.exports={normalizePromptRequest,authorizePromptRequest,promptReply};
