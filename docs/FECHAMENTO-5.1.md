# Fechamento 5.1

Base integrada por fast-forward: `2349394e4f15a6d4b393a2cb37b50b5ca0884378`,
na branch `madeireira-sol-nascente-rpm`. Este fechamento é registrado no commit
`Finaliza fechamento operacional e segurança`, sem tag, release ou alteração de main.

## Preservação e merge

As oito alterações locais foram copiadas, com hashes e diff binário, para
`/home/cesar/projetos/madeireira-fechamento-5.1-qxmb5h2v/`. Também foi criado e
mantido o stash `Preservacao fechamento 5.1 antes de integrar 2349394`, incluindo
`.firebaserc` e `firebase.json`, antes da atualização. Nada ficou staged.

- `.claude/helpers/.helpers-version`, `.claude/helpers/helpers.manifest.json`,
  `CLAUDE.md`, `.firebaserc` e `firebase.json` foram preservados byte a byte.
- `src/hooks/useKlabinDatabase.ts`: conflito resolvido semanticamente. Mantidos
  o controle por UID, dados locais atuais, descarte de callback após logout e
  unsubscribe da auditoria; preservado o bloqueio local para Firebase não
  configurado. O estado booleano local redundante foi incorporado à assinatura
  autenticada única, sem manter dois listeners concorrentes.
- `src/utils/googleAuth.ts`: o merge textual duplicava `onFirebaseUser`.
  A definição local foi mantida, inclusive a reconexão silenciosa. Continua
  independente do token Drive e conserva o unsubscribe. O arquivo final é
  idêntico à cópia local preexistente; seu comportamento aprovado é testado.

## Política Firebase existente e complemento 5.1

A política local já restringia o banco à conta proprietária identificada em
`firestore.rules`. Ela foi preservada, acrescentando `email_verified == true`
e provedor de autenticação `google.com`. Não foi criada uma lista nova de
usuários nem uma separação artificial por máquina: o app sincroniza o mesmo
banco entre máquinas da conta proprietária.

O aplicativo autentica com Firebase Auth por `GoogleAuthProvider.credential`.
A mesma instância Firebase atende Firestore. As seis coleções operacionais
exigem CRUD completo do proprietário para lançamentos, quitações, reversões,
exclusões e restauração autoritativa. Os listeners leem as seis coleções mais
settings. O listener atual lista settings; por isso a leitura dessa coleção
continua permitida ao proprietário, mas criação/atualização fica limitada a
`settings/global`, único documento gravado pelo aplicativo. Exclusão de
settings e caminhos/coleções não usados são negados.

Não foi imposto esquema rígido aos registros existentes, pois campos opcionais
e legados precisam continuar aceitos. O modo sem login continua local; tentativas
de sincronização de outra conta são negadas pelas regras, sem conceder acesso
público. A identidade existente é suficiente para esta política de proprietário
único. Múltiplos operadores com permissões diferentes exigiriam uma lista de
UIDs/papéis administrada de modo confiável; isso não é necessário para o contrato
atual e não foi implementado.

`.firebaserc` e `firebase.json` já apontavam ao projeto e banco nomeado usados
pelo aplicativo. Foram somente lidos e preservados. **Não houve deploy de regras,
login real, consulta ou alteração de dados Firebase/Drive de produção.**

## Testes reproduzíveis

```sh
npm ci
npm run lint
npm test
bash scripts/test-firestore-rules.sh
npm run dist:rpm:fedora
npm run release:verify
git diff --check
```

O script de regras instala ferramentas somente em `release/closure/firebase-tools`
(firebase-tools 15.29.0, rules-unit-testing 5.0.2 e Firebase 12.18.0). Não altera
as dependências do aplicativo. Requer Java e usa somente o projeto
`demo-madeireira-closure` no endereço `127.0.0.1:18080`, com config isolada e
cópia do arquivo de regras. O teste recusa outro projeto/endereço.

Os 13 testes reais de regras verificam CRUD/listagem das seis coleções, rejeição
de anônimo/outra conta/e-mail não verificado/provedor incorreto/claims ausentes,
settings/global, caminhos não autorizados, listener e restauração em batch.
A CLI usada não carrega regras para múltiplos bancos nomeados no emulador:
a suíte aplica o mesmo ruleset ao banco padrão de demonstração e confere que a
configuração local de deploy aponta ao banco nomeado correto. Não se deve inferir
que as regras de produção foram verificadas ou implantadas.

