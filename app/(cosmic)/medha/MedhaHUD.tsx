'use client';

/**
 * MedhaHUD — New Visual Layer
 * Drop-in replacement for app/(cosmic)/medha/MedhaHUD.tsx
 *
 * KEEPS: quota, consent, storage, markdown, STT/TTS, history, settings,
 *        model greetings, back nav, file attach, forbidden query filter,
 *        orb color sync, camera node perspective, scope restrictions
 *
 * REPLACES: visual layer → void entity, roaming, peach bubbles, neural lines,
 *           faculty colors, particle burst, procedural entity states
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { COGNITIVE_MODES, CognitiveModeKey, getMode, MODEL_GREETINGS } from '@/lib/medha/cognitive';
import { chatComplete, type ChatMessage } from '@/lib/medha/MedhaClient';
import { renderMarkdown, isForbiddenQuery, SANDHI_REDIRECT_MARKDOWN } from '@/lib/medha/markdown';
import { listChats, getChat, upsertChat, deleteChat, getCurrentChatId, setCurrentChatId, newChatId, type StoredChat, type StoredMsg } from '@/lib/medha/storage';
import { STT, TTS } from '@/lib/medha/voice';
import { incrementQuota, quotaRemaining, getUser, setUser, quotaLimit, type LocalUser } from '@/lib/quota/quota';
import MedhaConsentSlab, { hasLocalConsent, type ConsentSnapshot } from './MedhaConsentSlab';
import { CosmicStream } from '@/components/CosmicStream';
import { MedhaLair } from '@/components/MedhaLair';
import { useCosmicStream, STREAM_COLORS } from '@/hooks/useCosmicStream';
import './medha.css';

// ─── Faculty colors ────────────────────────────────────────────────────────────
const FC: Record<CognitiveModeKey, string> = {
  prajna: '#2d9e7f', dhyana: '#c4622d', akshaya: '#00c4cc', java: '#a855f7', sanchara: '#e8b94f',
};

// ─── Entity states ─────────────────────────────────────────────────────────────
type ES = 'dormant'|'listening'|'thinking'|'responding'|'voice-listening'|'voice-active'|'switching';
const SC: Record<ES,{sc:number;br:number;ro:number;dy:number;dd:number;ao:number;ps:number}> = {
  dormant:         {sc:1.000,br:1.00,ro:0,  dy:10,dd:7,  ao:0.04,ps:6  },
  listening:       {sc:1.020,br:1.02,ro:0,  dy:8, dd:5,  ao:0.07,ps:4  },
  thinking:        {sc:1.015,br:1.02,ro:1,  dy:12,dd:3.5,ao:0.08,ps:3  },
  responding:      {sc:1.022,br:1.04,ro:0,  dy:10,dd:2.8,ao:0.10,ps:1.8},
  'voice-listening':{sc:0.995,br:1.01,ro:0, dy:6, dd:6,  ao:0.06,ps:5  },
  'voice-active':  {sc:1.025,br:1.04,ro:0,  dy:8, dd:1.5,ao:0.12,ps:1.2},
  switching:       {sc:1.040,br:1.06,ro:1.5,dy:14,dd:1,  ao:0.15,ps:1  },
};

// ─── Roaming ───────────────────────────────────────────────────────────────────
const RP=[{x:50,y:44},{x:50,y:30},{x:34,y:43},{x:66,y:43},{x:50,y:57},{x:36,y:33},{x:64,y:33}];
const nxtRoam=(c:{x:number;y:number})=>{const o=RP.filter(p=>p.x!==c.x||p.y!==c.y);return o[Math.floor(Math.random()*o.length)];};

// ─── Void canvas ───────────────────────────────────────────────────────────────
function VoidCanvas(){
  const r=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c=r.current;if(!c)return;const x=c.getContext('2d');if(!x)return;
    let id:number,t=0;
    type S={x:number;y:number;r:number;o:number;s:number;p:number;l:number};
    type W={x:number;y:number;w:number;h:number;o:number;c:string;dx:number;dy:number};
    let stars:S[]=[],wisps:W[]=[];
    const ini=()=>{
      c.width=window.innerWidth;c.height=window.innerHeight;
      const a=c.width*c.height;stars=[];
      for(let i=0;i<a/7000;i++)stars.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*0.4+0.1,o:Math.random()*0.08+0.02,s:Math.random()*0.0003+0.0001,p:Math.random()*6.28,l:0});
      for(let i=0;i<a/16000;i++)stars.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*0.7+0.3,o:Math.random()*0.12+0.04,s:Math.random()*0.0005+0.0002,p:Math.random()*6.28,l:1});
      for(let i=0;i<a/35000;i++)stars.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.0+0.6,o:Math.random()*0.16+0.07,s:Math.random()*0.0007+0.0003,p:Math.random()*6.28,l:2});
      const cl=['rgba(26,26,255,','rgba(123,47,255,','rgba(192,38,211,','rgba(20,10,50,'];
      wisps=[];for(let i=0;i<5;i++)wisps.push({x:Math.random()*c.width,y:Math.random()*c.height,w:c.width*(0.18+Math.random()*0.22),h:c.height*(0.10+Math.random()*0.10),o:Math.random()*0.020+0.005,c:cl[Math.floor(Math.random()*cl.length)],dx:(Math.random()-0.5)*0.012,dy:(Math.random()-0.5)*0.007});
    };
    const drw=()=>{
      x.clearRect(0,0,c.width,c.height);t++;
      for(const w of wisps){
        w.x+=w.dx;w.y+=w.dy;
        if(w.x<-w.w)w.x=c.width;if(w.x>c.width+w.w)w.x=-w.w;
        if(w.y<-w.h)w.y=c.height;if(w.y>c.height+w.h)w.y=-w.h;
        const b=0.7+0.3*Math.sin(t*0.003+w.x*0.001);
        const g=x.createRadialGradient(w.x,w.y,0,w.x,w.y,w.w*0.5);
        g.addColorStop(0,`${w.c}${w.o*b})`);g.addColorStop(0.5,`${w.c}${w.o*b*0.3})`);g.addColorStop(1,`${w.c}0)`);
        x.save();x.translate(w.x,w.y);x.scale(1,w.h/w.w);x.translate(-w.x,-w.y);x.beginPath();x.arc(w.x,w.y,w.w*0.5,0,6.28);x.fillStyle=g;x.fill();x.restore();
      }
      for(const s of stars){
        const op=s.o*(0.6+0.4*Math.sin(t*s.s*60+s.p));
        if(s.l===2){const g=x.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3);g.addColorStop(0,`rgba(255,255,255,${op*0.5})`);g.addColorStop(1,'rgba(255,255,255,0)');x.beginPath();x.arc(s.x,s.y,s.r*3,0,6.28);x.fillStyle=g;x.fill();}
        x.beginPath();x.arc(s.x,s.y,s.r,0,6.28);x.fillStyle=`rgba(255,255,255,${op})`;x.fill();
      }
      id=requestAnimationFrame(drw);
    };
    ini();drw();window.addEventListener('resize',ini);
    return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',ini);};
  },[]);
  return <canvas ref={r} style={{position:'fixed',inset:0,width:'100%',height:'100%',background:'#000',zIndex:0,pointerEvents:'none'}}/>;
}

// ─── Neural dot line ───────────────────────────────────────────────────────────
function NL({color,align}:{color:string;align:'left'|'right'}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:'3px',flexDirection:align==='right'?'row-reverse':'row'}}>
      {Array.from({length:7}).map((_,i)=>(
        <motion.div key={i} animate={{opacity:[0.15,1,0.15],scale:[0.6,1,0.6]}}
          transition={{duration:1.4,repeat:Infinity,delay:(align==='right'?6-i:i)*0.12,ease:'easeInOut'}}
          style={{width:i===3?'5px':'3px',height:i===3?'5px':'3px',borderRadius:'50%',background:color,flexShrink:0}}/>
      ))}
    </div>
  );
}

// ─── Particle burst ────────────────────────────────────────────────────────────
function PB({color,active}:{color:string;active:boolean}){
  const cr=useRef<HTMLCanvasElement>(null);const ar=useRef<number>(0);
  useEffect(()=>{
    if(!active)return;const c=cr.current;if(!c)return;const x=c.getContext('2d');if(!x)return;
    c.width=window.innerWidth;c.height=window.innerHeight;
    const cx=c.width/2,cy=c.height/2;
    const ps=Array.from({length:65},(_,i)=>{const a=(Math.PI*2*i)/65+(Math.random()-0.5)*0.4,sp=1.5+Math.random()*3;return{x:cx+(Math.random()-0.5)*80,y:cy+(Math.random()-0.5)*80,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,sz:Math.random()*2.5+0.5};});
    const st=performance.now();
    const drw=(now:number)=>{
      const l=1-(now-st)/2400;if(l<=0){x.clearRect(0,0,c.width,c.height);return;}
      x.clearRect(0,0,c.width,c.height);
      for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vy+=0.02;const a=Math.floor(l*200).toString(16).padStart(2,'0');x.beginPath();x.arc(p.x,p.y,p.sz,0,Math.PI*2);x.fillStyle=`${color}${a}`;x.fill();x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-p.vx*3,p.y-p.vy*3);x.strokeStyle=`${color}${Math.floor(l*80).toString(16).padStart(2,'0')}`;x.lineWidth=p.sz*0.4;x.stroke();}
      ar.current=requestAnimationFrame(drw);
    };
    ar.current=requestAnimationFrame(drw);
    return()=>cancelAnimationFrame(ar.current);
  },[active,color]);
  if(!active)return null;
  return <canvas ref={cr} style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:60,pointerEvents:'none'}}/>;
}

// ─── Entity ────────────────────────────────────────────────────────────────────
function Entity({es,fc,rp,vis,vsrc}:{es:ES;fc:string;rp:{x:number;y:number};vis:boolean;vsrc?:string}){
  const vr=useRef<HTMLVideoElement>(null);const cfg=SC[es];
  useEffect(()=>{const v=vr.current;if(!v)return;const play=()=>v.play().catch(()=>{});v.addEventListener('canplay',play);if(v.readyState>=3)play();return()=>v.removeEventListener('canplay',play);},[vsrc]);
  return(
    <motion.div animate={{left:`${rp.x}%`,top:`${rp.y}%`,opacity:vis?1:0,scale:vis?1:0.85,filter:vis?'blur(0px)':'blur(12px)'}}
      transition={{left:{duration:2.8,ease:[0.16,1,0.3,1]},top:{duration:2.8,ease:[0.16,1,0.3,1]},opacity:{duration:1.6},scale:{duration:1.8},filter:{duration:1.6}}}
      style={{position:'fixed',transform:'translate(-50%,-50%)',zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <motion.div animate={{opacity:[cfg.ao*0.5,cfg.ao,cfg.ao*0.5]}} transition={{duration:cfg.ps,repeat:Infinity,ease:'easeInOut'}}
        style={{position:'absolute',width:'40vmin',height:'12vmin',borderRadius:'50%',background:`radial-gradient(ellipse at center,${fc} 0%,transparent 70%)`,filter:'blur(28px)',top:'56%',zIndex:9}}/>
      <motion.div
        animate={{scale:cfg.sc,rotate:cfg.ro>0?[0,cfg.ro,0,-cfg.ro,0]:0,y:[-cfg.dy/2,cfg.dy/2,-cfg.dy/2],filter:`brightness(${cfg.br})`}}
        transition={{scale:{duration:1.2,ease:[0.16,1,0.3,1]},rotate:{duration:cfg.dd*2,repeat:Infinity,ease:'easeInOut'},y:{duration:cfg.dd,repeat:Infinity,ease:'easeInOut'},filter:{duration:1.0}}}
        style={{width:'56vmin',height:'56vmin',position:'relative',zIndex:10}}>
        {vsrc
          ?<video ref={vr} src={vsrc} autoPlay loop muted playsInline preload="auto" style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
          // eslint-disable-next-line @next/next/no-img-element
          :<img src="/assets/medha-entity.png" alt="MEDHĀ" style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
        }
      </motion.div>
      <AnimatePresence>
        {(es==='responding'||es==='voice-active')&&(
          <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:[1,1.08,1],opacity:[0.06,0.12,0.06]}} exit={{opacity:0}}
            transition={{duration:cfg.ps,repeat:Infinity}}
            style={{position:'absolute',width:'60vmin',height:'60vmin',borderRadius:'50%',border:`1px solid ${fc}`,zIndex:8}}/>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function Bubble({msg,rp,fc,onCopy}:{msg:StoredMsg;rp:{x:number;y:number};fc:string;onCopy:(m:StoredMsg)=>void}){
  const isU=msg.role==='user';
  const top=rp.y<52?`${rp.y+28}vh`:`${rp.y-26}vh`;
  const mn=isU?'YOU':`MEDHĀ · ${getMode(msg.mode as CognitiveModeKey).name}`;
  return(
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0,left:`${rp.x}%`,top}} exit={{opacity:0,y:-10}}
      transition={{opacity:{duration:0.4,ease:[0.16,1,0.3,1]},left:{duration:2.8,ease:[0.16,1,0.3,1]},top:{duration:2.8,ease:[0.16,1,0.3,1]}}}
      style={{position:'fixed',transform:'translateX(-50%)',zIndex:35,width:'min(90vw,420px)',display:'flex',flexDirection:'column',alignItems:isU?'flex-end':'flex-start',gap:'6px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        {!isU&&<div style={{width:'5px',height:'5px',borderRadius:'50%',background:fc,boxShadow:`0 0 4px ${fc}`}}/>}
        <span style={{fontSize:'9px',letterSpacing:'0.22em',color:isU?'rgba(255,255,255,0.2)':'rgba(255,200,160,0.4)',textTransform:'uppercase',fontFamily:'system-ui'}}>{mn}</span>
      </div>
      <div style={{display:'flex',alignItems:'flex-start',gap:'8px',flexDirection:isU?'row-reverse':'row'}}>
        <div style={{paddingTop:'10px',flexShrink:0}}><NL color={isU?'rgba(255,255,255,0.3)':fc} align={isU?'right':'left'}/></div>
        <div onClick={()=>onCopy(msg)} style={{maxWidth:'min(72vw,340px)',padding:isU?'10px 14px':'11px 15px',background:isU?'rgba(255,255,255,0.05)':'rgba(255,218,185,0.10)',border:isU?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(255,200,160,0.18)',borderRadius:isU?'14px 14px 3px 14px':'3px 14px 14px 14px',fontSize:'13px',lineHeight:'1.68',letterSpacing:'0.02em',color:isU?'rgba(255,255,255,0.78)':'rgba(255,225,195,0.9)',fontFamily:'system-ui',wordBreak:'break-word',whiteSpace:'pre-wrap',cursor:'pointer'}}>
          {msg.role==='assistant'?<div dangerouslySetInnerHTML={{__html:renderMarkdown(msg.content)}} className="medha-md"/>:msg.content}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const uid=()=>typeof crypto!=='undefined'&&(crypto as any).randomUUID?(crypto as any).randomUUID():Math.random().toString(36).slice(2);
const sumTopic=(msgs:StoredMsg[])=>{const f=msgs.find(m=>m.role==='user')?.content?.trim()??'';return f.length>60?f.slice(0,57)+'…':f;};
const GREET_NEW='Hello — I am Medhā, the Cognitive Intelligence of VYAN. It is a quiet honour to meet you. What would you like to explore?';
const contGreet=(t?:string)=>t&&t.length>6?`Welcome back. Last time we touched on ${t}. Shall we continue — or step into something new?`:'Welcome back. The conversation is still warm. Where shall we begin?';

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function MedhaHUD(){
  const router=useRouter();const sp=useSearchParams();
  const[mode,setMode]=useState<CognitiveModeKey>('prajna');
  const[chatId,setChatId]=useState('');const[messages,setMessages]=useState<StoredMsg[]>([]);
  const[composerText,setComposerText]=useState('');const[busy,setBusy]=useState(false);
  const[isTyping,setIsTyping]=useState(false);const[showHistory,setShowHistory]=useState(false);
  const[showSettings,setShowSettings]=useState(false);const[listening,setListening]=useState(false);
  const[ttsEnabled,setTtsEnabled]=useState(false);const[chats,setChats]=useState<StoredChat[]>([]);
  const[quotaUser,setQuotaUser]=useState<LocalUser|null>(null);const[showQuotaLock,setShowQuotaLock]=useState(false);
  const[regBusy,setRegBusy]=useState(false);const[regErr,setRegErr]=useState('');
  const[regName,setRegName]=useState('');const[regEmail,setRegEmail]=useState('');
  const[consentGranted,setConsentGranted]=useState(false);const[consentReady,setConsentReady]=useState(false);
  const[greetingText,setGreetingText]=useState<string|null>(null);const[greetingMode,setGreetingMode]=useState<CognitiveModeKey>('prajna');
  const[es,setEs]=useState<ES>('dormant');const[rp,setRp]=useState(RP[0]);
  const[vis,setVis]=useState(true);const[burst,setBurst]=useState(false);const[burstColor,setBurstColor]=useState('#e8e4ff');
  const[mounted,setMounted]=useState(false);
  const { stream, triggerStream, handleStreamComplete } = useCosmicStream();
  const [pixieReact, setPixieReact] = useState(false);
  // Ambient stream timer
  const ambientStreamRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const sttR=useRef<STT|null>(null);const ttsR=useRef<TTS|null>(null);
  const gtR=useRef<ReturnType<typeof setTimeout>|null>(null);const roamR=useRef<ReturnType<typeof setTimeout>|null>(null);
  const fileR=useRef<HTMLInputElement>(null);
  const dataR=useRef({chatId:'',messages:[] as StoredMsg[],mode:'prajna' as CognitiveModeKey});
  useEffect(()=>{dataR.current={chatId,messages,mode};},[chatId,messages,mode]);
  const mdef=useMemo(()=>getMode(mode),[mode]);
  const fc=FC[mode];

  useEffect(()=>{
    setMounted(true);
    // Schedule ambient cosmic streams
    const scheduleAmbient = () => {
      ambientStreamRef.current = setTimeout(() => {
        triggerStream('ambient');
        scheduleAmbient();
      }, 45000 + Math.random() * 45000);
    };
    scheduleAmbient();
    return () => { if (ambientStreamRef.current) clearTimeout(ambientStreamRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Init
  useEffect(()=>{
    setConsentGranted(hasLocalConsent());setConsentReady(true);setQuotaUser(getUser());
    sttR.current=new STT();ttsR.current=new TTS();
    const rail=document.querySelector('.neural-depth') as HTMLElement|null;
    const cap=document.querySelector('.shunya-caption') as HTMLElement|null;
    if(rail){rail.style.opacity='0';rail.style.pointerEvents='none';}
    if(cap)cap.style.opacity='0';
    const stored=listChats();setChats(stored);
    const cid=getCurrentChatId();
    if(cid&&stored.find(c=>c.id===cid)){const c=getChat(cid)!;setChatId(c.id);setMessages(c.messages);}
    else{const prev=stored[0];const id=newChatId();setChatId(id);setCurrentChatId(id);
      const g:StoredMsg={id:uid(),role:'assistant',content:prev?contGreet(prev.topic):GREET_NEW,mode:'prajna',ts:Date.now()};
      setMessages([g]);upsertChat({id,title:'New Conversation',messages:[g],createdAt:Date.now(),lastInteractionAt:Date.now()});}
    const im=(sp?.get('model') as CognitiveModeKey)||'prajna';
    const vi=COGNITIVE_MODES.find(x=>x.key===im)?im:'prajna';
    setMode(vi);setGreetingText(MODEL_GREETINGS[vi]);setGreetingMode(vi);
    gtR.current=setTimeout(()=>setGreetingText(null),5500);
    return()=>{if(gtR.current)clearTimeout(gtR.current);
      const rail=document.querySelector('.neural-depth') as HTMLElement|null;const cap=document.querySelector('.shunya-caption') as HTMLElement|null;
      if(rail){rail.style.opacity='';rail.style.pointerEvents='';}if(cap)cap.style.opacity='';
      try{document.body.classList.remove('vyan-paused');}catch{}};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{document.body.classList.add('vyan-paused');return()=>{document.body.classList.remove('vyan-paused');};},[]);

  useEffect(()=>{const m=sp?.get('model') as CognitiveModeKey|null;if(m&&COGNITIVE_MODES.find(x=>x.key===m))actModel(m,m===mode);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ,[sp]);

  useEffect(()=>{if(!chatId)return;const t=sumTopic(messages);
    upsertChat({id:chatId,title:t?t.slice(0,36):'New Conversation',messages,createdAt:messages[0]?.ts??Date.now(),lastInteractionAt:Date.now(),topic:t});
    setChats(listChats());},[chatId,messages]);

  useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(showHistory||showSettings){setShowHistory(false);setShowSettings(false);return;}back();}};
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showHistory,showSettings]);

  // Roaming
  const roam=useCallback(()=>{setVis(false);setTimeout(()=>{setRp(p=>nxtRoam(p));setTimeout(()=>setVis(true),800);},1200);},[]);
  useEffect(()=>{const s=()=>{roamR.current=setTimeout(()=>{if(!busy)roam();s();},35000+Math.random()*20000);};s();return()=>{if(roamR.current)clearTimeout(roamR.current);};},[busy,roam]);

  const back=()=>{try{const v=(window as any).__vyan;v?.worldRef?.cameraRig?.returnToMedhaOrbFull?.();}catch{}router.push('/shunya/medha');};

  const actModel=useCallback((k:CognitiveModeKey,force=false)=>{
    if(k===mode&&!force)return;setMode(k);
    setBurstColor(FC[k]);setBurst(true);setTimeout(()=>setBurst(false),2400);
    // New consciousness flowing in
    setTimeout(() => triggerStream(k), 600);
    setEs('switching');setTimeout(()=>setEs('dormant'),1200);
    if(gtR.current)clearTimeout(gtR.current);setGreetingText(MODEL_GREETINGS[k]);setGreetingMode(k);
    gtR.current=setTimeout(()=>setGreetingText(null),5500);
    try{const v=(window as any).__vyan;const o=v?.worldRef?.realms?.shunya?.getOrbByKey?.('medha');
      if(o?.setSocketColorsCinematic)o.setSocketColorsCinematic(FC[k],1500);else o?.setSocketColors?.(FC[k]);}catch{}
    try{const v=(window as any).__vyan;const rig=v?.worldRef?.cameraRig;const sh=v?.worldRef?.realms?.shunya;
      if(rig?.flyToMedhaNodePerspective&&sh){const mo=sh.getOrbByKey?.('medha');
        if(mo?.socketGroup?.children?.length){const s=mo.socketGroup.children.find((c:any)=>c.userData?.isProductSocket&&c.userData?.productKey===k&&c.geometry);
          if(s){const T=require('three');const np=new T.Vector3();s.getWorldPosition(np);rig.flyToMedhaNodePerspective(np,mo.group.position.clone());}}}}catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode]);

  const send=useCallback(async()=>{
    const tx=composerText.trim();if(!tx||busy)return;
    if(!quotaUser&&!getUser()){if(quotaRemaining('medha')<=0){setShowQuotaLock(true);return;}if(!incrementQuota('medha').ok){setShowQuotaLock(true);return;}}
    setComposerText('');setIsTyping(false);
    const um:StoredMsg={id:uid(),role:'user',content:tx,mode,ts:Date.now()};
    setMessages(p=>[...p,um]);setEs('listening');
    if(Math.random()<0.3)setTimeout(()=>roam(),3000);
    if(isForbiddenQuery(tx)){setTimeout(()=>{setMessages(p=>[...p,{id:uid(),role:'assistant',content:SANDHI_REDIRECT_MARKDOWN,mode,ts:Date.now()}]);setEs('dormant');},280);return;}
    setBusy(true);await new Promise(r=>setTimeout(r,400));setEs('thinking');
    const hist:ChatMessage[]=[...dataR.current.messages,um].slice(-12).map(m=>({role:m.role,content:m.content}));
    try{const full=await chatComplete(mdef,hist);setEs('responding');
      const am:StoredMsg={id:uid(),role:'assistant',content:full||'I lost the signal for a moment. Try again?',mode,ts:Date.now()};
      setMessages(p=>[...p,am]);setEs('dormant');
      // Intelligence arrives — trigger stream + pixie reaction
      triggerStream(mode);
      setPixieReact(true);
      setTimeout(() => setPixieReact(false), 100);
      if(ttsEnabled&&ttsR.current?.isSupported()){const pl=full.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/[*_`#>]/g,'');setEs('voice-active');ttsR.current.speak(pl,{onEnd:()=>setEs('dormant')});}}
    catch{setMessages(p=>[...p,{id:uid(),role:'assistant',content:'Cognition is busy. Give it a breath and try again.',mode,ts:Date.now()}]);setEs('dormant');}
    finally{setBusy(false);}
  },[composerText,busy,mode,mdef,ttsEnabled,quotaUser,roam,triggerStream]);

  const subReg=useCallback(async()=>{
    if(!regEmail.trim()||regBusy)return;setRegBusy(true);setRegErr('');
    try{const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:regName,email:regEmail,intent:'medha-unlock'})});
      const d=await res.json();if(!res.ok||!d.ok){setRegErr(d?.error||'Registration failed.');return;}
      const u:LocalUser=d.user||{email:regEmail,name:regName,registeredAt:Date.now(),verified:false};
      setUser(u);setQuotaUser(u);setShowQuotaLock(false);setRegName('');setRegEmail('');}
    catch{setRegErr('Network unavailable.');}finally{setRegBusy(false);}
  },[regName,regEmail,regBusy]);

  const newChat=()=>{const prev=chats[0];const id=newChatId();setChatId(id);setCurrentChatId(id);
    const g:StoredMsg={id:uid(),role:'assistant',content:prev?contGreet(prev.topic):GREET_NEW,mode,ts:Date.now()};
    setMessages([g]);setShowHistory(false);};

  const onKey=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  const taR=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const el=taR.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';},[composerText]);

  const lastU=[...messages].reverse().find(m=>m.role==='user')??null;
  const lastA=[...messages].reverse().find(m=>m.role==='assistant'&&m.mode===mode)??null;
  const showMsg=busy?lastU:(lastA??lastU);
  const copyMsg=async(m:StoredMsg)=>{try{await navigator.clipboard.writeText(m.content);}catch{}};

  const canSend=composerText.trim().length>0&&!busy;

  return(
    <div className="mlv" data-mode={mode} style={{position:'fixed',inset:0,width:'100vw',height:'100vh',background:'#000',overflow:'hidden'}}>
      {consentReady&&!consentGranted&&<MedhaConsentSlab onGranted={(_:ConsentSnapshot)=>setConsentGranted(true)}/>}
      {mounted&&<VoidCanvas/>}
      {mounted&&<MedhaLair entityX={rp.x/100} entityY={rp.y/100} facultyColor={fc} onReact={pixieReact}/>}
      <Entity es={es} fc={fc} rp={rp} vis={vis} vsrc="/assets/medha-dormant.mp4"/>
      {mounted&&<PB color={burstColor} active={burst}/>}
      {mounted&&stream.active&&(
        <CosmicStream
          active={stream.active}
          color={stream.color}
          colorSecondary={stream.colorSecondary}
          entityX={rp.x/100}
          entityY={rp.y/100}
          duration={3200}
          onComplete={handleStreamComplete}
        />
      )}

      {/* Header */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:50,padding:'16px 18px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <button onClick={back} style={{display:'flex',alignItems:'center',gap:'6px',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',padding:'5px 12px',cursor:'pointer',color:'rgba(255,255,255,0.35)',fontSize:'10px',letterSpacing:'0.2em',textTransform:'uppercase',fontFamily:'system-ui'}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>Śūnya
        </button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'12px',letterSpacing:'0.35em',color:'rgba(255,255,255,0.7)',textTransform:'uppercase'}}>MEDHĀ</div>
          <div style={{fontSize:'9px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.25)',fontFamily:'system-ui',marginTop:'2px',textTransform:'uppercase'}}>
            {es.toUpperCase()}<span style={{color:fc,marginLeft:'6px'}}>· {mdef.name}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px'}}>
          <button onClick={()=>setShowHistory(v=>!v)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',color:'rgba(255,255,255,0.3)',fontSize:'10px',letterSpacing:'0.18em',textTransform:'uppercase',padding:'5px 9px',cursor:'pointer',fontFamily:'system-ui'}}>⟲</button>
          <button onClick={()=>setShowSettings(true)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',color:'rgba(255,255,255,0.35)',fontSize:'13px',padding:'4px 9px',cursor:'pointer'}}>⚙</button>
        </div>
      </div>

      {/* Message bubble */}
      <AnimatePresence mode="wait">
        {showMsg&&!isTyping&&<Bubble key={showMsg.id} msg={showMsg} rp={rp} fc={fc} onCopy={copyMsg}/>}
      </AnimatePresence>

      {/* Greeting */}
      <AnimatePresence>
        {greetingText&&(
          <motion.div key={greetingText} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.5}}
            style={{position:'fixed',bottom:'22%',left:'50%',transform:'translateX(-50%)',zIndex:45,textAlign:'center',pointerEvents:'none',maxWidth:'360px',padding:'0 20px'}}>
            <div style={{fontSize:'9px',letterSpacing:'0.25em',color:fc,textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'8px'}}>{getMode(greetingMode).name}</div>
            <p style={{fontFamily:'Georgia,serif',fontSize:'14px',lineHeight:'1.65',color:'rgba(255,255,255,0.6)',fontStyle:'italic',letterSpacing:'0.02em'}}>{greetingText}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:40,padding:'8px 14px 22px'}}>
        <div style={{maxWidth:'560px',margin:'0 auto'}}>
          {/* Faculty selector */}
          <div style={{marginBottom:'8px',position:'relative'}}>
            <FacultySel mode={mode} onSelect={k=>actModel(k)}/>
          </div>
          {/* Composer */}
          <div style={{position:'relative',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',backdropFilter:'blur(12px)'}}>
            <textarea ref={taR} value={composerText}
              onChange={e=>{setComposerText(e.target.value);setIsTyping(e.target.value.length>0);}}
              onFocus={()=>setIsTyping(true)} onBlur={()=>{if(!composerText.trim())setIsTyping(false);}}
              onKeyDown={onKey} placeholder={listening?'Listening…':`Speak to ${mdef.name}…`}
              rows={1} disabled={busy} maxLength={1000}
              style={{width:'100%',background:'transparent',border:'none',outline:'none',resize:'none',color:'rgba(255,255,255,0.8)',fontSize:'14px',lineHeight:'1.55',letterSpacing:'0.02em',fontFamily:'system-ui',padding:'12px 106px 11px 14px',maxHeight:'120px',overflow:'auto',scrollbarWidth:'none',opacity:busy?0.5:1}}/>
            <div style={{position:'absolute',right:'7px',bottom:'7px',display:'flex',gap:'5px',alignItems:'center'}}>
              <button onClick={()=>fileR.current?.click()} title="Attach"
                style={{width:'28px',height:'28px',borderRadius:'50%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <button onClick={()=>{const s=sttR.current;if(!s?.isSupported())return;if(listening){s.stop();setListening(false);setEs('dormant');return;}setListening(true);setEs('voice-listening');s.start({onText:t=>setComposerText(t),onEnd:()=>{setListening(false);setEs('dormant');},onError:()=>{setListening(false);setEs('dormant');}});}}
                style={{width:'28px',height:'28px',borderRadius:'50%',background:listening?'rgba(220,38,38,0.18)':'rgba(255,255,255,0.04)',border:`1px solid ${listening?'rgba(220,38,38,0.35)':'rgba(255,255,255,0.07)'}`,color:listening?'#f87171':'rgba(255,255,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {listening?<motion.div animate={{scale:[1,1.3,1]}} transition={{duration:0.8,repeat:Infinity,ease:'easeInOut'}} style={{width:'7px',height:'7px',borderRadius:'50%',background:'#f87171'}}/>
                  :<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
              </button>
              <button onClick={send} disabled={!canSend}
                style={{width:'28px',height:'28px',borderRadius:'50%',background:canSend?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.09)',color:canSend?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.18)',cursor:canSend?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                {busy?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:'8px',height:'8px',borderRadius:'50%',border:'1px solid rgba(255,255,255,0.5)',borderTopColor:'transparent'}}/>
                  :<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}
              </button>
            </div>
            <AnimatePresence>{busy&&<motion.div initial={{scaleX:0,opacity:0}} animate={{scaleX:1,opacity:1}} exit={{scaleX:0,opacity:0}} style={{position:'absolute',bottom:0,left:'10px',right:'10px',height:'1px',background:`linear-gradient(90deg,${fc},#7b2fff,${fc})`,transformOrigin:'left',borderRadius:'1px'}}/>}</AnimatePresence>
          </div>
          <p style={{textAlign:'center',color:'rgba(255,255,255,0.11)',fontSize:'9px',letterSpacing:'0.16em',fontFamily:'system-ui',textTransform:'uppercase',marginTop:'7px'}}>Enter · Shift+Enter new line</p>
        </div>
      </div>

      {/* History modal */}
      <AnimatePresence>
        {showHistory&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}
            onClick={e=>{if(e.target===e.currentTarget)setShowHistory(false);}}>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={e=>e.stopPropagation()} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}/>
            <motion.div initial={{opacity:0,scale:0.94}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.94}} transition={{duration:0.4,ease:[0.16,1,0.3,1]}} onClick={e=>e.stopPropagation()}
              style={{position:'relative',zIndex:1,width:'100%',maxWidth:'480px',maxHeight:'75vh',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',backdropFilter:'blur(20px)',display:'flex',flexDirection:'column'}}>
              <div style={{padding:'22px 22px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'13px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.8)',textTransform:'uppercase'}}>Conversation Threads</div>
                <button onClick={()=>setShowHistory(false)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'rgba(255,255,255,0.4)',padding:'5px 9px',cursor:'pointer',fontSize:'11px'}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'10px 14px',scrollbarWidth:'none'}}>
                {chats.length===0&&<p style={{color:'rgba(255,255,255,0.25)',fontFamily:'system-ui',fontSize:'13px',textAlign:'center',padding:'20px 0'}}>No conversations yet.</p>}
                {chats.map(c=>(
                  <div key={c.id} style={{display:'flex',gap:'8px',marginBottom:'7px',padding:'11px',background:c.id===chatId?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'11px'}}>
                    <button onClick={()=>{const ch=getChat(c.id);if(!ch)return;setChatId(ch.id);setCurrentChatId(ch.id);setMessages(ch.messages);setShowHistory(false);}} style={{flex:1,background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
                      <div style={{fontSize:'13px',color:'rgba(255,255,255,0.75)',fontFamily:'system-ui',marginBottom:'3px'}}>{c.title||'Untitled'}</div>
                      <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',fontFamily:'system-ui'}}>{new Date(c.lastInteractionAt).toLocaleString()} · {c.messages.length} msgs</div>
                    </button>
                    <button onClick={()=>{deleteChat(c.id);setChats(listChats());if(c.id===chatId)newChat();}} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.2)',cursor:'pointer',fontSize:'12px',padding:'0 4px'}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{padding:'14px 22px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                <button onClick={newChat} style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.7)',fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',fontFamily:'system-ui',cursor:'pointer'}}>+ New Conversation</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings&&(
          <><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:190,backdropFilter:'blur(4px)'}}/>
          <motion.div initial={{opacity:0,x:'100%'}} animate={{opacity:1,x:0}} exit={{opacity:0,x:'100%'}} transition={{duration:0.4,ease:[0.16,1,0.3,1]}}
            style={{position:'fixed',top:0,right:0,bottom:0,width:'min(360px,100vw)',zIndex:200,background:'rgba(0,0,0,0.96)',borderLeft:'1px solid rgba(255,255,255,0.06)',backdropFilter:'blur(20px)',overflowY:'auto',padding:'24px',scrollbarWidth:'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'26px'}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'13px',letterSpacing:'0.3em',color:'rgba(255,255,255,0.8)',textTransform:'uppercase'}}>Settings</div>
              <button onClick={()=>setShowSettings(false)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'rgba(255,255,255,0.4)',padding:'6px 10px',cursor:'pointer',fontSize:'12px'}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'22px'}}>
              <section>
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Cognitive Mode</div>
                {COGNITIVE_MODES.map(m=>(
                  <button key={m.key} onClick={()=>{actModel(m.key);setShowSettings(false);}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'9px 11px',background:mode===m.key?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${mode===m.key?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.04)'}`,borderRadius:'10px',cursor:'pointer',textAlign:'left',marginBottom:'6px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:FC[m.key],boxShadow:`0 0 7px ${FC[m.key]}`,flexShrink:0}}/>
                    <div><div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',fontFamily:'system-ui'}}>{m.name}</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'system-ui'}}>{m.englishName}</div></div>
                  </button>
                ))}
              </section>
              <section>
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Voice</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'13px',color:'rgba(255,255,255,0.6)',fontFamily:'system-ui'}}>Voice Reply (TTS)</span>
                  <button onClick={()=>setTtsEnabled(v=>{if(v)ttsR.current?.cancel();return!v;})}
                    style={{width:'40px',height:'22px',borderRadius:'11px',background:ttsEnabled?'rgba(123,47,255,0.6)':'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',position:'relative',transition:'all 0.2s'}}>
                    <div style={{position:'absolute',top:'3px',left:ttsEnabled?'21px':'3px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                  </button>
                </div>
              </section>
              <section>
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>History</div>
                <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',fontFamily:'system-ui',marginBottom:'10px'}}>{chats.length} conversation{chats.length!==1?'s':''} stored</div>
                <button onClick={()=>{if(!confirm('Erase ALL conversations?'))return;chats.forEach(c=>deleteChat(c.id));setChats([]);newChat();}}
                  style={{width:'100%',padding:'10px',background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:'8px',color:'rgba(220,100,100,0.7)',fontSize:'11px',letterSpacing:'0.15em',textTransform:'uppercase',fontFamily:'system-ui',cursor:'pointer'}}>
                  Erase All Conversations
                </button>
              </section>
            </div>
          </motion.div></>
        )}
      </AnimatePresence>

      {/* Quota lock */}
      {showQuotaLock&&(
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',padding:'24px'}}>
          <div style={{maxWidth:'400px',width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',padding:'32px',backdropFilter:'blur(20px)'}}>
            <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,200,160,0.5)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px'}}>Cognition Threshold</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'rgba(255,255,255,0.85)',marginBottom:'10px'}}>You have reached the visitor limit.</h2>
            <p style={{fontFamily:'system-ui',fontSize:'13px',color:'rgba(255,255,255,0.5)',lineHeight:'1.65',marginBottom:'22px'}}>Medhā grants every wanderer <strong style={{color:'rgba(255,255,255,0.7)'}}>{quotaLimit('medha')} conversations</strong> as a first taste.</p>
            <div style={{display:'flex',flexDirection:'column',gap:'9px',marginBottom:'18px'}}>
              <input type="text" placeholder="Your name" value={regName} onChange={e=>setRegName(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',color:'rgba(255,255,255,0.8)',fontSize:'13px',fontFamily:'system-ui',padding:'9px 13px',outline:'none'}}/>
              <input type="email" placeholder="you@domain.com" value={regEmail} onChange={e=>setRegEmail(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',color:'rgba(255,255,255,0.8)',fontSize:'13px',fontFamily:'system-ui',padding:'9px 13px',outline:'none'}}/>
              {regErr&&<div style={{fontSize:'12px',color:'rgba(220,100,100,0.8)',fontFamily:'system-ui'}}>{regErr}</div>}
              <button onClick={subReg} disabled={regBusy||!regEmail.trim()} style={{padding:'11px',background:'rgba(123,47,255,0.2)',border:'1px solid rgba(123,47,255,0.3)',borderRadius:'10px',color:'rgba(200,160,255,0.9)',fontSize:'11px',letterSpacing:'0.18em',textTransform:'uppercase',fontFamily:'system-ui',cursor:regBusy||!regEmail.trim()?'not-allowed':'pointer',opacity:regBusy||!regEmail.trim()?0.5:1}}>
                {regBusy?'Transmitting…':'Register with VYAN'}
              </button>
            </div>
            <p style={{fontSize:'11px',color:'rgba(255,255,255,0.2)',fontFamily:'system-ui',textAlign:'center'}}>VYAN will send a verification to your address.</p>
          </div>
        </div>
      )}

      <input ref={fileR} type="file" accept="image/*,.pdf,.txt,.md,.json,.csv" style={{display:'none'}}
        onChange={e=>{const f=e.target.files?.[0];if(!f)return;setComposerText(c=>`${c}\n\n[attached: ${f.name} · ${(f.size/1024).toFixed(1)}KB]`);setIsTyping(true);e.target.value='';}}/>
    </div>
  );
}

// ─── Faculty selector ──────────────────────────────────────────────────────────
function FacultySel({mode,onSelect}:{mode:CognitiveModeKey;onSelect:(k:CognitiveModeKey)=>void}){
  const[open,setOpen]=useState(false);const cur=getMode(mode);const color=FC[mode];
  return(
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:'7px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',padding:'5px 11px',cursor:'pointer'}}>
        <div style={{width:'6px',height:'6px',borderRadius:'50%',background:color,boxShadow:`0 0 6px ${color}`}}/>
        <span style={{fontSize:'11px',letterSpacing:'0.15em',color:'rgba(255,255,255,0.6)',fontFamily:'system-ui',textTransform:'uppercase'}}>{cur.name}</span>
        <span style={{fontSize:'9px',color:'rgba(255,255,255,0.25)'}}>▾</span>
      </button>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{opacity:0,y:-8,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:0.96}} transition={{duration:0.18}}
            style={{position:'absolute',bottom:'100%',left:0,marginBottom:'8px',background:'rgba(0,0,0,0.97)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'14px',padding:'6px',minWidth:'220px',zIndex:100,backdropFilter:'blur(20px)'}}>
            {COGNITIVE_MODES.map(m=>(
              <button key={m.key} onClick={()=>{onSelect(m.key);setOpen(false);}}
                style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'9px 11px',background:mode===m.key?'rgba(255,255,255,0.05)':'transparent',border:'none',borderRadius:'9px',cursor:'pointer',textAlign:'left'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:FC[m.key],boxShadow:`0 0 7px ${FC[m.key]}`,flexShrink:0}}/>
                <div><div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',fontFamily:'system-ui'}}>{m.name}</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'system-ui'}}>{m.englishName}</div></div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
