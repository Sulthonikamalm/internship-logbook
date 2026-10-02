"use client";
import { WORK_CATEGORIES, categoryLabels, categoryDescriptions, type WorkCategory } from "../domain/category";

export function CategoryField({ value, onChange, disabled = false }: { value: WorkCategory; onChange: (value: WorkCategory) => void; disabled?: boolean }) {
  return <label className="block space-y-2 text-sm font-medium"><span>Kategori kegiatan</span><select className="w-full" value={value} onChange={event => onChange(event.target.value as WorkCategory)} disabled={disabled}>{WORK_CATEGORIES.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select><span className="block text-xs font-normal text-muted-foreground">{categoryDescriptions[value]}</span></label>;
}
