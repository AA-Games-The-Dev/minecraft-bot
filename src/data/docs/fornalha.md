# Resumo completo: Fornalha (Furnace) no Minecraft

## O que é

A **fornalha** é um bloco usado para **fundir** (smelt) e **cozinhar** itens ao combinar um insumo com um **combustível**.

* **Renovável:** sim
* **Empilhável:** 64
* **Dureza / Resistência à explosão:** 3.5 / 3.5
* **Luminosidade:** 13 **quando ativa**
* **Transparência:** parcial (quando ativa)
* **Inflamável / Pega fogo com lava:** não / não
* **Cor do mapa (JE):** pedra (STONE 11)
* **Observação (JE):** **não** pode ser empurrada por pistões.

---

## Obtenção

### Quebra

* **Ferramenta:** **picareta** (qualquer). Sem picareta, **não** dropa a si mesma.
* Ao ser quebrada, derruba o **conteúdo interno**. XP armazenado por itens processados e **extraídos por funis** também cai.

### Geração natural (exemplos)

* **Vilas:** armeiro (planícies, deserto, algumas savanas), algumas casas na **nevada** e uma das casas em **taiga/taiga nevada** (BE).
* **Outros:** **cidades antigas**, **trail ruins** e **sempre** 1 em cada **iglú**.

### Saque gerado

* Baú de **casa nevada** em vilas: **1 fornalha** (~9,9%).

### Criação (crafting)

* **8 blocos “nível pedra”** ao redor (centro vazio) ⇒ **1 fornalha**.
  Pode usar **pedregulho**, **pedregulho-de-ardósia** (cobbled deepslate) ou **blackstone** de forma **intercambiável**.

> JE: uma fornalha “acesa” só via comandos; no inventário não aparece acesa.
> BE: versão acesa só por edição de inventário e **permanece acesa**.

---

## Uso

### Processar itens (fundir/cozinhar)

* Interface com **2 slots**: **topo** (item a processar, 1 pilha) e **baixo** (combustível, 1 pilha).
* **Velocidade:** 1 item a cada **200 ticks** = **10 s** (≈6 itens/min).
* O combustível é **consumido no início** e queima **até o fim**, mesmo se retirar ou faltar item no topo (pode **desperdiçar** tempo de queima).
* Se o combustível acabar antes de concluir um item, o progresso **para** e precisa de novo combustível.

### Fonte de luz

* **Nível 13** quando acesa; emite **fumaça** e **partículas de chama**.

### Ingrediente de criação

* **Alto-forno**: 5 ferros + **fornalha** + 3 **pedras lisas**.
* **Defumador (Smoker)**: 1 **fornalha** + 8 blocos de madeira (troncos/haste/lenho/hipas, com ou sem casca).
* **Carrinho com fornalha** (JE): **fornalha** + **carrinho**.

### Nome personalizado

* Renomeie na **bigorna** antes de colocar ou defina via **/data** (JE).

### Trava (JE)

* Defina a tag **lock** via **/data**. Só abre segurando um item cujo **nome** seja igual ao texto da trava.

### Bloco musical

* Fornalha sob **noteblock** produz som de **“bumbo” (bass drum)**.

---

## Dicas rápidas

* **Otimize combustível**: processe em **múltiplos** do rendimento do combustível (ex.: **carvão** = 8 itens) para evitar desperdício.
* Use **alto-forno** para minérios e **defumador** para comida quando quiser mais **velocidade** (mantendo uma fornalha comum para o restante).
* Em farms com **funis**, lembre que a fornalha **continua queimando** até terminar o combustível atual; sincronize entradas para não perder queima.