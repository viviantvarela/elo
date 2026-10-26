import { NextResponse } from "next/server";

export function ok<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Não encontrado") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = "Sem permissão para esta ação") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** A ação não vale para o estado atual do registro (ex.: cancelar um pedido já concluído). */
export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(message = "Falha interna ao processar a requisição") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function searchParam(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key);
}
