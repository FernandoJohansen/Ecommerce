import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Reveal } from "@/components/Reveal";

type Avaliacao = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  nome_avaliador: string;
};

type AvaliacoesData = {
  media: number;
  total: number;
  avaliacoes: Avaliacao[];
};

const STAR =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

function Estrelas({ nota, size = 13 }: { nota: number; size?: number }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`transition-opacity duration-300 ${i < nota ? "fill-foreground opacity-100" : "fill-foreground opacity-[0.15]"}`}
        >
          <path d={STAR} />
        </svg>
      ))}
    </div>
  );
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AvaliacaoCard({ av, index }: { av: Avaliacao; index: number }) {
  return (
    <Reveal delay={index * 90} className="border-b border-border py-6 last:border-0">
      <div className="flex items-center gap-3">
        <Estrelas nota={av.nota} />
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {av.nome_avaliador}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
        {formatarData(av.created_at)}
      </p>
      {av.comentario && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">{av.comentario}</p>
      )}
    </Reveal>
  );
}

function SkeletonCard({ i }: { i: number }) {
  return (
    <div key={i} className="border-b border-border py-6">
      <div className="flex items-center gap-3">
        <div className="h-3 w-20 animate-pulse rounded-none bg-muted" />
        <div className="h-2 w-24 animate-pulse rounded-none bg-muted" />
      </div>
      <div className="mt-3 h-3 w-2/3 animate-pulse rounded-none bg-muted" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded-none bg-muted" />
    </div>
  );
}

export function Avaliacoes({ produtoId }: { produtoId: string }) {
  const [aberta, setAberta] = useState(true);

  const { data, isLoading, isError } = useQuery<AvaliacoesData>({
    queryKey: ["avaliacoes", produtoId],
    queryFn: () => apiFetch(`/avaliacoes?produto_id=${produtoId}`),
    retry: false,
  });

  const total = data?.total ?? 0;
  const media = data?.media ?? 0;
  const lista = data?.avaliacoes ?? [];
  const vazio = isError || (!isLoading && total === 0);

  return (
    <section className="mt-16">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between border-t border-foreground py-5 text-left"
      >
        <div className="flex items-baseline gap-4">
          <span className="serif text-2xl">Avaliações</span>
          {total > 0 && (
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {media.toFixed(1)} · {total} {total === 1 ? "avaliação" : "avaliações"}
            </span>
          )}
        </div>
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          className={`shrink-0 text-muted-foreground transition-transform duration-500 ease-out ${aberta ? "rotate-180" : "rotate-0"}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: aberta ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pb-10 pt-1">
            {isLoading && (
              <div>
                {Array.from({ length: 2 }, (_, i) => (
                  <SkeletonCard key={i} i={i} />
                ))}
              </div>
            )}

            {!isLoading && vazio && (
              <p className="pt-2 text-sm text-muted-foreground">
                Nenhuma avaliação ainda. Seja o primeiro a avaliar.
              </p>
            )}

            {!isLoading && lista.length > 0 && (
              <div>
                {lista.map((av, i) => (
                  <AvaliacaoCard key={av.id} av={av} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
