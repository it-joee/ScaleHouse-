export type PhraseGroup = "gate" | "weigh" | "inspect" | "variance" | "exit";

export type Phrase = {
  id: string;
  group: PhraseGroup;
  fr: string;
  en: string;
  phonetic: string;
};

export const PHRASE_GROUPS: { id: PhraseGroup; label: string; hint: string }[] = [
  { id: "gate", label: "Gate", hint: "Arrival and identity" },
  { id: "weigh", label: "Bridge", hint: "Gross, tare and net" },
  { id: "inspect", label: "Inspection", hint: "Moisture, seals and bags" },
  { id: "variance", label: "Variance", hint: "Quantity and price" },
  { id: "exit", label: "Exit", hint: "Receipt and release" },
];

export const PHRASES: Phrase[] = [
  { id: "g1", group: "gate", fr: "Bonjour. Présentez votre lettre de voiture, s'il vous plaît.", en: "Hello. Please show your waybill.", phonetic: "bon-ZHOOR. pray-zawn-TAY votr LET-ruh duh vwa-TOOR" },
  { id: "g2", group: "gate", fr: "Quel est le numéro du camion ?", en: "What is the truck number?", phonetic: "kel eh luh nay-may-RO doo ka-MYON" },
  { id: "g3", group: "gate", fr: "Comment vous appelez-vous ?", en: "What is your name?", phonetic: "ko-mawn voo za-play VOO" },
  { id: "g4", group: "gate", fr: "D'où venez-vous aujourd'hui ?", en: "Where are you coming from today?", phonetic: "doo vuh-NAY voo oh-zhoor-DWEE" },
  { id: "g5", group: "gate", fr: "Qui est votre fournisseur ?", en: "Who is your supplier?", phonetic: "kee eh votr for-nee-SUR" },
  { id: "g6", group: "gate", fr: "Quelle marchandise transportez-vous ?", en: "What commodity are you carrying?", phonetic: "kel mar-shawn-DEEZ trawns-por-TAY voo" },
  { id: "g7", group: "gate", fr: "Quelle quantité déclarez-vous, en tonnes ?", en: "What quantity do you declare, in tonnes?", phonetic: "kel kawn-tee-TAY day-kla-RAY voo, awn ton" },
  { id: "g8", group: "gate", fr: "Garez-vous dans la file et attendez votre tour.", en: "Park in the queue and wait for your turn.", phonetic: "ga-RAY voo dawn la feel ay a-tawn-DAY votr toor" },
  { id: "g9", group: "gate", fr: "Restez au volant. Ne descendez pas encore.", en: "Stay at the wheel. Do not get out yet.", phonetic: "res-TAY oh vo-LAWN. nuh day-sawn-DAY pah awn-KOR" },
  { id: "g10", group: "gate", fr: "Avancez lentement jusqu'au pont-bascule.", en: "Move slowly up to the weighbridge.", phonetic: "a-vawn-SAY lawn-tuh-MAWN zhoos-KOH pon bas-KOOL" },
  { id: "w1", group: "weigh", fr: "Montez sur le pont-bascule et arrêtez-vous au signal.", en: "Drive onto the weighbridge and stop at the signal.", phonetic: "mon-TAY soor luh pon bas-KOOL ay a-reh-TAY voo oh see-NYAL" },
  { id: "w2", group: "weigh", fr: "Coupez le moteur, s'il vous plaît.", en: "Switch off the engine, please.", phonetic: "koo-PAY luh mo-TUR" },
  { id: "w3", group: "weigh", fr: "Ne bougez plus. La pesée est en cours.", en: "Do not move. We are weighing now.", phonetic: "nuh boo-ZHAY ploo. la puh-ZAY eht awn koor" },
  { id: "w4", group: "weigh", fr: "Le poids brut est enregistré.", en: "Gross weight is recorded.", phonetic: "luh pwa broo eht awn-reh-zhees-TRAY" },
  { id: "w5", group: "weigh", fr: "Allez décharger, puis revenez à vide pour la tare.", en: "Offload, then come back empty for the tare.", phonetic: "a-LAY day-shar-ZHAY, pwee ruh-vuh-NAY ah veed poor la tar" },
  { id: "w6", group: "weigh", fr: "Le camion doit être complètement vide.", en: "The truck must be completely empty.", phonetic: "luh ka-MYON dwa eht-ruh kom-plet-MAWN veed" },
  { id: "w7", group: "weigh", fr: "Remontez sur le pont-bascule pour la tare.", en: "Drive back onto the weighbridge for the tare.", phonetic: "ruh-mon-TAY soor luh pon bas-KOOL poor la tar" },
  { id: "w8", group: "weigh", fr: "Le poids net est calculé.", en: "Net weight is calculated.", phonetic: "luh pwa net eht kal-koo-LAY" },
  { id: "w9", group: "weigh", fr: "Il y a un écart avec la quantité déclarée.", en: "There is a difference from the declared quantity.", phonetic: "eel yah un ay-KAR a-vek la kawn-tee-TAY day-kla-RAY" },
  { id: "w10", group: "weigh", fr: "La pesée est terminée. Vous pouvez avancer.", en: "Weighing is finished. You may move forward.", phonetic: "la puh-ZAY eht tehr-mee-NAY. voo poo-VAY a-vawn-SAY" },
  { id: "i1", group: "inspect", fr: "Nous contrôlons la qualité avant le déchargement.", en: "We check quality before offloading.", phonetic: "noo kon-tro-LON la ka-lee-TAY a-vawn luh day-sharzh-MAWN" },
  { id: "i2", group: "inspect", fr: "Ouvrez la bâche, s'il vous plaît.", en: "Open the tarpaulin, please.", phonetic: "oo-VRAY la bash" },
  { id: "i3", group: "inspect", fr: "Le taux d'humidité est trop élevé. Nous ne pouvons pas accepter.", en: "Moisture is too high. We cannot accept it.", phonetic: "luh toh doo-mee-dee-TAY eh troh ay-luh-VAY" },
  { id: "i4", group: "inspect", fr: "Le taux d'humidité est acceptable.", en: "Moisture is acceptable.", phonetic: "luh toh doo-mee-dee-TAY eht ak-sep-TAHL" },
  { id: "i5", group: "inspect", fr: "Le scellé est cassé. Le camion est retenu.", en: "The seal is broken. The truck is held.", phonetic: "luh seh-LAY eh ka-SAY. luh ka-MYON eh ruh-tuh-NOO" },
  { id: "i6", group: "inspect", fr: "Comptons ensemble les sacs endommagés.", en: "Let us count the damaged bags together.", phonetic: "kon-TON awn-SAHM-bluh lay sak awn-do-ma-ZHAY" },
  { id: "i7", group: "inspect", fr: "Des sacs sont déchirés. Il faut les reconditionner.", en: "Some bags are torn. They must be re-bagged.", phonetic: "day sak son day-shee-RAY. eel foh lay ruh-kon-dee-see-oh-NAY" },
  { id: "i8", group: "inspect", fr: "L'inspection est bonne. Vous êtes autorisé à décharger.", en: "Inspection passed. You are cleared to offload.", phonetic: "lan-spek-SYON eh bon. voo zet oh-to-ree-ZAY ah day-shar-ZHAY" },
  { id: "i9", group: "inspect", fr: "Attendez l'agent de contrôle. Ne touchez pas à la marchandise.", en: "Wait for the inspector. Do not touch the goods.", phonetic: "a-tawn-DAY la-ZHON duh kon-TROL" },
  { id: "i10", group: "inspect", fr: "Ne déchargez pas avant notre accord.", en: "Do not offload until we clear you.", phonetic: "nuh day-shar-ZHAY pah a-vawn noh-truh a-KOR" },
  { id: "v1", group: "variance", fr: "La quantité reçue est inférieure à la lettre de voiture.", en: "Received quantity is below the waybill.", phonetic: "la kawn-tee-TAY ruh-SOO eht an-fay-RYUR ah la LET-ruh duh vwa-TOOR" },
  { id: "v2", group: "variance", fr: "La quantité reçue est supérieure à la lettre de voiture.", en: "Received quantity is above the waybill.", phonetic: "la kawn-tee-TAY ruh-SOO eht soo-pay-RYUR" },
  { id: "v3", group: "variance", fr: "Signez le constat d'écart, s'il vous plaît.", en: "Please sign the variance note.", phonetic: "see-NYAY luh kon-STA day-KAR" },
  { id: "v4", group: "variance", fr: "Le prix d'achat est au-dessus du prix du marché.", en: "The purchase price is above the market.", phonetic: "luh pree da-SHA eht oh-duh-SOO doo pree doo mar-SHAY" },
  { id: "v5", group: "variance", fr: "Le prix d'achat est en dessous du prix du marché.", en: "The purchase price is below the market.", phonetic: "luh pree da-SHA eht awn duh-SOO doo pree doo mar-SHAY" },
  { id: "v6", group: "variance", fr: "Le prix est aligné sur le marché du jour.", en: "The price matches today's market.", phonetic: "luh pree eht a-lee-NYAY soor luh mar-SHAY doo zhoor" },
  { id: "v7", group: "variance", fr: "Nous devons appeler votre fournisseur.", en: "We have to call your supplier.", phonetic: "noo duh-VON a-play votr for-nee-SUR" },
  { id: "v8", group: "variance", fr: "Cette livraison est en attente d'une décision.", en: "This delivery is waiting on a decision.", phonetic: "set lee-vray-ZON eht awn a-TAHNT doon day-see-ZYON" },
  { id: "v9", group: "variance", fr: "Le solde du contrat sera mis à jour.", en: "The contract balance will be updated.", phonetic: "luh sold doo kon-TRA suh-RA mee ah zhoor" },
  { id: "v10", group: "variance", fr: "Confirmez la quantité nette avant de signer.", en: "Confirm the net quantity before you sign.", phonetic: "kon-feer-MAY la kawn-tee-TAY net a-vawn duh see-NYAY" },
  { id: "e1", group: "exit", fr: "Le déchargement est terminé.", en: "Offloading is finished.", phonetic: "luh day-sharzh-MAWN eh tehr-mee-NAY" },
  { id: "e2", group: "exit", fr: "Revenez à la bascule pour la pesée de sortie.", en: "Come back to the scale for the exit weigh.", phonetic: "ruh-vuh-NAY ah la bas-KOOL poor la puh-ZAY duh sor-TEE" },
  { id: "e3", group: "exit", fr: "Voici votre reçu de livraison.", en: "Here is your delivery receipt.", phonetic: "vwa-SEE votr ruh-SOO duh lee-vray-ZON" },
  { id: "e4", group: "exit", fr: "Vérifiez votre nom et le numéro du camion.", en: "Check your name and the truck number.", phonetic: "vay-ree-fee-AY votr non ay luh nay-may-RO doo ka-MYON" },
  { id: "e5", group: "exit", fr: "Signez ici, s'il vous plaît.", en: "Sign here, please.", phonetic: "see-NYAY ee-SEE" },
  { id: "e6", group: "exit", fr: "Gardez votre copie du reçu.", en: "Keep your copy of the receipt.", phonetic: "gar-DAY votr ko-PEE doo ruh-SOO" },
  { id: "e7", group: "exit", fr: "Vous pouvez sortir. La barrière est ouverte.", en: "You may leave. The gate is open.", phonetic: "voo poo-VAY sor-TEER. la ba-ree-AIR eht oo-VERT" },
  { id: "e8", group: "exit", fr: "Bonne route, et merci.", en: "Safe journey, and thank you.", phonetic: "bon root, ay mair-SEE" },
  { id: "e9", group: "exit", fr: "La file est fermée. Revenez demain matin.", en: "The queue is closed. Come back tomorrow morning.", phonetic: "la feel eht fehr-MAY. ruh-vuh-NAY duh-MAN ma-TAN" },
  { id: "e10", group: "exit", fr: "En cas de problème, demandez l'agent de garde.", en: "If there is a problem, ask the duty officer.", phonetic: "awn kah duh pro-BLEM, duh-mawn-DAY la-ZHON duh gard" },
];

export function speakFrench(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.92;
  const voice = window.speechSynthesis
    .getVoices()
    .find((item) => item.lang.toLowerCase().startsWith("fr"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}
