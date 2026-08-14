"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MysteryEventV156 } from "@/lib/v156/data";
import styles from "./v156.module.css";

export function MysteryEventClientV156({event}:{event:MysteryEventV156|null}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
  if(!event)return <div className={styles.notice}>Aucun événement mystère n’est annoncé pour le moment.</div>;
  const target=new Date(event.revealAt).getTime();
  const left=Math.max(0,target-now);
  const total=Math.floor(left/1000);
  const days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
  const revealed=left<=0;
  return <section className={styles.mystery}><span className={styles.eyebrow}>{revealed?"LE SECRET EST RÉVÉLÉ":"ÉVÉNEMENT MYSTÈRE"}</span><h2>{revealed?(event.revealedTitle||event.teaserTitle):event.teaserTitle}</h2><p>{revealed?(event.revealedText||event.teaserText):event.teaserText}</p>{!revealed&&<div className={styles.countdown}>{[[days,"Jours"],[hours,"Heures"],[minutes,"Minutes"],[seconds,"Secondes"]].map(([value,label])=><div className={styles.countdownBox} key={String(label)}><strong>{String(value).padStart(2,"0")}</strong><span>{label}</span></div>)}</div>}{revealed&&event.targetUrl&&<Link className={styles.button} href={event.targetUrl}>Découvrir maintenant</Link>}</section>;
}
