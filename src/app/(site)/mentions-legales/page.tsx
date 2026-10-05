import type { Metadata } from "next";
import { Info, LegalPage, Section } from "@/components/site/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales", description: "Éditeur, hébergeur et prestataires de la plateforme ensate/clubs." };

export default function MentionsLegales() {
  const e = LEGAL.editeur;
  return (
    <LegalPage titre="Mentions légales" courant="/mentions-legales">
      <Section titre="Éditeur">
        <p>
          La plateforme <b className="text-paper">ensate/clubs</b> présente les activités parascolaires des clubs et associations de l&apos;École Nationale des Sciences Appliquées de Tétouan.
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            Éditeur : <Info v={e.nom} />
          </li>
          <li>
            Adresse : <Info v={e.adresse} />
          </li>
          <li>
            Contact : <Info v={e.email} />
          </li>
          <li>
            Responsable de la publication : <Info v={e.responsablePublication} />
          </li>
        </ul>
      </Section>

      <Section titre="Hébergement">
        <p>
          {LEGAL.hebergeur.nom}, {LEGAL.hebergeur.adresse} —{" "}
          <a href={LEGAL.hebergeur.site} className="text-accent underline underline-offset-2" rel="noopener noreferrer" target="_blank">
            {LEGAL.hebergeur.site.replace("https://", "")}
          </a>
        </p>
      </Section>

      <Section titre="Prestataires techniques">
        <ul className="flex flex-col gap-1.5">
          {LEGAL.prestataires.map((p) => (
            <li key={p.nom}>
              <b className="text-paper">{p.nom}</b> : {p.role}.
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Contenus publiés par les organisations">
        <p>
          Les descriptions, affiches, photos et tarifs des événements sont publiés par les clubs et associations, sous leur responsabilité, après validation des dates par le coordinateur des
          clubs. Pour signaler un contenu, écris au contact ci-dessus.
        </p>
      </Section>

      <Section titre="Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <a href="/confidentialite" className="text-accent underline underline-offset-2">
            politique de confidentialité
          </a>
          , conformément à la loi n° 09-08 relative à la protection des personnes physiques à l&apos;égard du traitement des données à caractère personnel.
        </p>
      </Section>
    </LegalPage>
  );
}
