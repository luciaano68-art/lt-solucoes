export function voiceEnvironment(nav={},win={}){const ios=/iPad|iPhone|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);const installed=nav.standalone===true||win.matchMedia?.('(display-mode: standalone)')?.matches===true;return {ios,keyboard:ios&&installed,continuous:!ios};}
const errors={
 'not-allowed':'Permita o uso do microfone nas configurações do aparelho ou navegador e tente novamente. Você também pode usar o microfone do teclado neste campo.',
 'service-not-allowed':'O reconhecimento de voz não está disponível neste aparelho. No iPhone, confira se Siri e Ditado estão ativados. Você pode usar o microfone do teclado neste campo.',
 'audio-capture':'Não consegui acessar o microfone. Confira se ele está disponível e tente novamente.',
 'network':'Não consegui transformar a fala em texto. Confira a internet e tente novamente.',
 'no-speech':'Não ouvi nenhuma fala. Toque em falar novamente ou use o microfone do teclado neste campo.'
};
export class VoiceInput {
 constructor({Recognition,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,keyboard=false,continuous=true}){this.Recognition=Recognition;this.keyboard=keyboard;this.continuous=continuous;this.onChange=onChange;this.setTimer=(...args)=>setTimer.call(globalThis,...args);this.clearTimer=(...args)=>clearTimer.call(globalThis,...args);this.phase='idle';this.text='';this.error='';this.run=0;this.engine=null;this.timer=null;this.endTimer=null;this.startTimer=null;}
 emit(){this.onChange({phase:this.phase,text:this.text,error:this.error,supported:!!this.Recognition});}
 clearTimers(){this.clearTimer(this.timer);this.clearTimer(this.endTimer);this.clearTimer(this.startTimer);this.timer=null;this.endTimer=null;this.startTimer=null;}
 start(){
  this.cancel(false);this.text='';this.error='';
  if(this.keyboard){this.useKeyboard();return;}
  if(!this.Recognition){this.phase='unsupported';this.error='Use o microfone do teclado para ditar neste campo. Depois confira o texto e confirme o envio.';this.emit();return;}
  const run=++this.run;this.phase='starting';this.emit();
  try{const engine=new this.Recognition();this.engine=engine;engine.lang='pt-BR';engine.continuous=this.continuous;engine.interimResults=true;engine.maxAlternatives=1;
   engine.onstart=()=>{if(run!==this.run)return;if(this.phase!=='starting'){try{engine.abort();}catch{}return;}this.clearTimer(this.startTimer);this.startTimer=null;this.phase='listening';this.emit();};
   engine.onresult=event=>{if(run!==this.run||!['starting','listening','stopping'].includes(this.phase))return;this.text=Array.from(event.results||[]).map(r=>r[0]?.transcript||'').join(' ').replace(/\s+/g,' ').trim();this.emit();};
   engine.onerror=event=>{if(run!==this.run)return;this.clearTimers();this.phase='error';this.error=errors[event.error]||'Não consegui reconhecer a fala. Tente novamente ou use o microfone do teclado.';this.emit();try{engine.abort();}catch{}};
   engine.onend=()=>{if(run!==this.run)return;this.clearTimers();this.engine=null;if(this.phase!=='error'){this.phase=this.text?'review':'error';if(!this.text)this.error=errors['no-speech'];}this.emit();};
   this.startTimer=this.setTimer(()=>{if(run!==this.run||this.phase!=='starting')return;this.cancel(false);this.phase='error';this.error='O reconhecimento não iniciou. Toque em Ditar pelo teclado para falar e conferir o texto.';this.emit();},8000);engine.start();if(['starting','listening'].includes(this.phase))this.timer=this.setTimer(()=>this.stop(),60000);
  }catch{this.clearTimers();this.phase='error';this.error='Não consegui iniciar o microfone. Tente novamente ou use o microfone do teclado neste campo.';this.emit();}
 }
 stop(){if(!['starting','listening'].includes(this.phase))return;this.clearTimers();this.phase='stopping';this.emit();const run=this.run;try{this.engine?.stop();}catch{}if(this.phase!=='stopping')return;this.endTimer=this.setTimer(()=>{if(run!==this.run||this.phase!=='stopping')return;const engine=this.engine;this.run++;this.engine=null;try{engine?.abort();}catch{}this.phase=this.text?'review':'error';if(!this.text)this.error=errors['no-speech'];this.emit();},3000);}
 useKeyboard(){this.cancel(false);this.phase='dictation';this.emit();}
 cancel(notify=true){this.run++;this.clearTimers();const engine=this.engine;this.engine=null;this.phase='idle';this.text='';this.error='';try{engine?.abort();}catch{}if(notify)this.emit();}
}
