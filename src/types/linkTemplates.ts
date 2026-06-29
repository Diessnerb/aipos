export interface TemplateOption {
  option_name: string;
  price: number;
}

export interface LinkTemplate {
  id: string;
  company_id: string;
  template_name: string;
  link_structure_json: TemplateOption[];
  created_at?: string;
  updated_at?: string;
}
