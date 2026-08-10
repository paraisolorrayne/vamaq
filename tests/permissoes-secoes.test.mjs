/**
 * Quem enxerga cada seção do /admin.
 *
 * POR QUE ESTE ARQUIVO EXISTE: duas vezes uma seção foi liberada no menu sem
 * que as guardas por trás fossem junto (ou o contrário), e o resultado é sempre
 * o mesmo — a pessoa abre a tela e ela vem vazia, ou o botão a expulsa. Não dá
 * erro, não aparece em log, e ninguém reclama porque parece "não ter nada ali".
 *
 *   - CRM: a secretaria via o menu e as 6 rotas exigiam vendedor. Meses assim.
 *   - Notas Fiscais: a secretaria NÃO via o menu, mas o botão "Emitir nota" no
 *     estoque aparecia para qualquer papel — bastava um carro virar vendido.
 *
 * `permissions.js` é puro (sem imports), então este teste é barato e roda em
 * `node --test` sem banco e sem servidor. Ele fixa o mapa de acesso: mudar
 * quem vê o quê passa a exigir mexer aqui, de propósito.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessPath, navFor, ROLES } from "../src/lib/auth/permissions.js";

const PAPEIS = Object.keys(ROLES); // admin, estoque, financeiro, vendedor, secretaria

// O mapa esperado, seção por seção. Manter em ordem de menu.
// `admin` fica de fora das listas: ele passa em tudo, e isso é testado à parte.
const ACESSO = {
  "/admin": ["estoque", "financeiro", "vendedor", "secretaria"],
  "/admin/estoque": ["estoque", "financeiro", "vendedor", "secretaria"],
  "/admin/crm": ["vendedor", "secretaria"],
  "/admin/clientes": ["secretaria", "financeiro"],
  "/admin/financeiro": ["financeiro", "secretaria"],
  "/admin/fiscal": ["financeiro", "secretaria"],
  "/admin/documentos": ["vendedor", "secretaria"],
  "/admin/criativos": ["estoque", "vendedor", "secretaria"],
  "/admin/fipe": ["estoque", "financeiro", "secretaria"],
  "/admin/tutoriais": ["estoque", "financeiro", "vendedor", "secretaria"],
  "/admin/funcionarios": [],
  "/admin/usuarios": [],
};

for (const [rota, permitidos] of Object.entries(ACESSO)) {
  test(`${rota}: só ${permitidos.join(", ") || "admin"}`, () => {
    for (const papel of PAPEIS) {
      if (papel === "admin") continue;
      const esperado = permitidos.includes(papel);
      assert.equal(
        canAccessPath(papel, rota),
        esperado,
        `${papel} ${esperado ? "deveria" : "NÃO deveria"} acessar ${rota}`
      );
    }
  });
}

test("admin acessa todas as seções", () => {
  for (const rota of Object.keys(ACESSO)) {
    assert.equal(canAccessPath("admin", rota), true, `admin barrado em ${rota}`);
  }
});

test("a secretaria vê Notas Fiscais no menu", () => {
  // O caso concreto que motivou este arquivo: a Mayra perguntou onde emitia a
  // nota e não achava, porque a seção não aparecia para o papel dela.
  const menu = navFor("secretaria").map((i) => i.label);
  assert.ok(menu.includes("Notas Fiscais"), `menu da secretaria: ${menu.join(", ")}`);
});

test("quem não pode emitir nota também não vê a seção", () => {
  // O botão "Emitir nota" do estoque usa canAccessPath("/admin/fiscal") para
  // decidir se aparece. Estes dois papéis veem o estoque mas não a seção
  // fiscal — para eles o botão não pode existir.
  for (const papel of ["estoque", "vendedor"]) {
    assert.equal(canAccessPath(papel, "/admin/estoque"), true, `${papel} deveria ver o estoque`);
    assert.equal(canAccessPath(papel, "/admin/fiscal"), false, `${papel} NÃO deveria ver o fiscal`);
  }
});

test("subrota herda o acesso da seção", () => {
  // /admin/fiscal/emitir/<id> é onde o botão leva; se a herança quebrar, o
  // botão volta a expulsar.
  assert.equal(canAccessPath("secretaria", "/admin/fiscal/emitir/abc"), true);
  assert.equal(canAccessPath("vendedor", "/admin/fiscal/emitir/abc"), false);
});

test("o dashboard não engole as outras seções", () => {
  // `/admin` é prefixo de tudo; se ele não for o último de SECTIONS, uma seção
  // restrita passa a ser acessível por engano.
  assert.equal(canAccessPath("vendedor", "/admin/usuarios"), false);
  assert.equal(canAccessPath("estoque", "/admin/financeiro"), false);
});
