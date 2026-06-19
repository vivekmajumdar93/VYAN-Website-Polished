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
import { useCosmicStream } from '@/hooks/useCosmicStream';
import { MedhaLair } from '@/components/MedhaLair';
import { StardustRain } from '@/components/StardustRain';
import { HangingOrbs } from '@/components/HangingOrbs';
import { FloatingText } from '@/components/FloatingText';
import { NeuralStrip } from '@/components/NeuralStrip';
import { ChatHistoryModal } from '@/components/ChatHistoryModal';
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
  // Ethereal "gaining intelligence" bloom — no shake, just a slow luminous swell.
  switching:       {sc:1.070,br:1.20,ro:0,  dy:5, dd:2.2,ao:0.26,ps:1.6},
};

// ─── Entity home position ─────────────────────────────────────────────────────
// Medhā's home is the exact center of the screen. Her idle float drifts gently
// in any direction from this anchor; she also occasionally wanders to a nearby
// resting point (see entityPos state) and returns.
const ENTITY_POS = { x: 25, y: 38 };

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
      wisps=[];for(let i=0;i<3;i++)wisps.push({x:Math.random()*c.width,y:Math.random()*c.height,w:c.width*(0.18+Math.random()*0.22),h:c.height*(0.10+Math.random()*0.10),o:Math.random()*0.009+0.002,c:cl[Math.floor(Math.random()*cl.length)],dx:(Math.random()-0.5)*0.012,dy:(Math.random()-0.5)*0.007});
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
        if(s.l===2){const g=x.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3);g.addColorStop(0,`rgba(255,255,255,${op*0.22})`);g.addColorStop(1,'rgba(255,255,255,0)');x.beginPath();x.arc(s.x,s.y,s.r*3,0,6.28);x.fillStyle=g;x.fill();}
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

// ─── Intelligence bloom ────────────────────────────────────────────────────────
// Soft stardust drifts inward and converges into a glowing halo around Medhā —
// an arrival of cognition, not an explosion. Particles spiral gently inward,
// brighten, and dissolve into a slow bloom-and-fade.
function PB({color,active,ex=0.5,ey=0.5}:{color:string;active:boolean;ex?:number;ey?:number}){
  const cr=useRef<HTMLCanvasElement>(null);const ar=useRef<number>(0);
  useEffect(()=>{
    if(!active)return;const c=cr.current;if(!c)return;const x=c.getContext('2d');if(!x)return;
    c.width=window.innerWidth;c.height=window.innerHeight;
    const cx=c.width*ex,cy=c.height*ey;
    const ps=Array.from({length:48},()=>{
      const a=Math.random()*Math.PI*2,r0=80+Math.random()*320;
      return{a,r0,sz:0.6+Math.random()*2.2,ph:Math.random()*Math.PI*2};
    });
    const st=performance.now();const dur=2800;
    const drw=(now:number)=>{
      const e=Math.min((now-st)/dur,1);
      if(e>=1){x.clearRect(0,0,c.width,c.height);return;}
      x.clearRect(0,0,c.width,c.height);
      // Bloom halo — swells then fades
      const haloR=24+140*(1-Math.abs(e-0.5)*2);
      const haloOp=Math.sin(e*Math.PI)*0.35;
      const g=x.createRadialGradient(cx,cy,0,cx,cy,haloR);
      g.addColorStop(0,`${color}${Math.floor(haloOp*255).toString(16).padStart(2,'0')}`);
      g.addColorStop(1,`${color}00`);
      x.beginPath();x.arc(cx,cy,haloR,0,Math.PI*2);x.fillStyle=g;x.fill();
      // Stardust spiraling inward
      const ease=1-Math.pow(1-e,3);
      for(const p of ps){
        const r=p.r0*(1-ease);
        const px=cx+Math.cos(p.a+e*1.4)*r;
        const py=cy+Math.sin(p.a+e*1.4)*r;
        const twinkle=0.5+0.5*Math.sin(now*0.01+p.ph);
        const op=(1-e)*twinkle;
        x.beginPath();x.arc(px,py,p.sz*(1-e*0.4),0,Math.PI*2);
        x.fillStyle=`rgba(255,255,255,${op*0.9})`;x.fill();
      }
      ar.current=requestAnimationFrame(drw);
    };
    ar.current=requestAnimationFrame(drw);
    return()=>cancelAnimationFrame(ar.current);
  },[active,color,ex,ey]);
  if(!active)return null;
  return <canvas ref={cr} style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:60,pointerEvents:'none'}}/>;
}

