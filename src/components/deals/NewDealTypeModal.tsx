import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDealTypes, FieldSchema, CreateDealTypeData } from '@/hooks/useDealTypes';

interface NewDealTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (dealType: any) => void;
}

export const NewDealTypeModal: React.FC<NewDealTypeModalProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [description, setDescription] = useState('');
  const [generatedSchema, setGeneratedSchema] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingFields, setEditingFields] = useState<FieldSchema[]>([]);
  const [dealTypeName, setDealTypeName] = useState('');

  const { generateDealType, createDealType } = useDealTypes();

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateDealType(description);
      
      if (result.error) {
        toast.error('AI generation failed, using fallback template');
        setGeneratedSchema(result.fallbackSchema);
      } else {
        setGeneratedSchema(result);
        toast.success('Deal type fields generated successfully!');
      }
      
      setDealTypeName(result.name || result.fallbackSchema?.name || '');
      setEditingFields(result.fields || result.fallbackSchema?.fields || []);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate fields. Please try again or add fields manually.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addManualField = () => {
    setEditingFields(prev => [...prev, {
      name: `field_${prev.length + 1}`,
      label: 'New Field',
      type: 'text',
      required: false
    }]);
  };

  const updateField = (index: number, updates: Partial<FieldSchema>) => {
    setEditingFields(prev => prev.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    ));
  };

  const removeField = (index: number) => {
    setEditingFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dealTypeName.trim()) {
      toast.error('Please enter a deal type name');
      return;
    }

    if (editingFields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    setIsSaving(true);
    try {
      const dealTypeData: CreateDealTypeData = {
        key: generatedSchema?.key || dealTypeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: dealTypeName,
        description: description,
        schema: {
          fields: editingFields
        }
      };

      const newDealType = await createDealType(dealTypeData);
      toast.success('Deal type created successfully!');
      onSuccess(newDealType);
      handleClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to create deal type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    setGeneratedSchema(null);
    setEditingFields([]);
    setDealTypeName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create New Deal Type
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description">Describe your deal type</Label>
            <Textarea
              id="description"
              placeholder="e.g., Student discount 20% off with valid ID, Happy hour 2-for-1 cocktails, Birthday special free dessert..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !description.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating fields with AI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate fields with AI
                </>
              )}
            </Button>
          </div>

          {/* Generated/Manual Fields */}
          {(generatedSchema || editingFields.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deal Type Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Deal Type Name */}
                <div className="space-y-2">
                  <Label htmlFor="dealTypeName">Deal Type Name</Label>
                  <Input
                    id="dealTypeName"
                    value={dealTypeName}
                    onChange={(e) => setDealTypeName(e.target.value)}
                    placeholder="Enter deal type name"
                  />
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Input Fields</Label>
                    <Button variant="outline" size="sm" onClick={addManualField}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  {editingFields.map((field, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Field {index + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Field Name</Label>
                          <Input
                            value={field.name}
                            onChange={(e) => updateField(index, { name: e.target.value })}
                            placeholder="field_name"
                          />
                        </div>
                        <div>
                          <Label>Label</Label>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            placeholder="Display Label"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value as any })}
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="number">Number</option>
                            <option value="integer">Integer</option>
                            <option value="currency">Currency</option>
                            <option value="boolean">Boolean</option>
                            <option value="select">Select</option>
                            <option value="date">Date</option>
                            <option value="time">Time</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded"
                          />
                          <Label>Required</Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No fields yet - manual option */}
          {!generatedSchema && editingFields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Generate fields with AI or add them manually</p>
              <Button variant="outline" onClick={addManualField} className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                Add Field Manually
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving || !dealTypeName.trim() || editingFields.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Deal Type'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};