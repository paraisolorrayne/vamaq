/**
 * CPF da ficha de funcionário: normalização e dígito verificador.
 * Puro (sem I/O) para poder ser testado direto com node --test.
 */

/** Só os dígitos. `null`/`undefined` viram string vazia. */
export function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Valida os dois dígitos verificadores. Sequências repetidas são inválidas. */
export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // dígito(9) confere o 10º caractere; dígito(10) confere o 11º.
  const digito = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