// ─── Neural rail ───────────────────────────────────────────────────────────────
// A vertical line of dots at the screen's extreme right edge — lights up
// progressively as the conversation deepens, the newest dot pulsing.
function NeuralRail({count,color}:{count:number;color:string}){
  const total=9;const lit=Math.min(count,total);
  return(
    <div style={{position:'fixed',right:'8px',top:'50%',transform:'translateY(-50%)',zIndex:45,display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',pointerEvents:'none'}}>
      {Array.from({length:total}).map((_,i)=>{
        const isLit=i<lit;const isNewest=i===lit-1;
        return(
          <motion.div key={i}
            animate={isNewest?{opacity:[0.45,1,0.45],scale:[0.85,1.2,0.85]}:{opacity:isLit?0.55:0.10,scale:1}}
            transition={isNewest?{duration:1.6,repeat:Infinity,ease:'easeInOut'}:{duration:0.6}}
            style={{width:'3px',height:'3px',borderRadius:'50%',background:isLit?color:'rgba(255,255,255,0.18)',boxShadow:isLit?`0 0 5px ${color}`:'none'}}/>
        );
      })}
    </div>
  );
}

// ─── Watermark pixie ─────────────────────────────────────────────────────────────
// A tiny companion who perches over the source video's corner watermark and
// travels with Medhā wherever she drifts — no cropping needed, and her wings
// stay whole. She is the record-keeper: a click opens the conversation glass panel.
function WatermarkPixie({color,onClick}:{color:string;onClick:()=>void}){
  return(
    <motion.button onClick={onClick} aria-label="Open conversation record" title="Open conversation record"
      initial={{opacity:0}} animate={{opacity:1,y:[0,-4,0]}}
      transition={{opacity:{duration:1.4,delay:1.2},y:{duration:3.6,repeat:Infinity,ease:'easeInOut'}}}
      style={{position:'absolute',right:'6%',bottom:'10%',width:'9%',height:'9%',minWidth:'20px',minHeight:'20px',maxWidth:'34px',maxHeight:'34px',background:'transparent',border:'none',padding:0,margin:0,cursor:'pointer',pointerEvents:'auto',zIndex:11,display:'flex',alignItems:'center',justifyContent:'center'}}>
      {/* Glow halo — pulses gently to invite a click */}
      <motion.div animate={{opacity:[0.3,0.65,0.3],scale:[0.9,1.2,0.9]}} transition={{duration:2.8,repeat:Infinity,ease:'easeInOut'}}
        style={{position:'absolute',inset:'-70%',borderRadius:'50%',background:`radial-gradient(circle,${color} 0%,transparent 70%)`,filter:'blur(5px)'}}/>
      {/* Wings — soft fluttering ellipses */}
      <motion.div animate={{scaleX:[1,0.55,1]}} transition={{duration:0.85,repeat:Infinity,ease:'easeInOut'}}
        style={{position:'absolute',width:'150%',height:'85%',borderRadius:'50%',border:`1px solid ${color}`,opacity:0.55}}/>
      <motion.div animate={{scaleY:[1,0.55,1]}} transition={{duration:0.85,repeat:Infinity,ease:'easeInOut',delay:0.12}}
        style={{position:'absolute',width:'85%',height:'150%',borderRadius:'50%',border:`1px solid ${color}`,opacity:0.4}}/>
      {/* Core */}
      <div style={{position:'relative',width:'42%',height:'42%',borderRadius:'50%',background:'rgba(255,255,255,0.95)',boxShadow:`0 0 6px 2px ${color}`}}/>
    </motion.button>
  );
}

// ─── Entity ────────────────────────────────────────────────────────────────────
// Anchored at the center of the screen — drifts gently in any direction, then returns.
// May also wander to a nearby resting point (pos), fading out and back in en route.
function Entity({es,fc,vis,vsrc,pos,onPixieClick}:{es:ES;fc:string;vis:boolean;vsrc?:string;pos:{x:number;y:number};onPixieClick:()=>void}){
  const vr=useRef<HTMLVideoElement>(null);const cfg=SC[es];
  useEffect(()=>{const v=vr.current;if(!v)return;const play=()=>v.play().catch(()=>{});v.addEventListener('canplay',play);if(v.readyState>=3)play();return()=>v.removeEventListener('canplay',play);},[vsrc]);
  // Outer wrapper animates `left`/`top` only — framer-motion rewrites the
  // `transform` CSS property for x/y/scale/rotate animations, which would
  // clobber the static translate(-50%,-50%) centering below. left/top are
  // safe to animate alongside a static transform.
  return(
    <motion.div initial={false} animate={{left:`${pos.x}%`,top:`${pos.y}%`}} transition={{duration:3.2,ease:[0.22,1,0.36,1]}}
      style={{position:'fixed',transform:'translate(-50%,-50%)',zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <motion.div animate={{opacity:[cfg.ao*0.3,cfg.ao*0.6,cfg.ao*0.3]}} transition={{duration:cfg.ps,repeat:Infinity,ease:'easeInOut'}}
        style={{position:'absolute',width:'22vmin',height:'7vmin',borderRadius:'50%',background:`radial-gradient(ellipse at center,${fc} 0%,transparent 70%)`,filter:'blur(22px)',top:'56%',zIndex:9}}/>
      <motion.div initial={{opacity:0,scale:0.85,filter:'blur(12px)'}} animate={{opacity:vis?1:0,scale:vis?1:0.85,filter:vis?'blur(0px)':'blur(12px)'}}
        transition={{opacity:{duration:1.6},scale:{duration:1.8},filter:{duration:1.6}}}
        style={{position:'relative',zIndex:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <motion.div
          animate={{scale:cfg.sc,rotate:cfg.ro>0?[0,cfg.ro,0,-cfg.ro,0]:0,x:[0,cfg.dy/2,0,-cfg.dy/2,0],y:[-cfg.dy/2,cfg.dy/2,0,cfg.dy/2,-cfg.dy/2],filter:`brightness(${cfg.br})`}}
          transition={{scale:{duration:1.2,ease:[0.16,1,0.3,1]},rotate:{duration:cfg.dd*2,repeat:Infinity,ease:'easeInOut'},x:{duration:cfg.dd*1.6,repeat:Infinity,ease:'easeInOut'},y:{duration:cfg.dd,repeat:Infinity,ease:'easeInOut'},filter:{duration:1.0}}}
          style={{width:'72vmin',height:'72vmin',position:'relative'}}>
          {vsrc
            ?<video ref={vr} src={vsrc} autoPlay loop muted playsInline preload="auto" style={{width:'100%',height:'100%',objectFit:'contain',display:'block',mixBlendMode:'screen',background:'transparent'}}/>
            // eslint-disable-next-line @next/next/no-img-element
            :<img src="/assets/medha-entity.png" alt="MEDHĀ" style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
          }
          {/* The record-keeper pixie — perches over the source video's corner
              watermark and travels with Medhā. Click her to open the transcript. */}
          {vsrc&&<WatermarkPixie color={fc} onClick={onPixieClick}/>}
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {(es==='responding'||es==='voice-active')&&(
          <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:[1,1.08,1],opacity:[0.06,0.12,0.06]}} exit={{opacity:0}}
            transition={{duration:cfg.ps,repeat:Infinity}}
            style={{position:'absolute',width:'46vmin',height:'46vmin',borderRadius:'50%',border:`1px solid ${fc}`,zIndex:8}}/>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────
// Renders inline in the transcript — no floating/roaming position of its own.
function Bubble({msg,fc,onCopy,isLast,onRegenerate}:{msg:StoredMsg;fc:string;onCopy:(m:StoredMsg)=>void;isLast?:boolean;onRegenerate?:()=>void}){
  const isU=msg.role==='user';
  return(
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.4,ease:[0.16,1,0.3,1]}}
      style={{width:'100%',display:'flex',flexDirection:'column',alignItems:isU?'flex-end':'flex-start',gap:'6px'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'8px',flexDirection:isU?'row-reverse':'row'}}>
        <div style={{paddingTop:'10px',flexShrink:0}}><NL color={isU?'rgba(255,255,255,0.3)':fc} align={isU?'right':'left'}/></div>
        <div onClick={()=>onCopy(msg)} style={{maxWidth:'min(72vw,340px)',padding:isU?'10px 14px':'11px 15px',background:isU?'rgba(255,255,255,0.05)':'rgba(255,218,185,0.10)',border:isU?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(255,200,160,0.18)',borderRadius:isU?'14px 14px 3px 14px':'3px 14px 14px 14px',fontSize:'12px',lineHeight:'1.68',letterSpacing:'0.02em',color:isU?'rgba(255,255,255,0.78)':'rgba(255,225,195,0.9)',fontFamily:'system-ui',wordBreak:'break-word',whiteSpace:'pre-wrap',cursor:'pointer'}}>
          {msg.role==='assistant'?<div dangerouslySetInnerHTML={{__html:renderMarkdown(msg.content)}} className="medha-md"/>:msg.content}
        </div>
      </div>
      {!isU&&isLast&&onRegenerate&&(
        <button onClick={onRegenerate} style={{marginLeft:'34px',display:'flex',alignItems:'center',gap:'5px',background:'transparent',border:'none',color:'rgba(255,255,255,0.25)',fontSize:'9px',letterSpacing:'0.18em',textTransform:'uppercase',fontFamily:'system-ui',cursor:'pointer',padding:'2px 0'}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
          Regenerate
        </button>
      )}
    </motion.div>
  );
}

// ─── Typing indicator ──────────────────────────────────────────────────────────
function ThinkingBubble({fc}:{fc:string}){
  return(
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.3}}
      style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'6px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        <div style={{width:'5px',height:'5px',borderRadius:'50%',background:fc,boxShadow:`0 0 4px ${fc}`}}/>
        <span style={{fontSize:'9px',letterSpacing:'0.22em',color:'rgba(255,200,160,0.4)',textTransform:'uppercase',fontFamily:'system-ui'}}>MEDHĀ</span>
      </div>
      <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
        <div style={{paddingTop:'10px',flexShrink:0}}><NL color={fc} align="left"/></div>
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
  const [stardustActive, setStardustActive] = useState(false);
  const [stardustColor, setStardustColor] = useState('#7b2fff');
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [floatingText, setFloatingText] = useState('');
  const [floatingRole, setFloatingRole] = useState<'assistant'|'user'>('assistant');
  const [floatingVisible, setFloatingVisible] = useState(false);
  const [userColor, setUserColor] = useState('#d4a853');
  const[showSettings,setShowSettings]=useState(false);const[listening,setListening]=useState(false);
  const[ttsEnabled,setTtsEnabled]=useState(false);const[chats,setChats]=useState<StoredChat[]>([]);
  const[responseStyle,setResponseStyle]=useState<'concise'|'balanced'|'detailed'>('balanced');
  const[quotaUser,setQuotaUser]=useState<LocalUser|null>(null);const[showQuotaLock,setShowQuotaLock]=useState(false);
  const[regBusy,setRegBusy]=useState(false);const[regErr,setRegErr]=useState('');
  const[regName,setRegName]=useState('');const[regEmail,setRegEmail]=useState('');
  const[consentGranted,setConsentGranted]=useState(false);const[consentReady,setConsentReady]=useState(false);
  const[greetingText,setGreetingText]=useState<string|null>(null);const[greetingMode,setGreetingMode]=useState<CognitiveModeKey>('prajna');
  const[es,setEs]=useState<ES>('dormant');
  const[burst,setBurst]=useState(false);const[burstColor,setBurstColor]=useState('#e8e4ff');
  const[mounted,setMounted]=useState(false);
  // Medhā's wandering — she rests at center, occasionally fades and drifts elsewhere, then returns.
  const[entityPos,setEntityPos]=useState({x:ENTITY_POS.x,y:ENTITY_POS.y});
  const[entityVisible,setEntityVisible]=useState(true);
  const travelRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const { stream, triggerStream, handleStreamComplete } = useCosmicStream();
  // Ambient stream timer
  const ambientStreamRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const sttR=useRef<STT|null>(null);const ttsR=useRef<TTS|null>(null);
  const gtR=useRef<ReturnType<typeof setTimeout>|null>(null);
  const floatingTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const transcriptRef=useRef<HTMLDivElement>(null);
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

  // Ambient wandering — Medhā occasionally dissolves, drifts to a nearby
  // point (or returns home), and re-materialises. Always within reach of center.
  useEffect(()=>{
    let alive=true;
    const cycle=()=>{
      travelRef.current=setTimeout(()=>{
        if(!alive)return;
        setEntityVisible(false);
        setTimeout(()=>{
          if(!alive)return;
          const goHome=Math.random()<0.4;
          setEntityPos(goHome?{x:ENTITY_POS.x,y:ENTITY_POS.y}:{
            x:Math.min(40,Math.max(15,ENTITY_POS.x+(Math.random()-0.5)*22)),
            y:Math.min(56,Math.max(24,ENTITY_POS.y+(Math.random()-0.5)*24)),
          });
          setEntityVisible(true);
          cycle();
        },1800);
      },28000+Math.random()*32000);
    };
    cycle();
    return()=>{alive=false;if(travelRef.current)clearTimeout(travelRef.current);};
  },[]);

  // Init
  useEffect(()=>{
    const savedColor = typeof window !== 'undefined' ? localStorage.getItem('medha_user_color') : null;
    if (savedColor) setUserColor(savedColor);
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

  useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(showChatHistory||showSettings){setShowChatHistory(false);setShowSettings(false);return;}back();}};
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showChatHistory,showSettings]);

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

  const handleFacultyFromOrb = useCallback((key: string, color: string) => {
    actModel(key as CognitiveModeKey);
    setStardustColor(color);
    setStardustActive(true);
  }, [actModel]);

  const showFloating = useCallback((text: string, role: 'assistant'|'user') => {
    if (floatingTimerRef.current) clearTimeout(floatingTimerRef.current);
    setFloatingText(text);
    setFloatingRole(role);
    setFloatingVisible(true);
    floatingTimerRef.current = setTimeout(() => setFloatingVisible(false), 120000);
  }, []);

  // Shared completion runner — used by both send() and regenerate()
  const runCompletion=useCallback(async(hist:ChatMessage[])=>{
    setBusy(true);await new Promise(r=>setTimeout(r,400));setEs('thinking');
    const styleSuffix=responseStyle==='concise'?' Keep this response brief — a few sentences at most.'
      :responseStyle==='detailed'?' Provide a thorough, detailed response with full context.'
      :'';
    const effMode=styleSuffix?{...mdef,systemPrompt:mdef.systemPrompt+styleSuffix}:mdef;
    try{const full=await chatComplete(effMode,hist);setEs('responding');
      const am:StoredMsg={id:uid(),role:'assistant',content:full||'I lost the signal for a moment. Try again?',mode,ts:Date.now()};
      setMessages(p=>[...p,am]);
      showFloating(am.content, 'assistant');
      setEs('dormant');
      // Intelligence arrives — trigger stream
      triggerStream(mode);
      if(ttsEnabled&&ttsR.current?.isSupported()){const pl=full.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/[*_`#>]/g,'');setEs('voice-active');ttsR.current.speak(pl,{onEnd:()=>setEs('dormant')});}}
    catch{const errMsg='Cognition is momentarily out of reach — try again in a breath.';setMessages(p=>[...p,{id:uid(),role:'assistant',content:errMsg,mode,ts:Date.now()}]);showFloating(errMsg,'assistant');setEs('dormant');}
    finally{setBusy(false);}
  },[mode,mdef,ttsEnabled,triggerStream,responseStyle,showFloating]);

  const send=useCallback(async()=>{
    const tx=composerText.trim();if(!tx||busy)return;
    if(!quotaUser&&!getUser()){if(quotaRemaining('medha')<=0){setShowQuotaLock(true);return;}if(!incrementQuota('medha').ok){setShowQuotaLock(true);return;}}
    setComposerText('');
    const um:StoredMsg={id:uid(),role:'user',content:tx,mode,ts:Date.now()};
    setMessages(p=>[...p,um]);
    showFloating(tx, 'user');
    setEs('listening');
    if(isForbiddenQuery(tx)){setTimeout(()=>{setMessages(p=>[...p,{id:uid(),role:'assistant',content:SANDHI_REDIRECT_MARKDOWN,mode,ts:Date.now()}]);setEs('dormant');},280);return;}
    const hist:ChatMessage[]=[...dataR.current.messages,um].slice(-12).map(m=>({role:m.role,content:m.content}));
    await runCompletion(hist);
  },[composerText,busy,mode,quotaUser,runCompletion,showFloating]);

  // Regenerate — drop the last assistant reply and ask again
  const regenerate=useCallback(async()=>{
    if(busy)return;
    const msgs=dataR.current.messages;
    const lastUserIdx=msgs.map(m=>m.role).lastIndexOf('user');
    if(lastUserIdx===-1)return;
    const trimmed=msgs.slice(0,lastUserIdx+1);
    setMessages(trimmed);
    const hist:ChatMessage[]=trimmed.slice(-12).map(m=>({role:m.role,content:m.content}));
    await runCompletion(hist);
  },[busy,runCompletion]);

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
    setMessages([g]);};

  const onKey=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  const taR=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const el=taR.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';},[composerText]);

  const copyMsg=async(m:StoredMsg)=>{try{await navigator.clipboard.writeText(m.content);}catch{}};

  // Stable stardust complete callback — won't cause StardustRain to re-trigger
  const handleStardustComplete=useCallback(()=>setStardustActive(false),[]);

  // Auto-scroll transcript when it's open
  useEffect(()=>{if(!showTranscript)return;const el=transcriptRef.current;if(!el)return;el.scrollTop=el.scrollHeight;},[messages,busy,showTranscript]);

  const canSend=composerText.trim().length>0&&!busy;

  return(
    <div className="mlv" data-mode={mode} style={{position:'fixed',inset:0,width:'100vw',height:'100vh',background:'#000',overflow:'hidden'}}>
      {consentReady&&!consentGranted&&<MedhaConsentSlab onGranted={(_:ConsentSnapshot)=>setConsentGranted(true)}/>}
      {mounted&&<VoidCanvas/>}
      {mounted&&(
        <MedhaLair
          entityVideoSrc="/assets/medha-dormant.mp4"
          lairVideoSrc="/assets/medha-lair.mp4"
          facultyColor={fc}
          onReact={burst}
          roamPos={entityVisible ? entityPos : undefined}
          entityVisible={entityVisible}
        />
      )}
      {mounted&&<PB color={burstColor} active={burst} ex={entityPos.x/100} ey={entityPos.y/100}/>}
      {mounted&&<NeuralRail count={messages.filter(m=>m.role==='user').length} color={fc}/>}
      {mounted&&stream.active&&(
        <CosmicStream
          active={stream.active}
          color={stream.color}
          colorSecondary={stream.colorSecondary}
          entityX={entityPos.x/100}
          entityY={entityPos.y/100}
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
            {es.toUpperCase()}
          </div>
        </div>
        <div style={{display:'flex',gap:'6px'}}>
          <button onClick={()=>setShowChatHistory(true)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',color:'rgba(255,255,255,0.3)',fontSize:'10px',letterSpacing:'0.18em',textTransform:'uppercase',padding:'5px 9px',cursor:'pointer',fontFamily:'system-ui'}}>⟲</button>
          <button onClick={()=>setShowSettings(true)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',color:'rgba(255,255,255,0.35)',fontSize:'13px',padding:'4px 9px',cursor:'pointer'}}>⚙</button>
        </div>
      </div>

      {/* Composer — always visible, slim bar at the bottom */}
      <div style={{position:'fixed',left:0,right:'auto',width:'min(52vw, 520px)',bottom:0,zIndex:42,padding:'8px 14px 22px 14px',pointerEvents:'none',background:'linear-gradient(to top, rgba(5,2,15,0.4), rgba(5,2,15,0) 110px)'}}>
        <div style={{maxWidth:'min(48vw, 480px)',margin:'0',pointerEvents:'auto'}}>
          <NeuralStrip
            messages={messages}
            facultyColor={fc}
            onEditMessage={(id, content) => {
              setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
            }}
            onOpenTranscript={() => setShowTranscript(v => !v)}
          />
          {/* Faculty selector */}
          <div style={{marginBottom:'8px',position:'relative'}}>
            <FacultySel mode={mode} onSelect={k=>{actModel(k);setStardustColor(FC[k]);setStardustActive(true);}}/>
          </div>
          {/* Composer */}
          <div style={{position:'relative',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',backdropFilter:'blur(12px)'}}>
            <textarea ref={taR} value={composerText}
              onChange={e=>setComposerText(e.target.value)}
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
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Active Mode</div>
                <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 11px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:'10px',marginBottom:'8px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:fc,boxShadow:`0 0 7px ${fc}`,flexShrink:0}}/>
                  <div><div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',fontFamily:'system-ui'}}>{mdef.name}</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'system-ui'}}>{mdef.englishName}</div></div>
                </div>
                <ul style={{margin:0,padding:'0 0 0 16px',display:'flex',flexDirection:'column',gap:'4px'}}>
                  {mdef.capabilities.map(c=>(
                    <li key={c} style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontFamily:'system-ui',lineHeight:'1.5'}}>{c}</li>
                  ))}
                </ul>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.2)',fontFamily:'system-ui',marginTop:'8px'}}>Switch modes from the selector above the composer.</div>
              </section>
              <section>
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Response Style</div>
                <div style={{display:'flex',gap:'6px'}}>
                  {(['concise','balanced','detailed'] as const).map(s=>(
                    <button key={s} onClick={()=>setResponseStyle(s)}
                      style={{flex:1,padding:'8px 6px',background:responseStyle===s?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.02)',border:`1px solid ${responseStyle===s?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)'}`,borderRadius:'8px',color:responseStyle===s?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.35)',fontSize:'10px',letterSpacing:'0.12em',textTransform:'uppercase',fontFamily:'system-ui',cursor:'pointer'}}>
                      {s}
                    </button>
                  ))}
                </div>
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
                <div style={{fontSize:'10px',letterSpacing:'0.25em',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontFamily:'system-ui',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Your Text Color</div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {['#d4a853','#ffffff','#e8c4ff','#a8d8ea','#f0c4a0','#c8f0c8'].map(c=>(
                    <button key={c} onClick={()=>{setUserColor(c);localStorage.setItem('medha_user_color',c);}}
                      style={{width:'24px',height:'24px',borderRadius:'50%',background:c,border:userColor===c?'2px solid #fff':'2px solid transparent',cursor:'pointer',padding:0,outline:'none',boxShadow:userColor===c?`0 0 6px ${c}`:'none',transition:'all 0.2s'}}/>
                  ))}
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

      {/* Stardust rain on faculty switch */}
      {mounted && (
        <StardustRain
          active={stardustActive}
          color={stardustColor}
          onComplete={handleStardustComplete}
        />
      )}

      {/* Hanging orbs on gazebo */}
      <HangingOrbs
        onSettingsOpen={() => setShowSettings(true)}
        onFacultySelect={handleFacultyFromOrb}
        onBack={back}
        activeFaculty={mode}
        entityPos={entityPos}
      />

      {/* Floating text following Medhā — auto-dismisses after 8s */}
      <FloatingText
        text={floatingText}
        role={floatingRole}
        facultyColor={fc}
        roamPos={entityPos}
        visible={floatingVisible && !showSettings && !showChatHistory}
        userColor={userColor}
      />

      {/* Clickable overlay over entity zone — re-shows last floating message */}
      <div
        onClick={() => setFloatingVisible(v => !v)}
        style={{
          position: 'fixed', left: 0, top: 0,
          width: '45%', height: '85%',
          zIndex: 9, cursor: 'pointer',
          background: 'transparent',
        }}
      />

      {/* Conversation transcript — appears only on clicking Medhā */}
      <AnimatePresence>
        {showTranscript && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={()=>setShowTranscript(false)}
              style={{position:'fixed',inset:0,zIndex:38,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)'}}/>
            <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:16}}
              transition={{duration:0.4,ease:[0.16,1,0.3,1]}}
              style={{position:'fixed',left:'50%',transform:'translateX(-50%)',top:'10vh',bottom:'130px',
                width:'min(560px,90vw)',zIndex:39,display:'flex',flexDirection:'column',
                background:'rgba(4,2,14,0.88)',border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'18px',backdropFilter:'blur(18px)',overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:'10px',letterSpacing:'0.28em',color:'rgba(255,255,255,0.4)',fontFamily:'system-ui',textTransform:'uppercase'}}>Conversation</div>
                <button onClick={()=>setShowTranscript(false)} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:'14px',padding:'2px 6px'}}>✕</button>
              </div>
              <div ref={transcriptRef} style={{flex:1,overflowY:'auto',scrollbarWidth:'none',display:'flex',flexDirection:'column',gap:'14px',padding:'14px 16px',WebkitMaskImage:'linear-gradient(to bottom, transparent, black 24px)',maskImage:'linear-gradient(to bottom, transparent, black 24px)'}}>
                {messages.map((m,i)=><Bubble key={m.id} msg={m} fc={fc} onCopy={copyMsg} isLast={i===messages.length-1&&!busy} onRegenerate={messages.length>1&&!busy?regenerate:undefined}/>)}
                <AnimatePresence>{busy&&<ThinkingBubble key="thinking" fc={fc}/>}</AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chat history modal */}
      <ChatHistoryModal
        visible={showChatHistory}
        chats={chats}
        activeChatId={chatId}
        onSelectChat={(id) => {
          const ch = getChat(id);
          if (!ch) return;
          setChatId(ch.id);
          setCurrentChatId(ch.id);
          setMessages(ch.messages);
        }}
        onDeleteChat={(id) => {
          deleteChat(id);
          setChats(listChats());
          if (id === chatId) newChat();
        }}
        onNewChat={newChat}
        onClose={() => setShowChatHistory(false)}
      />

      <input ref={fileR} type="file" accept="image/*,.pdf,.txt,.md,.json,.csv" style={{display:'none'}}
        onChange={e=>{const f=e.target.files?.[0];if(!f)return;setComposerText(c=>`${c}\n\n[attached: ${f.name} · ${(f.size/1024).toFixed(1)}KB]`);e.target.value='';}}/>
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
