/**
 * localStorage seguro: em iframe sandbox (ou Safari privado) o acesso lança
 * SecurityError. Aqui a falha vira memória — a app continua funcionando.
 */

const memory = new Map<string, string>();

export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* memória basta */
    }
  },
};
