"use client";

import { useCallback, useSyncExternalStore } from "react";
import t from "./admin.module.css";

/**
 * Faixa "O que há de novo" — aparece na primeira vez que a pessoa chega numa
 * tela que mudou, e sai quando ela dispensa.
 *
 * POR QUE localStorage E NÃO UMA COLUNA NO BANCO: isto é um aviso de leitura,
 * não um dado da loja. Se a Louanny trocar de navegador e a faixa voltar uma
 * vez, o custo é ela clicar em "Entendi" de novo — enquanto uma coluna em
 * `users` por novidade lançada seria migration a cada mudança de tela, para
 * guardar permanentemente algo que não tem valor nenhum depois de lido.
 *
 * POR QUE useSyncExternalStore E NÃO useEffect + useState: localStorage é
 * exatamente o "external store" que este hook existe para ler. A versão com
 * effect precisaria de um setState síncrono dentro dele — que a regra
 * react-hooks/set-state-in-effect recusa, por gerar renderização em cascata.
 * E o `getServerSnapshot` resolve de graça o problema de hidratação: no
 * servidor não há localStorage, então a faixa nasce escondida e só aparece
 * depois que o cliente confirma que ela não foi lida. Aparecer um instante
 * depois é melhor que aparecer e sumir na frente da pessoa.
 *
 * `id` é a chave da novidade. Trocar o `id` faz a faixa voltar para todos —
 * é assim que a próxima novidade se anuncia sem precisar limpar nada.
 */

// Dispensar numa aba precisa apagar a faixa nas outras abas abertas na mesma
// tela. O evento `storage` do navegador só avisa as OUTRAS abas, nunca a que
// escreveu — então a aba atual é notificada por este conjunto de inscritos.
const inscritos = new Set();

function avisarInscritos() {
  for (const fn of inscritos) fn();
}

function jaLida(chave) {
  try {
    return localStorage.getItem(chave) === "lida";
  } catch {
    // navegador com armazenamento bloqueado — mostra a faixa, e o "Entendi"
    // só não vai lembrar. Melhor que engolir o aviso.
    return false;
  }
}

export default function Novidade({ id, titulo, children }) {
  const chave = `vamaq-novidade-${id}`;

  const subscribe = useCallback((onChange) => {
    inscritos.add(onChange);
    window.addEventListener("storage", onChange);
    return () => {
      inscritos.delete(onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const lida = useSyncExternalStore(
    subscribe,
    () => jaLida(chave),
    () => true // no servidor: trata como lida, para a faixa não piscar
  );

  const dispensar = useCallback(() => {
    try {
      localStorage.setItem(chave, "lida");
    } catch {
      // sem onde guardar; a faixa volta na próxima visita
    }
    avisarInscritos();
  }, [chave]);

  if (lida) return null;

  return (
    <div className={t.novidade}>
      <div className={t.novidadeTopo}>
        <div>
          <span className={t.novidadeLabel}>O que há de novo</span>
          <strong>{titulo}</strong>
        </div>
        <button
          type="button"
          onClick={dispensar}
          className={t.novidadeFechar}
          aria-label="Dispensar aviso"
          title="Entendi, não mostrar de novo"
        >
          ✕
        </button>
      </div>
      {children}
      <p>
        <button type="button" onClick={dispensar} className={t.novidadeEntendi}>
          Entendi, não mostrar de novo
        </button>
      </p>
    </div>
  );
}
