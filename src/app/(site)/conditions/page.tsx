import type { Metadata } from "next";
import { Info, LegalPage, Section } from "@/components/site/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions d'utilisation", description: "Règles d'utilisation de la plateforme ensate/clubs : comptes, inscriptions, billets, paiements et annulations." };

export default function Conditions() {
  return (
    <LegalPage titre="Conditions d'utilisation" courant="/conditions">
      <Section titre="Objet">
        <p>
          <b className="text-paper">ensate/clubs</b> permet de découvrir les événements des clubs et associations de l&apos;ENSA de Tétouan, de s&apos;y inscrire et d&apos;obtenir un billet. Il
          permet aussi aux organisations de demander des dates, de publier leurs événements et de gérer les inscriptions. Utiliser la plateforme implique d&apos;accepter ces conditions.
        </p>
      </Section>

      <Section titre="Comptes">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>La connexion se fait uniquement avec un compte Google.</li>
          <li>Une adresse @etu.uae.ac.ma ouvre un compte étudiant ; toute autre adresse ouvre un compte externe, qui ne peut s&apos;inscrire qu&apos;aux événements ouverts à tous.</li>
          <li>Les comptes des organisations, du coordinateur et de l&apos;administration sont créés par l&apos;école.</li>
          <li>Tu es responsable de l&apos;accès à ton compte Google. Un compte peut être suspendu en cas d&apos;usage abusif ou de non-respect de ces conditions.</li>
        </ul>
      </Section>

      <Section titre="Inscriptions et billets">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Événement gratuit : l&apos;inscription confirme la place s&apos;il en reste ; sinon, une liste d&apos;attente peut être proposée.</li>
          <li>
            Événement payant : l&apos;inscription en ligne est une <b className="text-paper">pré-inscription</b> qui ne réserve pas de place. La place est confirmée au paiement, fait au stand de
            l&apos;organisation.
          </li>
          <li>Le billet est personnel. Son QR code est contrôlé à l&apos;entrée, une fois par jour d&apos;événement ; il ne doit pas être partagé.</li>
          <li>Certains événements exigent un numéro de téléphone, visible uniquement par leurs organisateurs.</li>
        </ul>
      </Section>

      <Section titre="Paiements et tarifs">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Aucun paiement ne se fait en ligne. Les paiements sont reçus au stand par l&apos;organisation, qui en est seule responsable.</li>
          <li>
            Les tarifs affichés sont fixés par l&apos;organisation. Elle choisit le tarif qui s&apos;applique à chaque participant au moment du paiement (par exemple adhérent ou non-adhérent),
            et peut avoir des tarifs particuliers non affichés.
          </li>
        </ul>
      </Section>

      <Section titre="Annulation">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Tu peux annuler ton inscription toi-même tant qu&apos;elle n&apos;est pas payée.</li>
          <li>Après paiement, l&apos;annulation et un éventuel remboursement se demandent directement à l&apos;organisation, selon ses propres règles.</li>
          <li>Si un événement est annulé ou modifié, les inscrits sont prévenus par email ; les remboursements sont gérés par l&apos;organisation.</li>
        </ul>
      </Section>

      <Section titre="Rôle des organisations et de l'école">
        <p>
          Chaque club ou association est responsable de ses événements, de leur contenu, de leur déroulement et de l&apos;argent qu&apos;il encaisse. Le coordinateur des clubs valide les dates et
          les lieux. La plateforme est un outil de mise en relation : elle n&apos;organise pas les événements.
        </p>
      </Section>

      <Section titre="Bon usage">
        <p>
          Il est interdit d&apos;usurper l&apos;identité d&apos;une autre personne, de tenter d&apos;accéder à des données qui ne te concernent pas, de détourner les billets ou les QR des stands, et de
          publier des contenus illicites ou contraires au règlement de l&apos;école.
        </p>
      </Section>

      <Section titre="Données personnelles">
        <p>
          Voir la{" "}
          <a href="/confidentialite" className="text-accent underline underline-offset-2">
            politique de confidentialité
          </a>
          .
        </p>
      </Section>

      <Section titre="Contact et modifications">
        <p>
          Contact : <Info v={LEGAL.editeur.email} />. Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page.
        </p>
      </Section>
    </LegalPage>
  );
}
