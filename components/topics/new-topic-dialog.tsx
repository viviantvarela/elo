"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/api";
import type { PastelKey } from "@/lib/types";

const pastelOptions: { value: PastelKey; label: string }[] = [
  { value: "sage", label: "Sálvia" },
  { value: "blue", label: "Azul" },
  { value: "peach", label: "Pêssego" },
  { value: "sand", label: "Areia" },
  { value: "lilac", label: "Lilás" },
];

export function NewTopicDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [component, setComponent] = useState("Programação");
  const [color, setColor] = useState<PastelKey>("sage");

  useEffect(() => {
    if (!open) return;
    setName("");
    setComponent("Programação");
    setColor("sage");
  }, [open]);

  const mutation = useMutation({
    mutationFn: api.createTopic,
    onSuccess: (topic) => {
      toast.success(`Tópico “${topic.name}” adicionado ao catálogo!`);
      for (const key of ["topics", "dashboard", "requests", "reports", "people"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo tópico curricular"
      description="Adicione um novo tópico para pedidos de monitoria e pareamento."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !component.trim()) {
                toast.error("Informe o nome do tópico e o componente curricular.");
                return;
              }
              mutation.mutate({ name: name.trim(), component: component.trim(), color });
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando…" : "Adicionar tópico"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nome do tópico">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Banco de Dados SQL" maxLength={60} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Componente curricular">
            <Input value={component} onChange={(e) => setComponent(e.target.value)} placeholder="Ex.: Informática" maxLength={80} />
          </Field>
          <Field label="Cor de identificação">
            <Select value={color} onChange={(e) => setColor(e.target.value as PastelKey)}>
              {pastelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
