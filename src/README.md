# Minecraft RAG Bot

Este projeto implementa um bot para o Minecraft que utiliza o conceito de
**Retrieval‑Augmented Generation (RAG)** para responder a perguntas
relacionadas às mecânicas básicas do jogo. Ele combina um banco de
conhecimento local com um modelo de linguagem grande (LLM) de código
aberto para gerar respostas contextualizadas dentro do próprio chat do
jogo.

## Pré‑requisitos

* **Node.js** versão 16 ou superior.
* Minecraft Java Edition executando um servidor local (`host` e
  `port` configurados no arquivo `config.js`).
* Uma instância do **Ollama** ou outro servidor compatível com
  `llama3.1:8b-instruct` ou `mistral-7b-instruct` rodando em
  `http://localhost:11434/v1/chat/completions`.

Opcionalmente, você pode substituir o modelo configurado em
`config.js` por qualquer LLM de código aberto suportado pelo seu
ambiente.

## Instalação

1. Clone ou extraia este repositório para uma pasta local.
2. Instale as dependências:

   ```bash
   npm install mineflayer mineflayer-pathfinder mineflayer-collectblock axios
   ```

3. Gere o índice do conjunto de dados. Este passo lê o arquivo
   `data/recipes.json`, calcula tokens simplificados e escreve
   `data/index.json`.

   ```bash
   npm run ingest
   ```

## Executando o bot

Para iniciar o bot no seu mundo local do Minecraft:

```bash
npm start
```

O bot conectará ao servidor configurado em `config.js` com o nome de
usuário definido. Ele escutará mensagens no chat e utilizará o módulo
de recuperação (`services/rag.js`) para buscar respostas às perguntas
incluídas em `data/recipes.json`. Se não houver correspondência, a
pergunta será encaminhada ao LLM configurado, cujo endpoint é
definido em `config.js`.

## Dataset e ingestão

O diretório `data` contém um arquivo `recipes.json` com exemplos de
perguntas, respostas de referência e fontes. Sinta‑se livre para
adicionar novas entradas ao dataset. Após modificar o arquivo,
execute `npm run ingest` novamente para reconstruir o índice.

O índice gerado (`data/index.json`) armazena os tokens de cada
documento. A recuperação é baseada na similaridade Jaccard entre
esses tokens e os tokens da pergunta do jogador. Em ambientes
avançados, você pode substituir essa lógica por uma consulta a
bases de vetores (ChromaDB, Faiss, Qdrant, etc.).

## Avaliação

Um script simples de avaliação está disponível em `scripts/eval.js`.
Ele mede a precisão e o recall do módulo de recuperação executando
consultas sobre o dataset e verificando se as respostas corretas
aparecem nas primeiras posições. Para executar a avaliação e salvar
os resultados em `eval/results.json`:

```bash
npm run eval
```

O arquivo de resultados contém métricas agregadas como
`precision_at_1`, `precision_at_3`, `recall_at_1`, `recall_at_3` e
`groundedness` média das respostas recuperadas. Essas métricas podem
ser utilizadas para compor os slides de avaliação.

## Estrutura do projeto

- `index.js` – Ponto de entrada que inicializa o bot e seus
  componentes.
- `actions/` – Implementa ações específicas dentro do mundo do
  Minecraft (andar, coletar blocos, etc.).
- `bot/` – Controlador principal que integra decisões, ações e a
  interface de chat.
- `decisions/` – Módulos responsáveis por interpretar as mensagens e
  decidir qual ação executar.
- `helpers/` – Funções auxiliares para lidar com entidades e o
  ambiente do jogo.
- `services/` – Contém o módulo de LLM (`llm.js`) e o módulo de
  recuperação (`rag.js`).
- `state/` – Gerencia estados internos, como memória de contexto.
- `scripts/` – Scripts utilitários para ingestão (`ingest.js`) e
  avaliação (`eval.js`).
- `data/` – Dataset com perguntas e respostas e o índice gerado.
- `eval/` – Resultados de métricas gerados pela avaliação.

## Justificativa das escolhas tecnológicas

O projeto utiliza **Mineflayer** para controlar um cliente Minecraft
por ser a biblioteca mais completa e flexível para automação de
Minecraft em Node.js. O módulo de recuperação foi implementado de
forma simplificada utilizando similaridade Jaccard para facilitar a
interpretação e permitir que a lógica seja facilmente substituída por
uma solução de embeddings em bases de vetores. A comunicação com o
modelo de linguagem é feita via HTTP, permitindo a integração com
modelos locais servidos através do Ollama ou de outras APIs
compatíveis.