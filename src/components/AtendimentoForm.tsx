import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRODUTOS = [
  { id: "vidro", nome: "Difusor de Vidro", tamanhos: ["250ml", "500ml"] },
  { id: "pet", nome: "Difusor PET (Plástico)", tamanhos: ["250ml"] },
  { id: "homespray", nome: "Home Spray", tamanhos: ["120ml", "250ml"] },
  { id: "refil", nome: "Refil", tamanhos: ["250ml", "500ml", "1L"] },
];

const AROMAS = [
  "Alecrim",
  "Lavanda",
  "Capim-limão",
  "Madeiras Nobres",
  "Flor de Laranjeira",
  "Baunilha & Âmbar",
  "Bambu",
  "Algodão Egípcio",
  "Frutas Vermelhas",
  "Tabaco & Couro",
];

const WHATSAPP = "5542999999999"; // ajustar

export function AtendimentoForm() {
  const [produto, setProduto] = useState("vidro");
  const [tamanho, setTamanho] = useState("250ml");
  const [aroma, setAroma] = useState("Alecrim");
  const [refil, setRefil] = useState("nao");
  const [quantidade, setQuantidade] = useState(1);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");

  const produtoAtual = useMemo(
    () => PRODUTOS.find((p) => p.id === produto)!,
    [produto],
  );

  const tamanhosDisponiveis = produtoAtual.tamanhos;

  const handleProdutoChange = (id: string) => {
    setProduto(id);
    const p = PRODUTOS.find((x) => x.id === id)!;
    if (!p.tamanhos.includes(tamanho)) setTamanho(p.tamanhos[0]);
  };

  const enviarWhatsapp = () => {
    const linhas = [
      `Olá! Gostaria de fazer um pedido:`,
      ``,
      `*Produto:* ${produtoAtual.nome}`,
      `*Tamanho:* ${tamanho}`,
      `*Aroma:* ${aroma}`,
      produto !== "refil"
        ? `*Acompanha refil extra:* ${refil === "sim" ? "Sim" : "Não"}`
        : "",
      `*Quantidade:* ${quantidade}`,
      nome ? `*Nome:* ${nome}` : "",
      obs ? `*Observações:* ${obs}` : "",
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(linhas.join("\n"))}`;
    window.open(url, "_blank");
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Produto
        </Label>
        <RadioGroup
          value={produto}
          onValueChange={handleProdutoChange}
          className="grid gap-2"
        >
          {PRODUTOS.map((p) => (
            <label
              key={p.id}
              htmlFor={p.id}
              className={`flex cursor-pointer items-center justify-between border px-5 py-4 transition-colors ${
                produto === p.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="serif text-xl">{p.nome}</span>
              <RadioGroupItem value={p.id} id={p.id} className="sr-only" />
              <span className="text-xs uppercase tracking-widest opacity-70">
                {p.tamanhos.join(" · ")}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Tamanho
          </Label>
          <Select value={tamanho} onValueChange={setTamanho}>
            <SelectTrigger className="rounded-none border-0 border-b border-foreground bg-transparent px-0 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tamanhosDisponiveis.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Aroma
          </Label>
          <Select value={aroma} onValueChange={setAroma}>
            <SelectTrigger className="rounded-none border-0 border-b border-foreground bg-transparent px-0 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AROMAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {produto !== "refil" && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Adicionar refil ao pedido?
            </Label>
            <RadioGroup
              value={refil}
              onValueChange={setRefil}
              className="flex gap-6 pt-1"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="sim" id="refil-sim" />
                <span>Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="nao" id="refil-nao" />
                <span>Não</span>
              </label>
            </RadioGroup>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Quantidade
            </Label>
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, +e.target.value))}
              className="rounded-none border-0 border-b border-foreground bg-transparent px-0"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Seu nome
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-none border-0 border-b border-foreground bg-transparent px-0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Observações
          </Label>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="rounded-none border border-foreground/30 bg-transparent"
          />
        </div>

        <Button
          onClick={enviarWhatsapp}
          className="w-full rounded-none bg-foreground py-6 text-xs uppercase tracking-[0.3em] text-background hover:bg-foreground/90"
        >
          Enviar pedido pelo WhatsApp
        </Button>
      </div>
    </div>
  );
}
