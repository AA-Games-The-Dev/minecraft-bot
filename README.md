# Minecraft Bot

Projeto reorganizado em módulos para facilitar manutenção do bot Lais baseado em Mineflayer.

## Executando

```bash
npm install
npm start
```

O comando `start` inicializa o bot usando as configurações definidas em `src/config.js`.

## Estrutura do projeto

- `src/index.js`: ponto de entrada que cria o bot e injeta o controlador.
- `src/config.js`: parâmetros de conexão e intervalos de decisão.
- `src/bot/controller.js`: orquestra eventos, ciclos de comportamento e integra decisões.
- `src/actions/`: ações de coleta, combate, craft e suporte.
- `src/decisions/`: lógica de interpretação de comandos e decisões autônomas.
- `src/helpers/`: utilidades para manipular blocos e entidades.
- `src/state/`: estado compartilhado do bot (memória e tarefas).
- `src/services/llm.js`: cliente para comunicação com o servidor de LLM.

Essa organização permite evoluir comportamentos do bot de forma modular e extensível.
