# ACS Digital

Cadastro de pacientes com registro de estratificação de risco, feito em Node.js, Express e EJS.

## Estratificação de risco

Na ficha e no painel, use **Estratificação de risco** para registrar a classificação realizada pelo profissional responsável. Cada registro contém:

- Tipo: avaliação geral, hipertensão, diabetes, cardiovascular ou gestação.
- Categoria registrada: baixo, moderado, alto ou muito alto. Só utilize o módulo se a categoria corresponder à nomenclatura do protocolo adotado.
- Data da avaliação, nome e função do responsável, protocolo e versão/ano utilizados.
- Justificativa e critérios, plano de acompanhamento e próxima avaliação, quando definida pela equipe.

**Esta versão não calcula escores ou classificações clínicas.** O protocolo clínico ainda precisa ser escolhido e validado pela equipe antes de implementar um cálculo automático. Não há inferência de risco a partir dos marcadores de doenças nem prazo automático de visita. Sem avaliação, o paciente aparece como **não avaliado**, nunca como baixo risco.

As classificações ficam separadas por tipo. A classificação vigente é a avaliação com data mais recente daquele tipo; em datas iguais, prevalece o último registro. Uma avaliação antiga registrada depois não substitui uma mais recente. Para correções, adicione um novo registro com a justificativa. O histórico anterior é preservado pela aplicação. A exclusão de fichas com avaliações é bloqueada. O arquivo local pode ser alterado fora da aplicação; o histórico não é uma trilha de auditoria inviolável.

O painel filtra por tipo, classificação e reavaliação (prazo vencido, hoje ou sem data). Os filtros de classificação e prazo devem corresponder à mesma avaliação. Os contadores mostram todos os pacientes no tipo selecionado; os demais filtros afetam apenas a lista.

## Executar e testar

```sh
npm ci
npm test
npm start
```

Abra `http://localhost:3000`. A versão mínima declarada é Node.js 18; prefira uma versão LTS com suporte ativo.

Variáveis opcionais:

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `DATA_DIR` | Pasta da aplicação | Diretório persistente para `banco.json` |
| `APP_TIMEZONE` | `America/Boa_Vista` | Datas de acompanhamento e exibição dos registros |

Os cadastros existentes em `banco.json` são mantidos. Se configurar `DATA_DIR`, transfira o arquivo existente para esse diretório antes de iniciar; a aplicação não copia dados automaticamente. Não mantenha o arquivo ou o diretório de dados dentro de `public/`.

As gravações usam arquivo temporário e substituição por rename. O arquivo `banco.json.bak` guarda a versão anterior à última gravação. Uma leitura inválida bloqueia a operação, sem recriar ou sobrescrever cadastros. Esse backup local não substitui backups externos com retenção e recuperação testada. Use apenas uma instância/processo da aplicação com esse arquivo; este armazenamento não oferece coordenação entre múltiplas instâncias.

## Limites antes de uso com dados reais

O projeto ainda não tem autenticação, autorização por profissional/unidade ou auditoria de identidade. O nome do responsável é informado no formulário, não verificado por uma sessão autenticada. Use apenas dados fictícios em testes e demonstrações até implantar controle de acesso, HTTPS, armazenamento persistente, backups externos e os controles de privacidade necessários.

A ficha não integra nem envia dados ao e-SUS APS. As alterações nesta versão não tornam o sistema homologado pelo SUS.

## Verificações automatizadas

`npm test` utiliza o executor de testes do Node.js, servidor HTTP local e arquivos temporários com dados fictícios. Verifica registro e validação de avaliações, histórico, classificações independentes, filtros, compatibilidade das fichas, preservação na edição, bloqueio de exclusão, escape de HTML e proteção contra sobrescrita de banco corrompido.