Referências: [testes de regras Firebase](https://firebase.google.com/docs/rules/unit-tests),
[identidade nas regras](https://firebase.google.com/docs/rules/rules-and-auth).

## Separação das alterações

Alterações locais antigas permanecem sem commit. O snapshot `preexisting/` e o
snapshot `merged-preexisting/` do backup distinguem o conteúdo anterior do merge.
As mudanças novas do fechamento são exclusivamente:

- Complemento em `firestore.rules`: e-mail verificado, provedor Google e limite
  de escrita em settings/global.
- Um teste de reconexão silenciosa em `src/__tests__/googleAuth.audit.test.ts`.
- `scripts/test-firestore-rules.sh` e `scripts/firebase/firestore.rules.node.cjs`.
- `package.json`, `packaging/rpm-after-remove.sh`, `packaging/rpm-posttrans.sh`,
  `scripts/tests/rpm-lifecycle.node.cjs` e `scripts/verify-rpm-fedora.sh`: correção
  comprovada do ciclo de reinstalação RPM, descrita abaixo.
- Este documento.

O hook e googleAuth resultam da integração semântica das alterações antigas,
não de uma nova refatoração. O patch incremental `closure-5.1.patch` no backup
separa as mudanças novas das antigas. Nenhuma tela, regra financeira, formato de
banco/PDF ou versão Electron foi modificada neste fechamento.

Os logs, RPM e evidências deste passo ficam em `release/closure/` e `release/`.
O perfil real do aplicativo foi copiado para o backup antes da instalação; o
smoke test usa outro perfil temporário, com rede bloqueada, na sessão gráfica
real Fedora 44. Não deve apagar nem restaurar o perfil do usuário.

A única pendência de segurança de produção esperada é a revisão/publicação
controlada das regras e validação do login autorizado após essa publicação,
quando expressamente autorizada. Este passo não afirma que o servidor já esteja
protegido. Não há necessidade de migração de dados para começar NF-e/DANFE.

## Resultados locais

TypeScript/lint, 103 testes Vitest + 10 Electron/release/RPM (113 no total), build
de produção/RPM, actionlint, sintaxe Bash e git diff --check aprovados.
Regras: 13/13 testes de emulador aprovados. Electron permanece em 44.2.0.

O worktree `/tmp/madeireira-audit-79fafe6` foi removido com `git worktree remove`
e seu registro limpo com `git worktree prune`, somente após confirmar o commit
integrado, a ausência de mudanças exclusivas e arquivar/verificar por hash suas
evidências e RPM anteriores em `audit-evidence.tar.gz` no backup.

## Correção de reinstalação comprovada no Fedora real

A primeira reinstalação via DNF instalou o payload novo, mas terminou com erro
no postun do RPM antigo: ele tentava remover a alternativa pelo caminho do
link genérico. O pacote seguinte também tinha um problema de ciclo: seu postun
removia a alternativa durante upgrade/reinstalação, depois do postinstall novo.

O fechamento acrescenta um afterRemove que não executa limpeza quando o RPM
informa que outra versão permanece instalada, e um posttrans que restabelece
a alternativa após os scripts das versões antigas. O script do pacote antigo
não pode ser reescrito retroativamente pelo RPM novo: se a primeira transição
da versão antiga terminar com esse erro específico após instalar o payload,
a reinstalação do novo RPM conclui a transição. Não é necessário remover o
aplicativo, apagar perfil, usar --nodeps nem editar a base RPM.

A validação em contêiner agora reinstala o mesmo RPM antes de executar o smoke
test e também valida a remoção final. O novo teste Node exige que postun não
execute limpeza durante reinstalação. Essas alterações foram motivadas pela
falha real; não mudam interface, dados, versão nem dependências.

## Resultado do Fedora real e encerramento

A reinstalação final via DNF terminou com `Complete!` e código zero. O aplicativo
instalado abriu na sessão gráfica real e passou 17 transições de navegação,
preload/IPC, Electron 44.2.0 e sandbox, sem exceções do renderer ou erro fatal.
Houve apenas um aviso não fatal de Vulkan/Wayland, sem impedir a renderização.
O ASAR instalado coincide por hash com o build final; `rpm -V` e `dnf check`
passaram, e todos os 278 arquivos do perfil original conservaram seus hashes.
O teste usou perfil temporário e rede bloqueada; não abriu a base real.

Outro Fedora 44 limpo também passou instalação, reinstalação, navegação e
remoção do RPM, sem arquivo residual ou dependência quebrada.

RPM final: `release/Madeireira-Sol-Nascente-1.0.0-x86_64.rpm`.
SHA-256: `a9fe24aefde36a9049d585673124676bb1e2f8eeeeec5d570bee4f781aa82ce2`.
Origem no manifesto: 2349394, dirty=true (alterações locais mantidas).
O RPM acima foi produzido antes do commit de fechamento; não houve publicação de release ou deploy Firebase.

## Separação final para o commit

A comparação com o stash e os snapshots confirmou que a restrição por e-mail
do proprietário é anterior ao 5.1. Para não incluí-la por engano, o índice
contém somente o novo predicado `isVerifiedGoogle()` e as restrições de settings.
O working tree combina esse predicado com `isOwner()`, conservando a política
local anterior. Assim, o commit isolado exige autenticação Google com e-mail
verificado, mas a limitação à conta proprietária continua exclusivamente local.

Os testes de emulador funcionam também sem os arquivos locais `firebase.json`
e `.firebaserc`. A verificação do banco de deploy ocorre quando a configuração
local existe. O cenário de rejeição de outra conta é executado com a política
local presente; no commit isolado ele é explicitamente marcado como ignorado,
pois depende da restrição antiga que não pertence a este commit.

`src/hooks/useKlabinDatabase.ts`, `src/utils/googleAuth.ts`, os arquivos Claude
e as duas configurações Firebase ficam fora do índice. Stash e backup original
continuam disponíveis. A extração do predicado não muda a política efetiva do
working tree: mantém proprietário, e-mail confirmado e provedor Google.

Validação repetida para o commit: lint e 103 testes Vitest + 10 testes
Electron/release/RPM passaram tanto no working tree quanto na exportação
isolada do índice. O emulador passou 13/13 testes com a política local; na
exportação isolada, 12 passaram e o teste da conta proprietária foi ignorado
explicitamente. Sintaxe Bash e `git diff --check` (local e staged) passaram.
