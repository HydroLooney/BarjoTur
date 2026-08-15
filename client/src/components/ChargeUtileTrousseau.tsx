import { useState } from 'react';
import { useIntendance, poidsTotal, CHARGE_SURE_KG } from '@/stores/intendance';
import { Champ } from '@/ui/primitives/input';
import { Bouton } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

// AUDIT-FRONT P0 #2 (Étude Préparer) : CHARGE UTILE (jauge live du poids embarqué vs capacité sûre ~430 kg) +
// TROUSSEAU (affaires par personne). Local et privé (comme le reste de l'Intendance). R1 : la capacité est une
// ESTIMATION à confirmer (van), jamais une vérité ; l'alerte est douce. (Argent fin + cuisine profonde = v3.2, M481.)

export function ChargeUtile() {
  const charge = useIntendance((s) => s.charge);
  const ajouter = useIntendance((s) => s.ajouterCharge);
  const retirer = useIntendance((s) => s.retirerCharge);
  const [objet, setObjet] = useState('');
  const [qui, setQui] = useState('');
  const [poids, setPoids] = useState('');

  const total = poidsTotal(charge);
  const pct = Math.min(100, Math.round((total / CHARGE_SURE_KG) * 100));
  const depasse = total > CHARGE_SURE_KG;
  const reste = Math.max(0, CHARGE_SURE_KG - total);

  const soumettre = () => {
    if (!objet.trim()) return;
    ajouter({ objet: objet.trim(), qui: qui.trim(), poids: Number(poids) || 0 });
    setObjet('');
    setQui('');
    setPoids('');
  };

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-medium">Charge utile</h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          Le poids embarqué face à la capacité du van. Capacité = estimation prudente à confirmer.
        </p>
      </div>

      {/* Jauge poids vs capacité. Alerte douce (ocre) si dépassement. */}
      <div>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={CHARGE_SURE_KG}
          aria-valuenow={Math.round(total)}
          aria-label="Charge embarquée"
        >
          <div
            className={cn('h-full rounded-full transition-[width]', depasse ? 'bg-ocre' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        {[
          ['Capacité', `${CHARGE_SURE_KG} kg`, 'estimation à confirmer'],
          ['Chargé', `${Math.round(total)} kg`, `${pct}%`],
          ['Reste', `${Math.round(reste)} kg`, depasse ? 'dépassé' : 'disponible'],
        ].map(([k, v, note]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="chiffres font-medium">{v}</dd>
            <dd className={cn('text-xs', depasse && k === 'Reste' ? 'text-ocre' : 'text-muted-foreground')}>{note}</dd>
          </div>
        ))}
      </dl>

      {depasse ? (
        <p className="text-xs text-ocre" role="status">
          Le chargement dépasse l'estimation de capacité. À alléger ou à vérifier auprès du loueur.
        </p>
      ) : null}

      {/* Ajout d'une affaire chargée. */}
      <div className="flex flex-wrap items-end gap-2">
        <Champ placeholder="Objet" value={objet} onChange={(e) => setObjet(e.target.value)} className="min-h-tactile w-40" aria-label="Objet" />
        <Champ placeholder="Qui" value={qui} onChange={(e) => setQui(e.target.value)} className="min-h-tactile w-28" aria-label="Qui l'apporte" />
        <Champ type="number" min={0} placeholder="kg" value={poids} onChange={(e) => setPoids(e.target.value)} className="min-h-tactile w-20" aria-label="Poids en kg" />
        <Bouton size="sm" variant="outline" onClick={soumettre} disabled={!objet.trim()}>
          Ajouter
        </Bouton>
      </div>

      {charge.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {charge.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 border-t border-border pt-1">
              <span>
                {a.objet}
                {a.qui ? <span className="text-muted-foreground"> · {a.qui}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="chiffres text-muted-foreground">{a.poids} kg</span>
                <button type="button" onClick={() => retirer(a.id)} className="min-h-tactile px-1 text-muted-foreground hover:text-destructive" aria-label={`Retirer ${a.objet}`}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Ajoutez ce que vous embarquez pour suivre la charge.</p>
      )}
    </section>
  );
}

export function Trousseau() {
  const trousseau = useIntendance((s) => s.trousseau);
  const ajouter = useIntendance((s) => s.ajouterTrousseau);
  const retirer = useIntendance((s) => s.retirerTrousseau);
  const [affaire, setAffaire] = useState('');
  const [qui, setQui] = useState('');

  const soumettre = () => {
    if (!affaire.trim()) return;
    ajouter({ affaire: affaire.trim(), qui: qui.trim() });
    setAffaire('');
    setQui('');
  };

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-medium">Trousseau</h3>
        <p className="max-w-prose text-xs text-muted-foreground">Les affaires de chacun, pour ne rien oublier.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Champ placeholder="Affaire" value={affaire} onChange={(e) => setAffaire(e.target.value)} className="min-h-tactile w-44" aria-label="Affaire" />
        <Champ placeholder="Pour qui" value={qui} onChange={(e) => setQui(e.target.value)} className="min-h-tactile w-28" aria-label="Pour qui" />
        <Bouton size="sm" variant="outline" onClick={soumettre} disabled={!affaire.trim()}>
          Ajouter
        </Bouton>
      </div>

      {trousseau.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {trousseau.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 border-t border-border pt-1">
              <span>
                {a.affaire}
                {a.qui ? <span className="text-muted-foreground"> · {a.qui}</span> : null}
              </span>
              <button type="button" onClick={() => retirer(a.id)} className="min-h-tactile px-1 text-muted-foreground hover:text-destructive" aria-label={`Retirer ${a.affaire}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune affaire pour l'instant.</p>
      )}
    </section>
  );
}
