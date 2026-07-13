import pGlass from "@/assets/product-glass.jpg";
import pGlass2 from "@/assets/product-glass-2.jpg";
import pGlass3 from "@/assets/product-glass-3.jpg";
import pPet from "@/assets/product-pet.jpg";
import pSpray from "@/assets/product-spray.jpg";
import pSpray2 from "@/assets/product-spray-2.jpg";
import pSpray3 from "@/assets/product-spray-3.jpg";
import pSpray4 from "@/assets/product-spray-4.jpg";
import pRefill from "@/assets/product-refill.jpg";
import pKitLavabo from "@/assets/product-kit-lavabo.jpg";
import pKitLavabo2 from "@/assets/product-kit-lavabo-2.jpg";
import pKitLavabo3 from "@/assets/product-kit-lavabo-3.jpg";
import pCarSpray from "@/assets/product-carspray.jpg";
import pCarDiffuser from "@/assets/product-car-diffuser.jpg";
import pCarDiffuser2 from "@/assets/product-car-diffuser-2.jpg";

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
