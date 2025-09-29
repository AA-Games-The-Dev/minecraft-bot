# Minecraft Bot com RAG baseado em embeddings

Projeto reorganizado em módulos para facilitar manutenção do bot Lais baseado em Mineflayer. A versão atual inclui uma camada RAG com embeddings e fontes documentais externas, compatível com servidores de modelos abertos como Ollama ou LM Studio.

## Pré-requisitos

* Node.js 18+
* Servidor de LLM compatível com a API de Chat Completions (por exemplo [Ollama](https://ollama.com/) ou [LM Studio](https://lmstudio.ai/))
* (Opcional) Cache dos modelos utilizados pelo pacote `@xenova/transformers` para acelerar a ingestão

## Configuração

O comportamento do bot pode ser ajustado via variáveis de ambiente. Os principais parâmetros são:

| Variável | Descrição | Valor padrão |
| --- | --- | --- |
| `LLM_ENDPOINT` | URL do endpoint compatível com Chat Completions | `http://localhost:11434/v1/chat/completions` |
| `LLM_MODEL` | Nome do modelo a ser usado | `llama3.1:8b-instruct` |
| `LLM_API_KEY` | Token usado em servidores que exigem autenticação (ex.: LM Studio usa `lm-studio`) | — |
| `EMBEDDING_MODEL` | Modelo de embeddings carregado pelo `@xenova/transformers` | `Xenova/all-MiniLM-L6-v2` |
| `BOT_HOST`, `BOT_PORT`, `BOT_USERNAME` | Configurações de conexão com o servidor Minecraft | `localhost`, `25565`, `Lais` |

### Compatibilidade com LM Studio

Para usar o LM Studio com o bot, basta expor um modelo open-source na aba **Server** e apontar as variáveis:

```bash
export LLM_ENDPOINT="http://localhost:1234/v1/chat/completions"
export LLM_MODEL="meta-llama/Meta-Llama-3-8B-Instruct"
export LLM_API_KEY="lm-studio"
```

O cliente em `src/services/llm.js` adiciona o cabeçalho `Authorization: Bearer <LLM_API_KEY>`, garantindo compatibilidade com o LM Studio.

## Fontes de conhecimento

Além do dataset de perguntas e respostas (`src/data/recipes.json`), foram adicionados documentos de apoio em `src/data/docs`. O script de ingestão gera embeddings para cada FAQ e para trechos relevantes desses documentos, criando um índice vetorial utilizado na recuperação.

## Execução

Instale as dependências e gere o índice de embeddings antes de iniciar o bot:

```bash
npm install
npm run ingest
npm start
```

> A primeira execução de `npm run ingest` fará o download do modelo `Xenova/all-MiniLM-L6-v2`. O processo é assíncrono e o progresso aparece no terminal.

## Avaliação

Duas rotinas de avaliação estão disponíveis na pasta `src/scripts`:

* `npm run eval:retrieval` — calcula precisão, recall e groundedness do componente de recuperação.
* `npm run eval:generation` — executa o fluxo RAG completo, consulta o LLM e gera um relatório `src/eval/generation.json` com as respostas produzidas e a métrica F1 em relação às referências.

A avaliação de geração requer que o servidor de LLM esteja ativo (Ollama ou LM Studio).

## Estrutura do projeto

- `src/index.js`: ponto de entrada que cria o bot e injeta o controlador.
- `src/config.js`: parâmetros de conexão, modelos e tempos.
- `src/bot/controller.js`: orquestra eventos, ciclos de comportamento e integra decisões.
- `src/decisions/chat.js`: decisão de diálogo, combinando respostas determinísticas e LLM com contexto recuperado.
- `src/services/rag.js`: motor de recuperação vetorial (embeddings + similaridade coseno).
- `src/services/embeddings.js`: wrapper para carregar e reutilizar o modelo de embeddings.
- `src/scripts/ingest.js`: geração do índice vetorial a partir das FAQs e documentos.
- `src/scripts/eval.js`: métricas de recuperação (precision/recall/groundedness).
- `src/scripts/eval_generation.js`: métricas de geração (F1 token-level).
- `src/data/`: dataset de perguntas/respostas e documentos externos.

Essa organização permite evoluir comportamentos do bot de forma modular, documentada e alinhada aos requisitos do trabalho de IA Generativa com RAG.
