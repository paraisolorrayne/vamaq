/**
 * Quadro de pessoal: ficha do funcionário e suas passagens pela loja.
 * Server-only (usa pg). Só admin chega aqui — ver src/app/admin/funcionarios.
 */
import { query } from "@/lib/db";
import { normalizeCpf, isValidCpf } from "@/lib/rh/cpf";
import { DESLIGAR_SQL } from "@/lib/rh/sql";

/** Lista com o vínculo mais recente e o login, se houver. */
export async function listFuncionarios() {
  const { rows } = await query(
    `select f.id, f.nome,
            v.cargo, v.admissao, v.saida,
            u.id as user_id, u.email as user_email, u.active as user_active
       from funcionarios f
       left join lateral (
         select cargo, admissao, saida
           from funcionario_vinculos
          where funcionario_id = f.id
          order by admissao desc, created_at desc
          limit 1
       ) v on true
       left join users u on u.funcionario_id = f.id
      order by f.nome`
  );
  return rows.map((r) => ({ ...r, ativo: Boolean(r.admissao) && !r.saida }));
}

/** Ficha completa: dados, todas as passagens e o login vinculado. */
export async function getFuncionario(id) {
  const f = await query(`select * from funcionarios where id = $1`, [id]);
  if (!f.rows.length) return null;
  const v = await query(
    `select * from funcionario_vinculos
      where funcionario_id = $1 order by admissao desc, created_at desc`,
    [id]
  );
  const u = await query(
    `select id, name, email, role, active, must_change_password
       from users where funcionario_id = $1`,
    [id]
  );
  const vinculos = v.rows;
  return {
    ...f.rows[0],
    vinculos,
    vinculoAberto: vinculos.find((x) => !x.saida) || null,
    usuario: u.rows[0] || null,
  };
}

const CAMPOS = ["nome", "cpf", "rg", "nascimento", "telefone", "email_pessoal", "endereco", "obs"];

/** Valida e normaliza o que veio do formulário. Retorna {values} ou {error}. */
async function prepararFicha(data, { ignorarId = null } = {}) {
  const nome = String(data.nome || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const cpf = normalizeCpf(data.cpf);
  if (cpf && !isValidCpf(cpf)) return { error: "CPF inválido." };
  if (cpf) {
    const dup = await query(
      `select 1 from funcionarios where cpf = $1 and ($2::uuid is null or id <> $2)`,
      [cpf, ignorarId]
    );
    if (dup.rows.length) return { error: "Já existe um funcionário com esse CPF." };
  }

  return {
    values: {
      nome,
      cpf: cpf || null,
      rg: data.rg?.trim() || null,
      nascimento: data.nascimento || null,
      telefone: data.telefone?.trim() || null,
      email_pessoal: data.email_pessoal?.trim().toLowerCase() || null,
      endereco: data.endereco?.trim() || null,
      obs: data.obs?.trim() || null,
    },
  };
}

export async function createFuncionario(data) {
  const p = await prepararFicha(data);
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    // Os marcadores saem de CAMPOS, não escritos à mão: com a lista derivada de
    // um lado e $1..$8 fixos do outro, acrescentar um campo em CAMPOS quebraria
    // o insert em produção sem o build nem o lint reclamarem. Foi assim que a
    // emissão de nota caiu em 19/08/2026.
    `insert into funcionarios (${CAMPOS.join(", ")})
     values (${CAMPOS.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
    CAMPOS.map((c) => v[c])
  );
  return { funcionario: rows[0] };
}

export async function updateFuncionario(id, data) {
  const p = await prepararFicha(data, { ignorarId: id });
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    `update funcionarios set ${CAMPOS.map((c, i) => `${c} = $${i + 2}`).join(", ")}
      where id = $1 returning *`,
    [id, ...CAMPOS.map((c) => v[c])]
  );
  if (!rows.length) return { error: "Funcionário não encontrado." };
  return { funcionario: rows[0] };
}

/** Admite ou readmite: abre um vínculo novo. */
export async function admitir(id, { cargo, admissao, obs }) {
  cargo = String(cargo || "").trim();
  if (!cargo) return { error: "Informe o cargo." };
  if (!admissao) return { error: "Informe a data de admissão." };

  const aberto = await query(
    `select 1 from funcionario_vinculos where funcionario_id = $1 and saida is null`,
    [id]
  );
  if (aberto.rows.length) return { error: "Este funcionário já tem um vínculo em aberto." };

  const { rows } = await query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao, obs)
     values ($1,$2,$3,$4) returning *`,
    [id, cargo, admissao, obs?.trim() || null]
  );
  return { vinculo: rows[0] };
}

/** Desliga: fecha o vínculo e desativa o login, na mesma instrução. */
export async function desligar(id, { saida, motivo }) {
  if (!saida) return { error: "Informe a data de saída." };
  let rows;
  try {
    ({ rows } = await query(DESLIGAR_SQL, [id, saida, motivo?.trim() || null]));
  } catch (err) {
    if (err?.constraint === "vinculo_datas_check") {
      return { error: "A data de saída não pode ser anterior à admissão." };
    }
    throw err;
  }
  const row = rows[0] || {};
  if (!row.vinculo_id) return { error: "Este funcionário não tem vínculo em aberto." };
  return { ok: true, vinculo_id: row.vinculo_id, user_id: row.user_id || null };
}
