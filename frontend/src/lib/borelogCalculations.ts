// Borelog Field Calculation Utilities

export interface CalculationContext {
  rows: Array<{
    id: string;
    fields: Array<{
      id: string;
      value: string | number | null;
    }>;
  }>;
  currentRowId: string;
}

/**
 * Calculate field value based on formula and dependencies
 */
export function calculateFieldValue(
  formula: string,
  dependencies: string[],
  context: CalculationContext
): string | number | null {
  try {
    let calculation = formula;

    // Replace field references with actual values
    dependencies.forEach(depId => {
      const depValue = getFieldValue(depId, context);
      const numericValue = typeof depValue === 'number' ? depValue : parseFloat(depValue?.toString() || '0');
      calculation = calculation.replace(new RegExp(depId, 'g'), numericValue.toString());
    });

    // Handle specific calculation types
    if (calculation.includes('count(')) {
      return handleCountCalculation(calculation, context);
    }

    // Handle arithmetic operations
    if (calculation.includes('+') || calculation.includes('-') || calculation.includes('*') || calculation.includes('/')) {
      return handleArithmeticCalculation(calculation);
    }

    // Try to evaluate as simple expression
    const result = evaluateExpression(calculation);
    return isNaN(result) ? null : result;

  } catch (error) {
    console.error('Calculation error:', error);
    return null;
  }
}

/**
 * Get field value from context
 */
function getFieldValue(fieldId: string, context: CalculationContext): string | number | null {
  // First check current row
  const currentRow = context.rows.find(row => row.id === context.currentRowId);
  if (currentRow) {
    const field = currentRow.fields.find(f => f.id === fieldId);
    if (field) return field.value;
  }

  // Then check all other rows
  for (const row of context.rows) {
    const field = row.fields.find(f => f.id === fieldId);
    if (field) return field.value;
  }

  return null;
}

/**
 * Handle count calculations like count(permeability_test_rows)
 */
function handleCountCalculation(calculation: string, context: CalculationContext): number {
  const match = calculation.match(/count\((\w+)\)/);
  if (match) {
    const rowType = match[1];
    return context.rows.filter(row => row.id.includes(rowType)).length;
  }
  return 0;
}

/**
 * Handle arithmetic calculations
 */
function handleArithmeticCalculation(calculation: string): number {
  // Simple arithmetic evaluation
  const sanitized = calculation.replace(/[^0-9+\-*/().]/g, '');
  return evaluateExpression(sanitized);
}

/**
 * Safely evaluate mathematical expressions
 */
function evaluateExpression(expression: string): number {
  try {
    // Use Function constructor for safer evaluation
    const result = new Function(`return ${expression}`)();
    return typeof result === 'number' ? result : parseFloat(result) || 0;
  } catch (error) {
    console.error('Expression evaluation error:', error);
    return 0;
  }
}

/**
 * Validate field value based on validation rules
 */
export function validateFieldValue(
  value: string | number | null,
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  }
): { isValid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { isValid: true }; // Allow null values
  }

  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString());

  // Check min value
  if (validation?.min !== undefined && numericValue < validation.min) {
    return {
      isValid: false,
      error: `Value must be at least ${validation.min}`
    };
  }

  // Check max value
  if (validation?.max !== undefined && numericValue > validation.max) {
    return {
      isValid: false,
      error: `Value must be at most ${validation.max}`
    };
  }

  // Check pattern (for string values)
  if (validation?.pattern && typeof value === 'string') {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return {
        isValid: false,
        error: `Value does not match required pattern`
      };
    }
  }

  return { isValid: true };
}

/**
 * Auto-calculate dependent fields when a field value changes
 */
export function recalculateDependentFields(
  changedFieldId: string,
  rows: Array<{
    id: string;
    fields: Array<{
      id: string;
      value: string | number | null;
      calculation?: string;
      dependencies?: string[];
    }>;
  }>
): Array<{
  id: string;
  fields: Array<{
    id: string;
    value: string | number | null;
  }>;
}> {
  return rows.map(row => ({
    ...row,
    fields: row.fields.map(field => {
      // If this field depends on the changed field, recalculate it
      if (field.dependencies?.includes(changedFieldId) && field.calculation) {
        const context: CalculationContext = {
          rows,
          currentRowId: row.id
        };
        const newValue = calculateFieldValue(field.calculation, field.dependencies, context);
        return { ...field, value: newValue };
      }
      return field;
    })
  }));
}

/**
 * Get all field dependencies recursively
 */
export function getFieldDependencies(
  fieldId: string,
  rows: Array<{
    id: string;
    fields: Array<{
      id: string;
      dependencies?: string[];
    }>;
  }>
): string[] {
  const dependencies = new Set<string>();

  function addDependencies(fieldId: string) {
    for (const row of rows) {
      const field = row.fields.find(f => f.id === fieldId);
      if (field?.dependencies) {
        field.dependencies.forEach(depId => {
          if (!dependencies.has(depId)) {
            dependencies.add(depId);
            addDependencies(depId); // Recursively add dependencies of dependencies
          }
        });
      }
    }
  }

  addDependencies(fieldId);
  return Array.from(dependencies);
}
