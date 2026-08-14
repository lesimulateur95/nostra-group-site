import { MysteryEventClientV156 } from "@/components/v156/mystery-event-client";
import { getCurrentMysteryEventV156 } from "@/lib/v156/data";
import styles from "@/components/v156/v156.module.css";

export default async function MysteryEventPage(){
  const event=await getCurrentMysteryEventV156();
  return <main className={styles.page}><section className={styles.hero}><span className={styles.eyebrow}>NOSTRA GROUP</span><h1>Événement mystère</h1><p>Une annonce peut se révéler automatiquement à l’heure choisie par la Direction.</p></section><MysteryEventClientV156 event={event}/></main>;
}
