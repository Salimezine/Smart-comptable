import React from 'react';
import { Info } from 'lucide-react';

export default function OpenRouterGuide({ compact = false }) {
  return (
    <div className={`p-3 rounded-xl bg-slate-900/70 border border-slate-700/50 text-[11px] text-slate-400 leading-relaxed ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
      <p className="text-slate-300 font-bold flex items-center gap-1.5"><Info className="w-3 h-3" /> Comment obtenir une clé OpenRouter (gratuite) :</p>
      <ol className="list-decimal pl-4 space-y-1">
        <li>Allez sur <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300 underline">openrouter.ai</a> et créez un compte gratuit (Google ou email).</li>
        <li>Ouvrez la page <span className="text-slate-200">Clés API</span> (icône clé, ou <span className="text-slate-200">openrouter.ai/keys</span>).</li>
        <li>Cliquez sur <span className="text-slate-200">Create Key</span> et copiez la clé qui commence par <span className="text-slate-200 font-mono">sk-or-</span>.</li>
        <li>Collez-la dans le champ ci-dessus et enregistrez. Vous pouvez aussi créditer le compte pour débloquer les gros modèles.</li>
      </ol>
      <p className="text-[10px] text-slate-500">Les modèles gratuits (<span className="font-mono">gemma</span>, <span className="font-mono">gpt-oss</span>) suffisent pour le secours sans payer.</p>
    </div>
  );
}
