import type { Metadata } from "next";
import { Info, LegalPage, Section } from "@/components/site/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données personnelles traitées par ENSATE clubs, finalités, destinataires, durées de conservation et droits (loi 09-08).",
};

const Tableau = ({ lignes }: { lignes: [string, string][] }) => (
  <div className="overflow-x-auto rounded-2xl border border-line">
    <table className="w-full min-w-[520px] border-collapse text-sm">
      <tbody>
        {lignes.map(([a, b]) => (
          <tr key={a} className="border-b border-line last:border-b-0">
            <th scope="row" className="w-[38%] bg-ink/40 px-3.5 py-2.5 text-left align-top font-bold text-paper">
              {a}
            </th>
            <td className="px-3.5 py-2.5 align-top">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function Confidentialite() {
  return (
    <LegalPage titre="Politique de confidentialité" courant="/confidentialite">
      <Section titre="Responsable du traitement">
        <p>
          <Info v={LEGAL.editeur.nom} /> — contact : <Info v={LEGAL.editeur.email} />.
        </p>
        <p>
          Traitement conforme à la loi n° 09-08. Déclaration auprès de la CNDP : <Info v={LEGAL.cndp} />.
        </p>
      </Section>

      <Section titre="Données traitées">
        <Tableau
          lignes={[
            ["Compte (via Google)", "Adresse email, nom, prénom, photo de profil, identifiant Google. Aucun mot de passe n'est stocké : la connexion se fait uniquement avec Google."],
            ["Profil", "Téléphone (seulement si tu le renseignes ou si un événement l'exige), niveau d'études pour les étudiants, organisme pour les participants externes."],
            ["Inscriptions et billets", "Événements auxquels tu t'inscris, statut (pré-inscrit, confirmé, liste d'attente), code du billet, tarif appliqué et montant payé au stand, présences enregistrées à l'entrée."],
            ["Clubs suivis et annonces", "Organisations que tu suis ; annonces envoyées par les organisateurs aux inscrits."],
            ["Membres et trésorerie (organisations)", "Rôle des membres d'une organisation ; recettes, dépenses et justificatifs saisis par l'organisation."],
            ["Données techniques", "Cookies nécessaires au fonctionnement (voir plus bas) et journaux techniques de l'hébergeur."],
          ]}
        />
      </Section>

      <Section titre="Pourquoi ces données (finalités)">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>gérer ton compte et te reconnaître (étudiant de l&apos;ENSA ou participant externe, selon l&apos;adresse email) ;</li>
          <li>t&apos;inscrire aux événements, produire ton billet et contrôler l&apos;entrée ;</li>
          <li>permettre aux clubs d&apos;organiser leurs événements : demandes de dates, encaissement au stand, liste des participants ;</li>
          <li>t&apos;envoyer les emails liés à ton activité : confirmation, paiement, liste d&apos;attente, changement d&apos;horaire, annulation, annonces des organisateurs, et nouveaux événements des clubs que tu suis ;</li>
          <li>produire des statistiques de participation pour le coordinateur des clubs, sans aucune donnée financière.</li>
        </ul>
        <p>Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires. Il n&apos;y a ni outil de mesure d&apos;audience ni traceur publicitaire.</p>
      </Section>

      <Section titre="Qui voit quoi (destinataires)">
        <Tableau
          lignes={[
            ["Organisateurs d'un événement", "Les nom, email et statut des inscrits ; le téléphone uniquement si l'événement l'exige ; l'organisme pour les externes. Un club ne voit les montants que des paiements qu'il a lui-même encaissés."],
            ["Coordinateur des clubs", "Les demandes et événements, et des nombres de participants. Jamais de montant ni de trésorerie."],
            ["Administrateur", "La liste des comptes (email, rôle, statut) pour la gestion des accès. Jamais de trésorerie."],
            ["Trésorerie d'une organisation", "Uniquement le compte de l'organisation, son président et son trésorier : ni le coordinateur, ni l'administrateur, ni les autres clubs."],
            ["Public", "Seulement les informations des événements et des organisations publiées (aucune donnée de participant)."],
          ]}
        />
      </Section>

      <Section titre="Prestataires et transferts hors du Maroc">
        <p>Pour fonctionner, la plateforme s&apos;appuie sur des prestataires qui traitent des données pour son compte :</p>
        <ul className="flex flex-col gap-1.5">
          <li>
            <b className="text-paper">{LEGAL.hebergeur.nom}</b> : hébergement de l&apos;application (États-Unis et réseau mondial).
          </li>
          {LEGAL.prestataires.map((p) => (
            <li key={p.nom}>
              <b className="text-paper">{p.nom}</b> : {p.role}.
            </li>
          ))}
        </ul>
        <p>
          Ces services sont situés hors du Maroc (Union européenne et États-Unis). Ces transferts relèvent des articles 43 et 44 de la loi n° 09-08 et sont déclarés à la CNDP avec le
          traitement (référence ci-dessus).
        </p>
      </Section>

      <Section titre="Cookies et stockage sur ton appareil">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <b className="text-paper">Session</b> : te garder connecté (nécessaire).
          </li>
          <li>
            <b className="text-paper">Accès au stand</b> : 15 minutes après avoir scanné le QR d&apos;un stand, pour finir ton inscription (nécessaire).
          </li>
          <li>
            <b className="text-paper">Club actif</b> : pour les membres de plusieurs organisations, le club choisi (nécessaire).
          </li>
          <li>
            <b className="text-paper">Application installée</b> : tes billets à venir sont gardés sur ton téléphone pour être présentés sans réseau. Ils sont effacés à la déconnexion. Le choix de masquer le bandeau d&apos;installation est aussi mémorisé.
          </li>
        </ul>
        <p>Ces éléments sont strictement nécessaires au service : ils ne demandent pas de consentement et ne servent à aucun suivi.</p>
      </Section>

      <Section titre="Durées de conservation">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Compte et profil : tant que le compte existe ; supprimés sur demande.</li>
          <li>Inscriptions, billets et présences : le temps de l&apos;événement et de son suivi (remboursements, statistiques de l&apos;année universitaire).</li>
          <li>Trésorerie et justificatifs : conservés par l&apos;organisation pour sa comptabilité.</li>
          <li>Journaux techniques : selon les durées de l&apos;hébergeur.</li>
        </ul>
      </Section>

      <Section titre="Tes droits">
        <p>
          Conformément à la loi n° 09-08, tu disposes d&apos;un droit d&apos;<b className="text-paper">accès</b>, de <b className="text-paper">rectification</b> et d&apos;
          <b className="text-paper">opposition</b> pour des motifs légitimes, ainsi que du droit de demander la <b className="text-paper">suppression</b> de ton compte. Ton téléphone, ton niveau
          ou ton organisme se modifient directement dans ton profil ; ton nom et ta photo viennent de ton compte Google.
        </p>
        <p>
          Pour toute demande : <Info v={LEGAL.editeur.email} />. Tu peux aussi saisir la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP) :{" "}
          <a href="https://www.cndp.ma" className="text-accent underline underline-offset-2" rel="noopener noreferrer" target="_blank">
            www.cndp.ma
          </a>
          .
        </p>
      </Section>

      <Section titre="Sécurité">
        <p>
          Connexion uniquement avec Google, échanges chiffrés (HTTPS), accès limités selon le rôle et vérifiés côté serveur, billets protégés par un code aléatoire, justificatifs de trésorerie
          stockés en accès privé et ouverts par un lien valable 5 minutes.
        </p>
      </Section>
    </LegalPage>
  );
}
