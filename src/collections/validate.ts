import type { FieldSchema } from './types.ts';

function defaultForField(field: FieldSchema): unknown {
  if (field.type === 'array') return [];
  if (field.type === 'checkbox') return false;
  if (field.type === 'number') return null;
  return '';
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/** Recursively validates + shapes raw parsed JSON against a field schema. */
export function shapeData(fields: FieldSchema[], raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid data: expected an object.');
  }
  const data = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const value = data[field.key];

    if (field.type === 'array') {
      if (value !== undefined && !Array.isArray(value)) {
        throw new Error(`${field.label} must be a list.`);
      }
      const rows = (value as unknown[] | undefined) ?? [];
      result[field.key] = rows.map((row) => shapeArrayRow(field, row));
      continue;
    }

    if (field.required && isEmptyValue(value)) {
      throw new Error(`${field.label} is required.`);
    }
    result[field.key] = isEmptyValue(value) ? defaultForField(field) : value;
  }

  return result;
}

function shapeArrayRow(field: FieldSchema, row: unknown): unknown {
  const subFields = field.fields ?? [];
  const scalar = subFields.length === 1 && subFields[0].key === 'value';
  if (scalar) {
    return shapeData(subFields, { value: row }).value;
  }
  return shapeData(subFields, row);
}
