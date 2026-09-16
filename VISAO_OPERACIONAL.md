# Visão Operacional — como funciona

O dashboard tem duas visões, alternadas pelo toggle "Oficial / Operacional" no
topo da tela:

- **Oficial**: os últimos 12 meses **fechados** (ex: se hoje é setembro, vai de
  setembro do ano passado até agosto deste ano). É o dado usado pra segmentação
  "de verdade" — estável, só muda uma vez por mês.
- **Operacional**: uma **prévia** de como ficaria a segmentação se o mês
  fechasse hoje. Janela dinâmica (mês atual parcial + 11 meses fechados
  anteriores), recalculada todo dia via Power Automate. Serve pra prever quem
  pode subir ou descer de segmento antes do fechamento oficial — **não é dado
  definitivo**, pode mudar até o fim do mês.

## "Hoje (prévia)" e "Último fechado"

Dentro dos cards de resumo, em modo Operacional os rótulos mudam:

| Modo Oficial | Modo Operacional | O que representa |
|---|---|---|
| J1 - Atual | Hoje (prévia) | Segmentação calculada com a janela até hoje |
| J2 - Anterior | Último fechado | Segmentação do último mês oficialmente fechado |

**Importante:** "Último fechado" (Operacional) precisa ser sempre igual a
"J1 - Atual" (Oficial) — é o mesmo dado, só reaproveitado como referência de
comparação. Se algum dia esses dois números não baterem, é bug na lógica de
deslocamento da janela (`get data()` no `dashboard_segmentacao_producao.html`).

## Clientes que só existem numa das duas janelas

Como as duas janelas cobrem períodos diferentes, um cliente pode aparecer
numa visão e não na outra:

- **Cliente novo** (primeira compra recente, ex: essa semana): aparece em
  "Hoje", mas não existia no fechamento oficial anterior — não tinha nenhuma
  compra registrada até lá.
- **Cliente que saiu do filtro operacional** (raro): existia oficialmente mas
  não tem nenhuma compra na janela operacional atual.

### Por que clientes novos não contam em "Último fechado"

A primeira versão dessa lógica contava clientes novos como "Standard" em
"Último fechado", porque na ausência de dado (faturamento zero, margem zero
etc.) a regra de segmentação cai automaticamente em Standard. Isso estava
**errado**: dizer que um cliente novo "era Standard" no fechamento anterior é
inventar um dado — ele não era nada, porque não existia como cliente ainda.
Isso inflava artificialmente a contagem de Standard em "Último fechado".

A correção: o histórico desses clientes é marcado como `null` (não `0`), e
`criterioJ2()` reconhece isso e retorna `'SEM SEGMENTAÇÃO'` em vez de forçar
uma classificação. Esse rótulo não está entre os 4 segmentos exibidos
(Standard/Gold/Platinum/Diamond), então o cliente simplesmente não aparece
em nenhum card de "Último fechado" — mas continua contando no "Hoje" e no
"BASE TOTAL" normalmente.

**Efeito colateral esperado:** a soma dos 4 cards de "Último fechado"
(Standard + Gold + Platinum + Diamond) fica um pouco **menor** que o
"BASE TOTAL" em modo Operacional, porque os clientes novos não entram em
nenhum dos 4. Já a soma do "Hoje" bate certinho com o total. Isso é esperado,
não é bug.

## Onde essa lógica vive no código

Tudo dentro de `dashboard_segmentacao_producao.html` (mesma lógica precisa
ser espelhada em `docs/index.html`, a versão pública no GitHub Pages):

- `get data()` — monta a base de dados efetiva conforme o modo, incluindo o
  deslocamento de janela (J1 oficial vira "Último fechado") e os clientes
  novos (`novos`, com histórico `null`).
- `criterioJ2(r)` — classifica um cliente pro "Último fechado", tratando
  `null` como `'SEM SEGMENTAÇÃO'`.
- `windowLegend(forceOficial)` — gera os textos de período (J1..J7). O
  parâmetro `forceOficial` existe porque em alguns lugares (ex: o período do
  "Último fechado" nos cards) precisamos do período oficial de verdade,
  mesmo estando em modo Operacional — sem isso, a função devolve a versão já
  deslocada e a legenda fica errada.
