import Link from "next/link";

export default async function RestrictedAccessPage({ searchParams }:{ searchParams: Promise<{reason?:string;scope?:string;until?:string}>}){
  const params=await searchParams;
  const scopeLabels:Record<string,string>={all:"Nostra Group",motors:"Nostra Motors",circuit:"Nostra Circuit",academy:"Nostra Racing Academy",cercle:"Nostra Cercle",events:"Événements & Jeux"};
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#050505",color:"white",padding:24}}><section style={{width:"min(680px,100%)",border:"1px solid rgba(212,175,55,.45)",borderRadius:24,padding:32,background:"#0d0d0d"}}><p style={{color:"#d9b83f",letterSpacing:3,fontWeight:800}}>NOSTRA GROUP</p><h1>Accès temporairement restreint</h1><p>Ton accès à <strong>{scopeLabels[params.scope??"all"]??"ce service"}</strong> est actuellement restreint par la Direction.</p><p>{params.reason||"Restriction interne en cours."}</p>{params.until&&<p>Fin prévue : {new Date(params.until).toLocaleString("fr-FR")}</p>}<Link href="/profil" style={{display:"inline-block",marginTop:16,color:"#f0ca46"}}>← Retour à mon profil</Link></section></main>;
}
