import pGlass from "@/assets/products/difusor_vidro1.jpeg";
import pGlass2 from "@/assets/products/difusor_vidro2.jpeg";
import pGlass3 from "@/assets/products/difusor_vidro3.jpeg";
import pPet from "@/assets/products/difusor_pet.jpeg";
import pSpray from "@/assets/products/home_spray2.jpeg";
import pSpray2 from "@/assets/products/home_spray1.jpeg";
import pSpray3 from "@/assets/products/home_spray3.jpeg";
import pSpray4 from "@/assets/products/home_spray4.jpeg";
import pRefill from "@/assets/products/refil.jpeg";
import pKitLavabo from "@/assets/products/kit_lavabo1.jpeg";
import pKitLavabo2 from "@/assets/products/kit_lavabo.jpeg";
import pKitLavabo3 from "@/assets/products/kit_lavabo2.jpeg";
import pCarSpray from "@/assets/products/car_spray.jpeg";
import pCarDiffuser from "@/assets/products/difusor_carro_10ml2.jpeg";
import pCarDiffuser2 from "@/assets/products/difusor_carro_10ml1.jpeg";

// Chaves = coluna "nome" na tabela produtos. Produtos sem foto
// (Varetas) ficam de fora. A primeira imagem é a principal.
export const PRODUTO_IMAGENS: Record<string, string[]> = {
  "Difusor de Vidro": [pGlass, pGlass2, pGlass3],
  "Difusor PET": [pPet],
  "Home Spray": [pSpray, pSpray2, pSpray3, pSpray4],
  Refil: [pRefill],
  "Kit Lavabo": [pKitLavabo, pKitLavabo2, pKitLavabo3],
  CarSpray: [pCarSpray],
  "Difusor de Carro": [pCarDiffuser, pCarDiffuser2],
};
