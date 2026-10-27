# Minha escala

Aplicativo em português para planejar escalas 5x2 e 6x1, com jornadas individuais, setores, folgas conjuntas, pessoas de apoio, férias e mínimos por setor em datas especiais.

## Usar

Abra o endereço publicado no GitHub Pages ou baixe esta pasta e abra `index.html` no navegador. O aplicativo não exige instalação nem servidor de aplicação.

Os cadastros iniciais estão no código do aplicativo. Alterações, férias e escalas são salvas no navegador de cada pessoa. **Não há sincronização entre usuários ou computadores.** Use Salvar backup e Restaurar backup para transferir dados.

## Planejar a escala

1. Revise os funcionários, setores, cargas e horários.
2. Escolha a regra de domingos de cada funcionário.
3. Cadastre as folgas conjuntas, férias e disponibilidades de apoio.
4. Informe mínimos por setor nas datas especiais, quando necessário.
5. Escolha a segunda-feira inicial e o período e clique em Gerar escala.
6. Confira os alertas; exporte CSV, imprima ou salve PDF.

As regras trabalhistas e a cobertura durante todo o expediente precisam ser conferidas pelo responsável. As cotas mensais completas dependem de o período conter todos os domingos do mês. Consulte `LEIA-ME.txt` para detalhes das regras e limitações.

## Verificar o código

Com Node.js instalado:

```sh
node test.cjs
node test-rules.cjs
```

## Publicação

O GitHub Pages publica os arquivos da raiz da branch `main`. O arquivo `.nojekyll` permite servir diretamente HTML, CSS e JavaScript. Novos commits nessa branch atualizam o site.
