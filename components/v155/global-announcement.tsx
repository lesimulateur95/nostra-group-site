"use client";
import { useEffect, useState } from "react";
import styles from "./v155.module.css";

export function GlobalAnnouncementV155({announcement}:{announcement:any|null}){
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{if(!announcement)return; try{setHidden(localStorage.getItem(`nostra-ann-${announcement.id}`)==="1");}catch{}},[announcement]);
  if(!announcement||hidden)return null;
  return <div className={`${styles.announcement} ${announcement.severity==="critical"?styles.announcementCritical:""}`}>
    <strong>{announcement.title}</strong> · {announcement.message}
    {announcement.dismissible&&<button onClick={()=>{try{localStorage.setItem(`nostra-ann-${announcement.id}`,"1");}catch{} setHidden(true);}} style={{marginLeft:14,background:"transparent",border:0,color:"inherit",cursor:"pointer",fontWeight:800}}>✕</button>}
  </div>;
}
