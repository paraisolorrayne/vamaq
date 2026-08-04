/**
 * SQL do desligamento. Fica num módulo PURO (só strings) por dois motivos:
 * o teste consegue rodá-lo contra o Postgres sem passar pelo alias "@/", e a
 * instrução exercitada no teste é literalmente a que a aplicação executa.
 *
 * Fechar o vínculo e cortar o acesso acontecem na MESMA instrução: não existe
 * instante em que a pessoa está desligada e o login continua valendo.
 *
 * Parâmetros: $1 funcionario_id · $2 saida (date) · $3 motivo (text|null)
 * Retorno: uma linha { vinculo_id, user_id } — `vinculo_id` nulo significa que
 * não havia vínculo aberto; `user_id` nulo apenas indica ficha sem login.
 */
export const DESLIGAR_SQL = `
  with fechado as (
    update funcionario_vinculos
       set saida = $2, motivo_saida = $3
     where funcionario_id = $1 and saida is null
    returning id, funcionario_id
  ), acesso as (
    update users set active = false
     where funcionario_id in (select funcionario_id from fechado)
    returning id
  )
  select (select id from fechado) as vinculo_id,
         (select id from acesso)  as user_id
`;
