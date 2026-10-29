/** Feature controls only. Does not apply the rolled-back response formatter. */
function withResultActions(value, context = {}) {
  if(typeof value==='string'){
    try{return JSON.stringify(withResultActions(JSON.parse(value),context));}catch(error){return value;}
  }
  if(!value||typeof value!=='object'||Array.isArray(value)||value.sessionDetails?.chatLock!==false)return value;
  let buttons=Array.isArray(value.actionButtons?.buttons)?value.actionButtons.buttons.slice():[];
  let changed=false;
  const decode=text=>String(text).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,code)=>{
    const names={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
    if(code[0]!=='#')return names[code.toLowerCase()]||entity;
    const number=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
    return Number.isInteger(number)&&number>=0&&number<=0x10ffff?String.fromCodePoint(number):entity;
  });
  let email=value.emailDraft;
  const markup=String(value.output||'');
  if(!email&&/data-mof-email=["']1["']/.test(markup)){
    const subject=/data-subject="([^"]*)"/.exec(markup)?.[1];
    const raw=/<pre\b[^>]*>([\s\S]*?)<\/pre>/i.exec(markup)?.[1];
    if(subject&&raw){
      const emailText=decode(raw).replace(/\r\n?/g,'\n').trim();
      const first=emailText.indexOf('\n');
      email={subject:decode(subject),emailText,body:first>=0&&/^(?:Subject|الموضوع)\s*[:：]/i.test(emailText)?emailText.slice(first).trim():emailText};
    }
  }
  if(email&&typeof email.subject==='string'&&email.subject.trim()&&typeof email.body==='string'&&email.body.trim()){
    let hash=2166136261;for(const char of markup)hash=Math.imul(hash^char.charCodeAt(0),16777619);
    const id=String(email.id||'email-'+(value.sessionDetails.aiMessageId||value.sessionDetails.messageId||(hash>>>0).toString(16)));
    const ar=/[\u0600-\u06ff]/.test(email.body)&&email.body.split(/\s+/).filter(w=>/[\u0600-\u06ff]/.test(w)).length>=email.body.split(/\s+/).filter(w=>/[A-Za-z]/.test(w)).length;
    const sender=context.from||email.from;
    const draft={id,subject:email.subject,body:email.body,emailText:email.emailText||email.subject+'\n\n'+email.body,
      ...(typeof sender==='string'&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(sender)?{from:sender}:{})};
    // Generate the complete MIME file in n8n without browser or Buffer globals.
    const base64=text=>{
      const bytes=[];
      for(const char of text){
        let cp=char.codePointAt(0);if(cp>=0xd800&&cp<=0xdfff)cp=0xfffd;
        if(cp<128)bytes.push(cp);
        else if(cp<2048)bytes.push(192|(cp>>6),128|(cp&63));
        else if(cp<65536)bytes.push(224|(cp>>12),128|((cp>>6)&63),128|(cp&63));
        else bytes.push(240|(cp>>18),128|((cp>>12)&63),128|((cp>>6)&63),128|(cp&63));
      }
      const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let encoded='';
      for(let i=0;i<bytes.length;i+=3){
        const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);
        encoded+=alphabet[(n>>18)&63]+alphabet[(n>>12)&63]+(i+1<bytes.length?alphabet[(n>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');
      }
      return encoded;
    };
    const words=[];let part='',bytes=0;
    for(const char of draft.subject.replace(/[\r\n]+/g,' ').trim()){
      const cp=char.codePointAt(0),length=cp<128?1:cp<2048?2:cp<65536?3:4;
      if(bytes+length>42){words.push('=?UTF-8?B?'+base64(part)+'?=');part='';bytes=0;}
      part+=char;bytes+=length;
    }
    if(part)words.push('=?UTF-8?B?'+base64(part)+'?=');
    const body=base64(draft.body.replace(/\r\n|\r|\n/g,'\r\n')).match(/.{1,76}/g)?.join('\r\n')||'';
    const eml=[...(draft.from?['From: '+draft.from]:[]),'Subject: '+words.join('\r\n '),
      'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','X-Unsent: 1','',body,''].join('\r\n');
    const safe=Array.from(draft.subject.replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()).slice(0,80).join('').replace(/[. ]+$/,'');
    const file={filename:'email-'+(safe||'draft')+'.eml',mimetype:'message/rfc822',encoding:'base64',base64:base64(eml)};
    buttons=buttons.filter(b=>!(context.downloadOnly?['email.download']:['email.copy','email.download','message.copy']).includes(b?.action));
    if(!context.downloadOnly)buttons.push({id:'email.copy',label:ar?'نسخ البريد الإلكتروني':'Copy email',actionButtonType:'copy',action:'email.copy',payload:{emailId:id,emailDraft:draft}});
    buttons.push({id:'email.download',label:ar?'تنزيل البريد (.eml)':'Download .eml',actionButtonType:'download',action:'email.download',mimetype:'message/rfc822',payload:{emailId:id,...(context.downloadOnly?{emailDraft:draft}:{}),file}});
    changed=true;
  }
  const presentation=value.presentation;
  if(presentation&&/^[0-9a-f-]{36}$/i.test(String(presentation.deckId||''))){
    const deckId=presentation.deckId;
    const words=markup.replace(/<[^>]*>/g,' ').split(/\s+/);
    const arabic=words.filter(w=>/[\u0600-\u06ff]/.test(w)).length;
    const ar=context.language==='ar'||presentation.language==='ar'||(arabic>0&&arabic>=words.filter(w=>/[A-Za-z]/.test(w)).length);
    const add=(action,label,type,payload={})=>{
      if(!buttons.some(b=>b?.action===action&&b.payload?.deckId===deckId&&b.payload?.format===payload.format))
        buttons.push({id:action+(payload.format?'.'+payload.format:''),label,actionButtonType:type,action,payload:{deckId,...payload}});
    };
    add('presentation.open',ar?'فتح العرض':'Open presentation','view',{presentation:{deckId,revision:Number(presentation.revision)||0}});
    add('presentation.edit',ar?'تعديل العرض والألوان':'Edit presentation and colours','execute');
    add('presentation.save',ar?'حفظ التغييرات':'Save changes','execute');
    add('presentation.export',ar?'تنزيل PDF':'Download PDF','download',{format:'pdf'});
    add('presentation.export',ar?'تنزيل PowerPoint':'Download PowerPoint','download',{format:'pptx'});
    add('presentation.reload',ar?'تحميل أحدث نسخة':'Reload latest revision','execute');
    add('presentation.openTab',ar?'فتح في علامة تبويب جديدة':'Open in new tab','view');
    add('presentation.downloadHtml',ar?'تنزيل HTML':'Download HTML','execute');
    add('presentation.regenerateSlide',ar?'إعادة إنشاء الشريحة':'Regenerate slide','execute');
    add('presentation.regenerateDeck',ar?'إعادة إنشاء العرض':'Regenerate presentation','execute');
    changed=true;
  }
  return changed?{...value,actionButtons:{...value.actionButtons,buttons}}:value;
}
module.exports={withResultActions};
