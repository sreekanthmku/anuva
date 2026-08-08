export type AdminFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'string[]'
  | 'number[]'
  | 'json';

export type AdminField = {
  name: string;
  label: string;
  type: AdminFieldType;
  required: boolean;
  nullable: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  multiline?: boolean;
  relation?: {
    resource: string;
    labelFields: string[];
  };
};
