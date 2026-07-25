"use client";

import React, { useRef, useState } from "react";

type ArchiveItem = {
    id: string;
    type: string;
    label: string | null;
    note_text: string | null;
    file_name: string | null;
    file_size: number | null;
    url: string | null;
    created_at: string;
};

const TYPE_ICON: Record<string, string> = { photo: "\uD83D\uDDBC\uFE0F", document: "\uD83D\uDCC4", note: "\uD83D\uDCDD" };

/**
 * Dossier historique du vehicule (amelioration demandee) : glisser-deposer de
 * photos/documents anterieurs a BYX, ou ajout d'une note texte libre,
 * rattaches directement au vehicule (pas a un evenement technique). Reference
 * interne uniquement, jamais incluse automatiquement dans les rapports PDF.
 */
export function VehicleArchive({ vehicleId, initialItems }: { vehicleId: string; initialItems: ArchiveItem[] }) {
    const [items, setItems] = useState<ArchiveItem[]>(initialItems);
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
        setUploading(true);
        setError(null);
        const form = new FormData();
        form.append("file", file);
        form.append("type", file.type.startsWith("image/") ? "photo" : "document");
        form.append("label", file.name);
        const res = await fetch(`/api/vehicles/${vehicleId}/archive`, { method: "POST", body: form });
        const data = await res.json();
        setUploading(false);
        if (data.error) { setError(data.error); return; }
        setItems((prev) => [data.item, ...prev]);
  }

  async function uploadFiles(files: FileList | File[]) {
        for (const file of Array.from(files)) {
                await uploadFile(file);
        }
  }

  async function addNote() {
        if (!noteText.trim()) return;
        setUploading(true);
        setError(null);
        const form = new FormData();
        form.append("type", "note");
        form.append("note_text", noteText.trim());
        const res = await fetch(`/api/vehicles/${vehicleId}/archive`, { method: "POST", body: form });
        const data = await res.json();
        setUploading(false);
        if (data.error) { setError(data.error); return; }
        setItems((prev) => [data.item, ...prev]);
        setNoteText("");
  }

  return React.createElement(
        "section",
    { className: "card" },
        React.createElement("h2", { className: "font-display text-lg font-medium mb-2" }, "Dossier historique"),
        React.createElement(
                "p",
          { className: "text-sm text-muted mb-3" },
                "Photos, documents ou notes anterieurs a BYX, conserves ici comme reference interne (non inclus automatiquement dans les rapports)."
              ),
        React.createElement(
                "div",
          {
                    className: `border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted mb-3 ${dragOver ? "border-accent bg-accent/5" : "border-line"}`,
                    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
                    onDragLeave: () => setDragOver(false),
                    onDrop: (e: React.DragEvent) => {
                                e.preventDefault();
                                setDragOver(false);
                                if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
                    }
          },
                "Glissez-deposez des photos ou documents ici, ou ",
                React.createElement(
                          "button",
                  { type: "button", className: "text-accent hover:underline", onClick: () => fileInput.current?.click() },
                          "parcourez vos fichiers"
                        ),
                React.createElement("input", {
                          ref: fileInput,
                          type: "file",
                          multiple: true,
                          accept: "image/*,application/pdf,.doc,.docx,text/plain",
                          className: "hidden",
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                      if (e.target.files?.length) uploadFiles(e.target.files);
                                      e.target.value = "";
                          }
                })
              ),
        React.createElement(
                "div",
          { className: "flex items-center gap-2 mb-3" },
                React.createElement("input", {
                          className: "input flex-1",
                          placeholder: "Ajouter une note libre...",
                          value: noteText,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNoteText(e.target.value)
                }),
                React.createElement(
                          "button",
                  {
                              type: "button",
                              className: "btn btn-secondary text-sm px-3 py-2",
                              disabled: uploading || !noteText.trim(),
                              onClick: addNote
                  },
                          "Ajouter"
                        )
              ),
        uploading ? React.createElement("p", { className: "text-xs text-muted mb-2" }, "Envoi en cours...") : null,
        error ? React.createElement("p", { className: "text-xs text-danger mb-2" }, error) : null,
        items.length === 0
          ? React.createElement("p", { className: "text-sm text-muted" }, "Aucun element dans le dossier historique.")
          : React.createElement(
                      "ul",
            { className: "divide-y divide-line" },
                      items.map((item) =>
                                    React.createElement(
                                                    "li",
                                      { key: item.id, className: "py-2 flex items-center justify-between text-sm gap-3" },
                                                    React.createElement(
                                                                      "span",
                                                      { className: "flex items-center gap-2 min-w-0" },
                                                                      React.createElement("span", null, TYPE_ICON[item.type] ?? ""),
                                                                      item.type === "note"
                                                                        ? React.createElement("span", { className: "truncate" }, item.note_text)
                                                                        : item.url
                                                                        ? React.createElement(
                                                                                                "a",
                                                                          { href: item.url, target: "_blank", rel: "noreferrer", className: "text-accent hover:underline truncate" },
                                                                                                item.label || item.file_name
                                                                                              )
                                                                        : React.createElement("span", { className: "truncate" }, item.label || item.file_name)
                                                                    ),
                                                    React.createElement(
                                                                      "span",
                                                      { className: "text-muted text-xs whitespace-nowrap" },
                                                                      new Date(item.created_at).toLocaleDateString("fr-FR")
                                                                    )
                                                  )
                                          )
                    )
      );
}
