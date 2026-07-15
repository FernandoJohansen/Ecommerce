import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { REFIL_PRODUTO, formatarPreco, precoUnitario, type ProdutoApi } from "@/lib/precos";
import { salvarItemDireto } from "@/lib/checkout";

export interface Aroma {
  id: string;
  nome: string;
}

// Controles de compra (tamanho, aroma, refil, quantidade, total e botões de
// comprar/adicionar ao carrinho) de um produto. Usado no formulário de
// atendimento da home e na página de detalhe do produto.
export function CompraProduto({
  produto,
  produtos,
  aromas,
}: {
  produto: ProdutoApi;
  produtos: ProdutoApi[];
  aromas: Aroma[];
}) {
  const navigate = useNavigate();

  const [tamanho, setTamanho] = useState("250ml");
  const [aroma, setAroma] = useState("");
  const [refil, setRefil] = useState("nao");
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [logado, setLogado] = useState(false);
  const [addindoCarrinho, setAddindoCarrinho] = useState(false);
  const [addedCarrinho, setAddedCarrinho] = useState(false);

  useEffect(() => {
    setLogado(isAuthenticated());
  }, []);

  const tamanhosDisponiveis = produto.tamanhos;
  const effectiveTamanho = tamanhosDisponiveis.includes(tamanho)
    ? tamanho
    : (tamanhosDisponiveis[0] ?? "");
  const effectiveAroma = aroma || aromas[0]?.nome || "";

  const isRefil = produto.nome.toLowerCase().includes("refil");
  // O add-on "com refil" só existe quando o produto Refil tem preço no tamanho
  const precoRefilAddon = produtos.find((p) => p.nome === REFIL_PRODUTO)?.precos?.[
    effectiveTamanho
  ];
  const refilDisponivel = !isRefil && precoRefilAddon !== undefined;
  const comRefil = refil === "sim" && refilDisponivel;

  const precoAtual = precoUnitario(produtos, produto.nome, effectiveTamanho, comRefil);
  const totalAtual = precoAtual !== null ? precoAtual * quantidade : null;

  // Sem aroma (lista vazia/erro) ou sem preço no tamanho, o pedido só falharia
  // no servidor — não deixa começar
  const podeComprar = Boolean(effectiveAroma && precoAtual !== null);

  const itemAtual = () => ({
    produto_nome: produto.nome,
    tamanho: effectiveTamanho,
    aroma: effectiveAroma,
    refil: comRefil,
    quantidade,
  });

  const comprarAgora = () => {
    salvarItemDireto(itemAtual());
    navigate({ to: "/checkout", search: { direto: true } });
  };

  const adicionarAoCarrinho = async () => {
    setAddindoCarrinho(true);
    setErro(null);
    setAddedCarrinho(false);

    try {
      await apiFetch("/carrinho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemAtual()),
      });
      setAddedCarrinho(true);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.detail
          ? e.detail
          : "Não foi possível adicionar ao carrinho. Tente novamente.",
      );
    } finally {
      setAddindoCarrinho(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tamanho</Label>
        <Select value={effectiveTamanho} onValueChange={setTamanho}>
          <SelectTrigger className="rounded-none border-0 border-b border-foreground bg-transparent px-0 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tamanhosDisponiveis.map((t) => {
              const preco = produto.precos?.[t];
              return (
                <SelectItem key={t} value={t}>
                  {preco !== undefined ? `${t} — ${formatarPreco(preco)}` : t}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aroma</Label>
        <Select value={effectiveAroma} onValueChange={setAroma}>
          <SelectTrigger className="rounded-none border-0 border-b border-foreground bg-transparent px-0 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aromas.map((a) => (
              <SelectItem key={a.id} value={a.nome}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {refilDisponivel && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Adicionar refil ao pedido?
          </Label>
          <RadioGroup value={refil} onValueChange={setRefil} className="flex gap-6 pt-1">
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem value="sim" id="refil-sim" />
              <span>Sim (+{formatarPreco(precoRefilAddon)})</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem value="nao" id="refil-nao" />
              <span>Não</span>
            </label>
          </RadioGroup>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Quantidade
        </Label>
        <Input
          type="number"
          min={1}
          max={99}
          value={quantidade}
          onChange={(e) => setQuantidade(Math.min(99, Math.max(1, +e.target.value)))}
          className="rounded-none border-0 border-b border-foreground bg-transparent px-0"
        />
      </div>

      {totalAtual !== null && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
          <span className="serif text-2xl">{formatarPreco(totalAtual)}</span>
        </div>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <Button
        onClick={comprarAgora}
        disabled={addindoCarrinho || !podeComprar}
        className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        Comprar agora
      </Button>
      {logado &&
        (addedCarrinho ? (
          <p className="text-center text-xs uppercase tracking-[0.2em]">
            Adicionado!{" "}
            <Link to="/carrinho" className="underline underline-offset-4">
              Ver carrinho
            </Link>
          </p>
        ) : (
          <Button
            onClick={adicionarAoCarrinho}
            disabled={addindoCarrinho || !podeComprar}
            variant="outline"
            className="w-full rounded-none border-foreground py-6 text-xs uppercase tracking-[0.3em] hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            {addindoCarrinho ? "Adicionando…" : "Adicionar ao carrinho"}
          </Button>
        ))}
    </div>
  );
}
